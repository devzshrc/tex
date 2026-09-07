import { desc, eq } from "drizzle-orm";
import { db } from "../../config/database";
import { customFieldDef } from "../../db/schema/trello";
import { badRequest, notFound } from "../../common/errors";
import { rankAppend } from "../../common/lexorank";
import { loadBoardContext, loadFieldContext } from "../organizations/org-access";
import type { CustomFieldType } from "../../db/schema/trello";

function assertOptions(type: CustomFieldType, options: string[] | undefined): string[] | null {
  if (type !== "SELECT") {
    if (options !== undefined) throw badRequest("INVALID_FIELD_DEF", "Only SELECT fields take options");
    return null;
  }
  const cleaned = [...new Set((options ?? []).map((o) => o.trim()).filter(Boolean))].slice(0, 20);
  if (cleaned.length === 0) throw badRequest("INVALID_FIELD_DEF", "SELECT fields need 1–20 options");
  return cleaned;
}

async function maxFieldRank(boardId: string): Promise<string | null> {
  const [row] = await db
    .select({ rank: customFieldDef.rank })
    .from(customFieldDef)
    .where(eq(customFieldDef.boardId, boardId))
    .orderBy(desc(customFieldDef.rank))
    .limit(1);
  return row?.rank ?? null;
}

export const fieldsService = {
  async create(
    userId: string,
    boardId: string,
    input: { name: string; type: CustomFieldType; options?: string[] },
  ) {
    await loadBoardContext(userId, boardId);
    const [created] = await db
      .insert(customFieldDef)
      .values({
        name: input.name.trim(),
        type: input.type,
        options: assertOptions(input.type, input.options),
        rank: rankAppend(await maxFieldRank(boardId)),
        boardId,
      })
      .returning();
    if (!created) throw new Error("Field insert failed");
    return created;
  },

  async update(userId: string, fieldId: string, input: { name?: string; options?: string[] }) {
    const { field } = await loadFieldContext(userId, fieldId);
    // Type is immutable: existing values live in type-specific columns.
    const patch: Partial<typeof customFieldDef.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.options !== undefined) patch.options = assertOptions(field.type, input.options);
    const [updated] = await db.update(customFieldDef).set(patch).where(eq(customFieldDef.id, fieldId)).returning();
    if (!updated) throw notFound("Custom field not found");
    return updated;
  },

  async remove(userId: string, fieldId: string) {
    await loadFieldContext(userId, fieldId);
    // Values cascade.
    await db.delete(customFieldDef).where(eq(customFieldDef.id, fieldId));
  },
};
