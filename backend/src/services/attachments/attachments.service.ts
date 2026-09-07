import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { attachment, card, cardActivity } from "../../db/schema/trello";
import { notFound } from "../../common/errors";
import { deleteUpload, inlinePreview, readUpload, storeUpload } from "../../common/storage";
import { loadAttachmentContext, loadCardContext, requireAdmin } from "../organizations/org-access";

export const attachmentsService = {
  async upload(
    userId: string,
    cardId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer },
  ) {
    await loadCardContext(userId, cardId);
    const stored = await storeUpload(file.originalname, file.mimetype, file.buffer);
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(attachment)
        .values({
          fileName: file.originalname.trim().slice(0, 255) || "file",
          mime: file.mimetype,
          size: stored.size,
          storageKey: stored.storageKey,
          cardId,
          uploadedBy: userId,
        })
        .returning();
      if (!row) throw new Error("Attachment insert failed");
      await tx.insert(cardActivity).values({
        cardId,
        userId,
        action: "ATTACHMENT_ADDED",
        details: { attachmentId: row.id, fileName: row.fileName },
      });
      return [row];
    });
    return created;
  },

  /** Uploader or admin (mirrors the comment policy). */
  async remove(userId: string, attachmentId: string) {
    const { scope, attachment: row } = await loadAttachmentContext(userId, attachmentId);
    if (row.uploadedBy !== userId) requireAdmin(scope);
    await deleteUpload(row.storageKey);
    await db.transaction(async (tx) => {
      // No FK from card.coverAttachmentId (would cycle card↔attachment):
      // clear covers pointing at this file in the same transaction.
      await tx.update(card).set({ coverAttachmentId: null }).where(eq(card.coverAttachmentId, attachmentId));
      await tx.delete(attachment).where(eq(attachment.id, attachmentId));
    });
  },

  async read(userId: string, attachmentId: string) {
    const { attachment: row } = await loadAttachmentContext(userId, attachmentId);
    const buffer = await readUpload(row.storageKey);
    return { buffer, mime: row.mime, fileName: row.fileName, inline: inlinePreview(row.mime) };
  },
};
