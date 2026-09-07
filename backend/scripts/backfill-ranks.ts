import { asc, eq } from "drizzle-orm";
import { closeDatabase, db } from "../src/config/database";
import { card, checklist, checklistItem, customFieldDef, list } from "../src/db/schema/trello";
import { rankAt } from "../src/common/lexorank";

/**
 * One-shot: assigns true fractional ranks from legacy float `order`,
 * per parent, oldest-position first. Run once after 0004:
 *   bun scripts/backfill-ranks.ts
 * Afterwards the deprecated `order` columns can be dropped.
 * (Dev/staging databases are small; per-row updates are fine. For a
 * large production table this would batch with a single UPDATE using
 * row_number() instead.)
 */
async function backfill(
  label: string,
  parentIds: () => Promise<string[]>,
  orderedIds: (parentId: string) => Promise<string[]>,
  setRank: (id: string, rank: string) => Promise<void>,
): Promise<void> {
  let n = 0;
  for (const parentId of await parentIds()) {
    let i = 0;
    for (const id of await orderedIds(parentId)) {
      await setRank(id, rankAt(i));
      i += 1;
      n += 1;
    }
  }
  console.log(`${label}: ${n} rows ranked`);
}

async function main(): Promise<void> {
  await backfill(
    "lists",
    async () => (await db.selectDistinct({ p: list.boardId }).from(list)).map((r) => r.p),
    async (boardId) => (await db.select({ id: list.id }).from(list).where(eq(list.boardId, boardId)).orderBy(asc(list.order))).map((r) => r.id),
    async (id, rank) => {
      await db.update(list).set({ rank }).where(eq(list.id, id));
    },
  );
  await backfill(
    "cards",
    async () => (await db.selectDistinct({ p: card.listId }).from(card)).map((r) => r.p),
    async (listId) => (await db.select({ id: card.id }).from(card).where(eq(card.listId, listId)).orderBy(asc(card.order))).map((r) => r.id),
    async (id, rank) => {
      await db.update(card).set({ rank }).where(eq(card.id, id));
    },
  );
  await backfill(
    "checklists",
    async () => (await db.selectDistinct({ p: checklist.cardId }).from(checklist)).map((r) => r.p),
    async (cardId) => (await db.select({ id: checklist.id }).from(checklist).where(eq(checklist.cardId, cardId)).orderBy(asc(checklist.order))).map((r) => r.id),
    async (id, rank) => {
      await db.update(checklist).set({ rank }).where(eq(checklist.id, id));
    },
  );
  await backfill(
    "items",
    async () => (await db.selectDistinct({ p: checklistItem.checklistId }).from(checklistItem)).map((r) => r.p),
    async (checklistId) =>
      (await db.select({ id: checklistItem.id }).from(checklistItem).where(eq(checklistItem.checklistId, checklistId)).orderBy(asc(checklistItem.order))).map((r) => r.id),
    async (id, rank) => {
      await db.update(checklistItem).set({ rank }).where(eq(checklistItem.id, id));
    },
  );
  await backfill(
    "field defs",
    async () => (await db.selectDistinct({ p: customFieldDef.boardId }).from(customFieldDef)).map((r) => r.p),
    async (boardId) =>
      (await db.select({ id: customFieldDef.id }).from(customFieldDef).where(eq(customFieldDef.boardId, boardId)).orderBy(asc(customFieldDef.order))).map((r) => r.id),
    async (id, rank) => {
      await db.update(customFieldDef).set({ rank }).where(eq(customFieldDef.id, id));
    },
  );
  await closeDatabase();
  console.log("BACKFILL DONE");
}

await main();
