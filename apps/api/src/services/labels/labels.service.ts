import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { label } from "../../db/schema/trello";
import { notFound } from "../../common/errors";
import { loadBoardContext, loadLabelContext } from "../organizations/org-access";

export const LABEL_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "gray",
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const labelsService = {
  async create(userId: string, boardId: string, input: { name?: string; color: LabelColor }) {
    await loadBoardContext(userId, boardId);
    const [created] = await db
      .insert(label)
      .values({ name: input.name?.trim() ?? "", color: input.color, boardId })
      .returning();
    if (!created) throw new Error("Label insert failed");
    return created;
  },

  async update(userId: string, labelId: string, input: { name?: string; color?: LabelColor }) {
    await loadLabelContext(userId, labelId);
    const patch: Partial<typeof label.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim().slice(0, 60);
    if (input.color !== undefined) patch.color = input.color;
    const [updated] = await db.update(label).set(patch).where(eq(label.id, labelId)).returning();
    if (!updated) throw notFound("Label not found");
    return updated;
  },

  async remove(userId: string, labelId: string) {
    await loadLabelContext(userId, labelId);
    // card_label rows cascade.
    await db.delete(label).where(eq(label.id, labelId));
  },
};
