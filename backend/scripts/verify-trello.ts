import { eq, like } from "drizzle-orm";
import { closeDatabase, db } from "../src/config/database";
import { user } from "../src/db/schema/auth";
import { organization, orgInvite } from "../src/db/schema/trello";
import { HttpError, conflict } from "../src/common/errors";
import { errorHandler } from "../src/common/middleware/error-handler";
import { parseBody, userIdParam } from "../src/common/validation";
import { hashInviteToken } from "../src/services/organizations/organizations.service";
import { organizationsService } from "../src/services/organizations/organizations.service";
import { boardsService } from "../src/services/boards/boards.service";
import { listsService } from "../src/services/lists/lists.service";
import { cardsService } from "../src/services/cards/cards.service";
import { checklistsService } from "../src/services/checklists/checklists.service";
import { labelsService } from "../src/services/labels/labels.service";
import { attachmentsService } from "../src/services/attachments/attachments.service";
import { fieldsService } from "../src/services/fields/fields.service";
import { meService } from "../src/services/me/me.service";
import { searchService } from "../src/services/search/search.service";

let failures = 0;
function check(cond: unknown, msg: string): void {
  if (cond) console.log(`  ok — ${msg}`);
  else {
    failures += 1;
    console.error(`  FAIL — ${msg}`);
  }
}

async function expectCode(fn: () => Promise<unknown>, code: string, msg: string): Promise<void> {
  try {
    await fn();
    failures += 1;
    console.error(`  FAIL — ${msg} (no error thrown)`);
  } catch (err) {
    check(err instanceof HttpError && err.code === code, `${msg} (got ${(err as Error)?.message})`);
  }
}

const A = { id: "verify-user-a", name: "Verify A", email: "verify-a@example.com" };
const B = { id: "verify-user-b", name: "Verify B", email: "verify-b@example.com" };
const C = { id: "verify-user-c", name: "Verify C", email: "verify-c@example.com" };

async function main(): Promise<void> {
  // Idempotent: purge leftovers from previously aborted runs first.
  await db.delete(organization).where(eq(organization.slug, "acme-hq"));
  await db.delete(organization).where(eq(organization.slug, "search-org"));
  for (const u of [A, B, C]) await db.delete(user).where(eq(user.id, u.id));

  for (const u of [A, B, C]) {
    await db
      .insert(user)
      .values({ id: u.id, name: u.name, email: u.email, emailVerified: false })
      .onConflictDoNothing();
  }

  console.log("orgs:");
  const org = await organizationsService.create(A.id, { name: "Acme", slug: "Acme HQ" });
  check(org.slug === "acme-hq", "slug normalized to acme-hq");
  const mine = await organizationsService.listMine(A.id);
  check(mine.length === 1 && mine[0]?.role === "ADMIN", "creator is admin, listed in mine");
  await expectCode(() => organizationsService.getDetail(B.id, org.id), "NOT_FOUND", "outsider gets 404 on org");
  await expectCode(() => boardsService.create(B.id, org.id, "Nope"), "NOT_FOUND", "outsider cannot create board");
  await expectCode(
    () => organizationsService.create(B.id, { name: "Copy", slug: "acme-hq" }),
    "SLUG_TAKEN",
    "duplicate slug suggests alternative",
  );

  console.log("invites + roles:");
  const inv1 = await organizationsService.invite(A.id, org.id, { email: B.email, role: "MEMBER" });
  const inv2 = await organizationsService.invite(A.id, org.id, { email: B.email, role: "MEMBER" });
  check(inv1.id === inv2.id && inv1.token !== inv2.token, "re-invite rotates token (resend semantics)");
  await expectCode(
    () => organizationsService.acceptInvite(B.id, "wrong@example.com", inv2.token),
    "WRONG_ACCOUNT",
    "accept with mismatched email rejected",
  );
  const joined = await organizationsService.acceptInvite(B.id, B.email, inv2.token);
  check(joined.id === org.id, "B joins org via invite");
  const members = await organizationsService.listMembers(B.id, org.id);
  check(members.length === 2, "members list shows A + B");
  await expectCode(
    () => organizationsService.changeRole(A.id, org.id, A.id, "MEMBER"),
    "LAST_ADMIN",
    "cannot demote last admin",
  );
  await organizationsService.changeRole(A.id, org.id, B.id, "ADMIN");
  await organizationsService.changeRole(A.id, org.id, A.id, "MEMBER");
  check(true, "role handoff A→B works");
  await expectCode(
    () => organizationsService.removeMember(B.id, org.id, B.id),
    "LAST_ADMIN",
    "last admin cannot leave",
  );

  console.log("boards/lists/cards:");
  const board = await boardsService.create(A.id, org.id, "Roadmap");
  const l1 = await listsService.create(A.id, board.id, { title: "Todo" });
  const l2 = await listsService.create(A.id, board.id, { title: "Doing" });
  check(l2.order > l1.order, "lists append with increasing order");
  const l1moved = await listsService.reposition(A.id, l1.id, { beforeOrder: null, afterOrder: l2.order });
  check(l1moved.order < l2.order, "list repositioned before l2");
  const c1 = await cardsService.create(A.id, l1.id, { title: "First" });
  const c2 = await cardsService.create(A.id, l1.id, { title: "Second" });
  const c3 = await cardsService.create(A.id, l1.id, { title: "Third" });
  check(c1.order < c2.order && c2.order < c3.order, "cards append in order");
  // Move c3 between c1 and c2 inside l1.
  const hop = await cardsService.move(A.id, c3.id, { toListId: l1.id, beforeOrder: c1.order, afterOrder: c2.order });
  check(hop.listId === l1.id && hop.order > c1.order && hop.order < c2.order, "card moved between c1 and c2");
  // Cross-list move.
  const hop2 = await cardsService.move(A.id, c3.id, { toListId: l2.id, beforeOrder: null, afterOrder: null });
  check(hop2.listId === l2.id, "card moved across lists");
  const detail = await cardsService.getDetail(A.id, c3.id);
  const actions = detail.activities.map((a) => a.action);
  check(actions.includes("CREATED_CARD") && actions.includes("MOVED_CARD"), "activity log has create + moves");
  const moveEntry = detail.activities.find((a) => a.action === "MOVED_CARD");
  check(
    (moveEntry?.details as { toListId?: string } | null)?.toListId === l2.id,
    "move activity stores list context",
  );
  const tree = await boardsService.getDetail(A.id, board.id, false);
  check(tree.lists.length === 2, "board detail returns list tree");

  console.log("assignees/comments:");
  const first = await cardsService.assign(A.id, c1.id, B.id);
  const second = await cardsService.assign(A.id, c1.id, B.id);
  check(first.assigned && !second.assigned, "assign is idempotent");
  await expectCode(() => cardsService.assign(A.id, c1.id, C.id), "NOT_ORG_MEMBER", "non-member cannot be assigned");
  const cm1 = await cardsService.addComment(B.id, c1.id, "Looks good");
  await expectCode(() => cardsService.updateComment(A.id, cm1.id, "Edited by A"), "FORBIDDEN", "admin cannot edit others' comment");
  const edited = await cardsService.updateComment(B.id, cm1.id, "Looks great");
  check(edited && edited.text === "Looks great", "author edits own comment");
  await cardsService.addComment(A.id, c1.id, "Second");
  await cardsService.addComment(A.id, c1.id, "Third");
  const page1 = await cardsService.listComments(A.id, c1.id, { limit: 2 });
  check(page1.comments.length === 2 && page1.nextCursor !== null, "comment pagination returns cursor");
  const page2 = await cardsService.listComments(A.id, c1.id, { limit: 2, cursor: page1.nextCursor ?? undefined });
  check(page2.comments.length === 1 && page2.nextCursor === null, "second comment page terminates");
  await cardsService.deleteComment(B.id, cm1.id);
  const afterDel = await cardsService.listComments(A.id, c1.id, { limit: 10 });
  check(afterDel.comments.length === 2, "admin deletes comment");
  const feed = await cardsService.listActivities(A.id, c1.id, { limit: 10 });
  check(feed.activities.some((a) => a.action === "COMMENT_ADDED"), "comment creation logged");

  console.log("labels/due/reminders:");
  const lab = await labelsService.create(A.id, board.id, { name: "Bug", color: "red" });
  check(lab.color === "red", "label created");
  const relabel = await labelsService.update(A.id, lab.id, { name: "Bug!", color: "orange" });
  check(relabel.name === "Bug!" && relabel.color === "orange", "label renamed + recolored");
  const at1 = await cardsService.attachLabel(A.id, c1.id, lab.id);
  const at2 = await cardsService.attachLabel(A.id, c1.id, lab.id);
  check(at1.attached && !at2.attached, "label attach is idempotent");
  const otherBoard = await boardsService.create(A.id, org.id, "Other");
  const otherList = await listsService.create(A.id, otherBoard.id, { title: "L" });
  const otherCard = await cardsService.create(A.id, otherList.id, { title: "O" });
  await expectCode(
    () => cardsService.attachLabel(A.id, otherCard.id, lab.id),
    "LABEL_BOARD_MISMATCH",
    "cross-board label attach rejected",
  );
  const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const withDue = await cardsService.update(A.id, c1.id, { dueAt: due, dueComplete: false });
  check(!!withDue.dueAt && withDue.dueComplete === false, "due date set");
  await cardsService.assign(A.id, c1.id, B.id);
  const rems = await meService.reminders(B.id, 7);
  check(rems.some((r) => r.id === c1.id), "assignee sees card in reminders");
  const remsNarrow = await meService.reminders(C.id, 7);
  check(!remsNarrow.some((r) => r.id === c1.id), "non-assignee has no reminder");
  await cardsService.update(A.id, c1.id, { dueComplete: true });
  const remsDone = await meService.reminders(B.id, 7);
  check(!remsDone.some((r) => r.id === c1.id), "completed cards leave reminders");
  const feed2 = await cardsService.listActivities(A.id, c1.id, { limit: 20 });
  check(
    feed2.activities.some((a) => a.action === "LABEL_ADDED") && feed2.activities.some((a) => a.action === "DUE_CHANGED"),
    "label + due activities logged",
  );
  const det = await cardsService.detachLabel(A.id, c1.id, lab.id);
  check(det.detached, "label detached");
  await labelsService.remove(A.id, lab.id);
  await boardsService.update(A.id, otherBoard.id, { archived: true });
  await boardsService.remove(B.id, otherBoard.id);

  console.log("rich cards:");
  const cl = await checklistsService.create(A.id, c1.id, { title: "QA" });
  const it1 = await checklistsService.addItem(A.id, cl.id, { text: "Step one", assigneeUserId: B.id });
  const it2 = await checklistsService.addItem(A.id, cl.id, { text: "Step two" });
  check(!!it1.id && it2.order > it1.order, "checklist items append in order");
  await expectCode(
    () => checklistsService.addItem(A.id, cl.id, { text: "X", assigneeUserId: C.id }),
    "NOT_ORG_MEMBER",
    "item assignee must be a member",
  );
  await checklistsService.updateItem(B.id, it1.id, { complete: true });
  const moved2 = await checklistsService.repositionItem(A.id, it2.id, { beforeOrder: null, afterOrder: it1.order });
  check(moved2.order < it1.order, "item repositioned first");
  const fromItem = await checklistsService.convertItem(A.id, it2.id, {});
  check(fromItem.title === "Step two" && fromItem.listId === l1.id, "item converts to card in same list");
  // Attachments: upload, read back, cover, delete nulls cover.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const att = await attachmentsService.upload(A.id, c1.id, { originalname: "shot.png", mimetype: "image/png", buffer: png });
  check(att.size === png.length, "attachment stored with size");
  const file = await attachmentsService.read(A.id, att.id);
  check(file.inline && file.buffer.equals(png), "attachment reads back inline");
  await expectCode(
    () => attachmentsService.upload(A.id, c1.id, { originalname: "x.html", mimetype: "text/html", buffer: png }),
    "FILE_TYPE_BLOCKED",
    "html uploads blocked",
  );
  await expectCode(() => attachmentsService.remove(C.id, att.id), "NOT_FOUND", "outsider cannot see file (masked)");
  const att2 = await attachmentsService.upload(A.id, c1.id, { originalname: "admin-del.png", mimetype: "image/png", buffer: png });
  await attachmentsService.remove(B.id, att2.id);
  check(true, "admin deletes any file");
  await cardsService.update(A.id, c1.id, { coverColor: "blue", coverAttachmentId: att.id, storyPoints: 5, isTemplate: false });
  const covered = await cardsService.getDetail(A.id, c1.id);
  check(covered.coverColor === "blue" && covered.coverAttachmentId === att.id && covered.storyPoints === 5, "cover + points set");
  await expectCode(
    () => cardsService.update(A.id, c1.id, { coverColor: "neon" }),
    "INVALID_COLOR",
    "cover palette validated",
  );
  await attachmentsService.remove(A.id, att.id);
  const uncovered = await cardsService.getDetail(A.id, c1.id);
  check(uncovered.coverAttachmentId === null, "deleting cover file nulls cover");
  // Votes toggle.
  const v1 = await cardsService.toggleVote(B.id, c1.id);
  const v2 = await cardsService.toggleVote(B.id, c1.id);
  check(v1.voted && v1.votes === 1 && !v2.voted && v2.votes === 0, "votes toggle with count");
  // Custom fields: all four types + guards.
  const fText = await fieldsService.create(A.id, board.id, { name: "Notes", type: "TEXT" });
  const fNum = await fieldsService.create(A.id, board.id, { name: "Budget", type: "NUMBER" });
  const fDate = await fieldsService.create(A.id, board.id, { name: "Ship", type: "DATE" });
  const fSel = await fieldsService.create(A.id, board.id, { name: "Priority", type: "SELECT", options: ["P0", "P1"] });
  await expectCode(
    () => fieldsService.create(A.id, board.id, { name: "Bad", type: "TEXT", options: ["x"] }),
    "INVALID_FIELD_DEF",
    "non-select rejects options",
  );
  await cardsService.setCustomValue(A.id, c1.id, { fieldId: fText.id, value: "hello" });
  await cardsService.setCustomValue(A.id, c1.id, { fieldId: fNum.id, value: 42 });
  await cardsService.setCustomValue(A.id, c1.id, { fieldId: fDate.id, value: new Date().toISOString() });
  await cardsService.setCustomValue(A.id, c1.id, { fieldId: fSel.id, value: "P0" });
  await expectCode(
    () => cardsService.setCustomValue(A.id, c1.id, { fieldId: fSel.id, value: "P9" }),
    "INVALID_OPTION",
    "select validates membership",
  );
  await expectCode(
    () => cardsService.setCustomValue(A.id, c1.id, { fieldId: fNum.id, value: "lots" }),
    "INVALID_FIELD_VALUE",
    "number coerces strictly",
  );
  const withFields = await cardsService.getDetail(A.id, c1.id);
  check(withFields.customFieldValues.length === 4, "all custom values stored");
  // Copy deep-copies everything; templates flagged.
  await cardsService.update(A.id, c1.id, { isTemplate: true });
  const copy = await cardsService.copy(A.id, c1.id, {});
  check(copy.isTemplate === false && copy.title === `Copy of ${c1.title}`, "copy resets template flag");
  const copyDetail = await cardsService.getDetail(A.id, copy.id);
  check(
    copyDetail.assignees.length === covered.assignees.length &&
      copyDetail.cardLabels.length === covered.cardLabels.length &&
      copyDetail.checklists.length === covered.checklists.length &&
      copyDetail.comments.length === covered.comments.length &&
      copyDetail.customFieldValues.length === 4,
    "copy carries assignees, labels, checklists, comments, fields",
  );
  check(copyDetail.activities.some((a) => a.action === "CARD_COPIED"), "copy logged");
  await cardsService.update(A.id, c1.id, { isTemplate: false });

  console.log("archive-first + membership:");
  await expectCode(() => boardsService.remove(B.id, board.id), "ARCHIVE_FIRST", "board hard delete needs archive");
  await boardsService.update(A.id, board.id, { archived: true });
  await boardsService.remove(B.id, board.id);
  await expectCode(() => boardsService.getDetail(A.id, board.id, true), "NOT_FOUND", "deleted board is gone");
  // B (admin) removes A (member); A loses access.
  await organizationsService.removeMember(B.id, org.id, A.id);
  await expectCode(() => organizationsService.getDetail(A.id, org.id), "NOT_FOUND", "removed member loses access");

  console.log("hardening:");
  // Concurrent creators racing the same slug: exactly one wins, rest 409.
  const race = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) => organizationsService.create(A.id, { name: `Race ${i}`, slug: "race-slug" })),
  );
  const won = race.filter((r) => r.status === "fulfilled");
  const lost = race.filter(
    (r) => r.status === "rejected" && r.reason instanceof HttpError && r.reason.code === "SLUG_TAKEN",
  );
  check(won.length === 1 && lost.length === 4, "slug race: 1 winner, 4 SLUG_TAKEN (no 500s)");
  await db.delete(organization).where(like(organization.slug, "race-slug%"));
  // Error boundary preserves domain codes, hides unknown internals.
  const capture = (err: unknown) => {
    let status = 0;
    let body: { error: { code: string; message: string } } | undefined;
    const res = {
      status: (s: number) => { status = s; return res; },
      json: (b: { error: { code: string; message: string } }) => { body = b; return res; },
    };
    errorHandler(err, {} as never, res as never, () => {});
    return { status, body: body as { error: { code: string; message: string } } };
  };
  const coded = capture(conflict("ARCHIVE_FIRST", "Archive it first"));
  check(coded.status === 409 && coded.body.error.code === "ARCHIVE_FIRST", "error codes pass through boundary");
  const unknown = capture(new Error("db password=hunter2"));
  check(
    unknown.status === 500 && unknown.body.error.code === "INTERNAL_ERROR" && !unknown.body.error.message.includes("hunter2"),
    "unknown errors hide internals",
  );
  // Invite tokens stored hashed; raw works for accept.
  const invRaw = await organizationsService.invite(B.id, org.id, { email: C.email, role: "MEMBER" });
  const [invRow] = await db.select().from(orgInvite).where(eq(orgInvite.id, invRaw.id)).limit(1);
  check(!!invRow && invRow.token !== invRaw.token && invRow.token === hashInviteToken(invRaw.token), "invite token stored as hash");
  await organizationsService.acceptInvite(C.id, C.email, invRaw.token);
  check(true, "accept works against hashed token");
  // Member id params: opaque text allowed, blank rejected.
  check(parseBody(userIdParam, "verify-user-a") === "verify-user-a", "non-uuid auth id passes param validation");
  await expectCode(async () => parseBody(userIdParam, "   "), "VALIDATION_ERROR", "blank userId rejected with 400");

  console.log("search + tasks:");
  // Fresh org so earlier archive-first teardown can't interfere.
  const sorg = await organizationsService.create(A.id, { name: "Search Org", slug: "search-org" });
  const sboard = await boardsService.create(A.id, sorg.id, "Searchable Board");
  const slist = await listsService.create(A.id, sboard.id, { title: "L" });
  const scard = await cardsService.create(A.id, slist.id, { title: "Fix websocket reconnect", description: "exponential backoff" });
  await cardsService.assign(A.id, scard.id, A.id);
  const found = await searchService.search(A.id, "websocket", 8);
  check(found.cards.some((c) => c.id === scard.id), "search finds card by title");
  check(found.boards.some((b) => b.id === sboard.id) === false, "board title without query term is absent");
  const foundBoard = await searchService.search(A.id, "Searchable", 8);
  check(foundBoard.boards.some((b) => b.id === sboard.id), "search finds board by title");
  const foundPeople = await searchService.search(B.id, "verify-b@", 8);
  check(foundPeople.people.some((p) => p.id === B.id), "search finds org-mate by email");
  const outsiderHits = await searchService.search(C.id, "websocket", 8);
  check(!outsiderHits.cards.some((c) => c.id === scard.id), "outsider cannot search into org");
  await expectCode(async () => searchService.search(B.id, "x", 8), "QUERY_TOO_SHORT", "short query rejected");
  const tasks = await meService.tasks(A.id);
  check(tasks.some((t) => t.id === scard.id && t.boardTitle === "Searchable Board"), "my tasks lists assignment with context");
  await db.delete(organization).where(eq(organization.id, sorg.id));

  console.log("cleanup:");
  await db.delete(organization).where(eq(organization.id, org.id));
  for (const u of [A, B, C]) await db.delete(user).where(eq(user.id, u.id));

  if (failures > 0) {
    console.error(`${failures} FAILURE(S)`);
    process.exitCode = 1;
  } else console.log("ALL CHECKS PASSED");
  await closeDatabase();
}

await main();
