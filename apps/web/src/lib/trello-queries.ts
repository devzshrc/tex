import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError, api } from "./api";
import type {
  Board,
  BoardDetail,
  CardComment,
  Invite,
  Label,
  Member,
  MyOrg,
  OrgDetail,
  OrgRole,
  Reminder,
  TrelloCard,
  TrelloList,
} from "./trello";

export const keys = {
  orgs: ["orgs"] as QueryKey,
  org: (id: string) => ["org", id] as QueryKey,
  orgBoards: (id: string, archived: boolean) => ["orgBoards", id, archived] as QueryKey,
  members: (id: string) => ["members", id] as QueryKey,
  invites: (id: string) => ["invites", id] as QueryKey,
  board: (id: string, archived: boolean) => ["board", id, archived] as QueryKey,
  card: (id: string | null) => ["card", id] as QueryKey,
  reminders: (days: number) => ["reminders", days] as QueryKey,
};

/* Queries */

export function useOrgs() {
  return useQuery({ queryKey: keys.orgs, queryFn: () => api.get<{ organizations: MyOrg[] }>("/organizations").then((r) => r.organizations) });
}

export function useOrg(orgId: string | null) {
  return useQuery({
    queryKey: keys.org(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => api.get<{ organization: OrgDetail }>(`/organizations/${orgId}`).then((r) => r.organization),
  });
}

export function useOrgBoards(orgId: string | null, includeArchived = false) {
  return useQuery({
    queryKey: keys.orgBoards(orgId ?? "", includeArchived),
    enabled: !!orgId,
    queryFn: () =>
      api
        .get<{ boards: Board[] }>(`/boards?organizationId=${orgId}&includeArchived=${includeArchived}`)
        .then((r) => r.boards),
  });
}

export function useMembers(orgId: string | null) {
  return useQuery({
    queryKey: keys.members(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => api.get<{ members: Member[] }>(`/organizations/${orgId}/members`).then((r) => r.members),
  });
}

export function useInvites(orgId: string | null) {
  return useQuery({
    queryKey: keys.invites(orgId ?? ""),
    enabled: !!orgId,
    queryFn: () => api.get<{ invites: Invite[] }>(`/organizations/${orgId}/invites`).then((r) => r.invites),
  });
}

export function useBoardDetail(boardId: string | null, includeArchived = false) {
  return useQuery({
    queryKey: keys.board(boardId ?? "", includeArchived),
    enabled: !!boardId,
    queryFn: () =>
      api.get<{ board: BoardDetail }>(`/boards/${boardId}?includeArchived=${includeArchived}`).then((r) => r.board),
  });
}

export function useCardDetail(cardId: string | null) {
  return useQuery({
    queryKey: keys.card(cardId),
    enabled: !!cardId,
    queryFn: () => api.get<{ card: import("./trello").CardDetail }>(`/cards/${cardId}`).then((r) => r.card),
  });
}

/* Mutations */

function useInvalidate<TData, TVars>(fn: (vars: TVars) => Promise<TData>, keyFn: (vars: TVars, data?: TData) => QueryKey[]) {
  const qc = useQueryClient();
  const invalidate = (vars: TVars, data?: TData) => {
    for (const key of keyFn(vars, data)) qc.invalidateQueries({ queryKey: key });
  };
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => invalidate(vars, data),
    // Global safety net: a version conflict means someone else changed the
    // row first — refetch canonical state and say so. Text editors surface
    // a keep-mine/use-latest dialog on top of this via the error code.
    onError: (err, vars) => {
      if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
        invalidate(vars);
        toast.info("Changed elsewhere — reloaded latest.");
      }
    },
  });
}

const invalidateOrg = (orgId: string): QueryKey[] => [keys.orgs, keys.org(orgId)];
const invalidateBoardTree = (boardId: string): QueryKey[] => [keys.board(boardId, false), keys.board(boardId, true)];

export function useCreateOrg() {
  return useInvalidate((v: { name: string; slug: string }) => api.post<{ organization: MyOrg }>("/organizations", v).then((r) => r.organization), () => [keys.orgs]);
}

export function useRenameOrg(orgId: string) {
  return useInvalidate((v: { name: string }) => api.patch(`/organizations/${orgId}`, v), () => invalidateOrg(orgId));
}

export function useDeleteOrg(orgId: string) {
  return useInvalidate(() => api.del(`/organizations/${orgId}`), () => [keys.orgs]);
}

export function useChangeRole(orgId: string) {
  return useInvalidate((v: { userId: string; role: OrgRole }) => api.patch(`/organizations/${orgId}/members/${v.userId}`, { role: v.role }), () => [keys.members(orgId)]);
}

export function useRemoveMember(orgId: string) {
  return useInvalidate((v: { userId: string }) => api.del(`/organizations/${orgId}/members/${v.userId}`), () => [keys.members(orgId), ...invalidateOrg(orgId)]);
}

export function useInvite(orgId: string) {
  return useInvalidate((v: { email: string; role: OrgRole }) => api.post<{ invite: Invite }>(`/organizations/${orgId}/invites`, v).then((r) => r.invite), () => [keys.invites(orgId)]);
}

export function useRevokeInvite(orgId: string) {
  return useInvalidate((v: { inviteId: string }) => api.del(`/organizations/${orgId}/invites/${v.inviteId}`), () => [keys.invites(orgId)]);
}

export function useAcceptInvite() {
  return useInvalidate((v: { token: string }) => api.post<{ organization: MyOrg }>("/organizations/invites/accept", v).then((r) => r.organization), () => [keys.orgs]);
}

export function useCreateBoard(orgId: string) {
  return useInvalidate((v: { title: string }) => api.post<{ board: Board }>("/boards", { ...v, organizationId: orgId }).then((r) => r.board), () => [keys.orgBoards(orgId, false)]);
}

export function useUpdateBoard(orgId: string) {
  return useInvalidate(
    (v: { boardId: string; title?: string; archived?: boolean; expectedVersion: number }) =>
      api.patch<{ board: Board }>(`/boards/${v.boardId}`, v).then((r) => r.board),
    (v) => [...invalidateBoardTree(v.boardId), keys.orgBoards(orgId, false), keys.orgBoards(orgId, true)],
  );
}

export function useDeleteBoard(orgId: string) {
  return useInvalidate((v: { boardId: string }) => api.del(`/boards/${v.boardId}`), (v) => [...invalidateBoardTree(v.boardId), keys.orgBoards(orgId, false), keys.orgBoards(orgId, true)]);
}

export function useCreateList(boardId: string) {
  return useInvalidate(
    (v: { title: string; beforeOrder?: number | null; afterOrder?: number | null }) => api.post<{ list: TrelloList }>("/lists", { ...v, boardId }).then((r) => r.list),
    () => invalidateBoardTree(boardId),
  );
}

export function useUpdateList(boardId: string) {
  return useInvalidate(
    (v: { listId: string; title?: string; archived?: boolean; boardId?: string; expectedVersion: number }) =>
      api.patch<{ list: TrelloList }>(`/lists/${v.listId}`, v).then((r) => r.list),
    (v) => [...invalidateBoardTree(boardId), ...(v.boardId && v.boardId !== boardId ? invalidateBoardTree(v.boardId) : [])],
  );
}

export function useDeleteList(boardId: string) {
  return useInvalidate((v: { listId: string }) => api.del(`/lists/${v.listId}`), () => invalidateBoardTree(boardId));
}

export function useCreateCard(boardId: string) {
  return useInvalidate(
    (v: { listId: string; title: string; beforeOrder?: number | null; afterOrder?: number | null }) =>
      api.post<{ card: TrelloCard }>("/cards", v).then((r) => r.card),
    () => invalidateBoardTree(boardId),
  );
}

export function useUpdateCard(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { title?: string; description?: string | null; archived?: boolean; dueAt?: string | null; dueComplete?: boolean; coverColor?: string | null; coverAttachmentId?: string | null; storyPoints?: number | null; isTemplate?: boolean; expectedVersion: number }) =>
      api.patch<{ card: TrelloCard }>(`/cards/${cardId}`, v).then((r) => r.card),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useDeleteCard(boardId: string) {
  return useInvalidate((v: { cardId: string }) => api.del(`/cards/${v.cardId}`), () => invalidateBoardTree(boardId));
}

export function useAssign(boardId: string, cardId: string) {
  return useInvalidate((v: { userId: string }) => api.post(`/cards/${cardId}/assignees`, v), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useUnassign(boardId: string, cardId: string) {
  return useInvalidate((v: { userId: string }) => api.del(`/cards/${cardId}/assignees/${v.userId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useAddComment(boardId: string, cardId: string) {
  return useInvalidate((v: { text: string }) => api.post<{ comment: CardComment }>(`/cards/${cardId}/comments`, v).then((r) => r.comment), () => [keys.card(cardId), ...invalidateBoardTree(boardId)]);
}

export function useUpdateComment(cardId: string) {
  return useInvalidate((v: { commentId: string; text: string }) => api.patch(`/cards/comments/${v.commentId}`, { text: v.text }), () => [keys.card(cardId)]);
}

export function useDeleteComment(boardId: string, cardId: string) {
  return useInvalidate((v: { commentId: string }) => api.del(`/cards/comments/${v.commentId}`), () => [keys.card(cardId), ...invalidateBoardTree(boardId)]);
}

export function useReminders(days = 7) {
  return useQuery({
    queryKey: keys.reminders(days),
    queryFn: () => api.get<{ reminders: Reminder[] }>(`/me/reminders?days=${days}`).then((r) => r.reminders),
  });
}

export interface MyTask {
  id: string;
  title: string;
  dueAt: string | null;
  dueComplete: boolean;
  listId: string;
  listTitle: string;
  boardId: string;
  boardTitle: string;
  organizationId: string;
  organizationName: string;
  version: number;
  updatedAt: string;
}

export function useMyTasks() {
  return useQuery({
    queryKey: ["my-tasks"] as QueryKey,
    queryFn: () => api.get<{ tasks: MyTask[] }>("/me/tasks").then((r) => r.tasks),
  });
}

export interface SearchResults {
  boards: { id: string; title: string; organizationId: string; organizationName: string }[];
  cards: { id: string; title: string; listId: string; listTitle: string; boardId: string; boardTitle: string; organizationName: string }[];
  people: { id: string; name: string; email: string; image: string | null }[];
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query] as QueryKey,
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
    queryFn: () =>
      api.get<SearchResults>(`/search?q=${encodeURIComponent(query.trim())}&limit=8`).then((r) => r),
  });
}

export function useCreateLabel(boardId: string) {
  return useInvalidate(
    (v: { name?: string; color: string }) => api.post<{ label: Label }>("/labels", { ...v, boardId }).then((r) => r.label),
    () => invalidateBoardTree(boardId),
  );
}

export function useUpdateLabel(boardId: string) {
  return useInvalidate(
    (v: { labelId: string; name?: string; color?: string }) =>
      api.patch<{ label: Label }>(`/labels/${v.labelId}`, { name: v.name, color: v.color }).then((r) => r.label),
    () => invalidateBoardTree(boardId),
  );
}

export function useDeleteLabel(boardId: string) {
  return useInvalidate((v: { labelId: string }) => api.del(`/labels/${v.labelId}`), () => invalidateBoardTree(boardId));
}

export function useCreateChecklist(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { title: string }) => api.post(`/checklists`, { ...v, cardId }).then((r) => (r as { checklist: unknown }).checklist),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useUpdateChecklist(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { checklistId: string; title: string }) => api.patch(`/checklists/${v.checklistId}`, { title: v.title }),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useDeleteChecklist(boardId: string, cardId: string) {
  return useInvalidate((v: { checklistId: string }) => api.del(`/checklists/${v.checklistId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useAddChecklistItem(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { checklistId: string; text: string; assigneeUserId?: string }) => api.post(`/checklists/${v.checklistId}/items`, { text: v.text, assigneeUserId: v.assigneeUserId }),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useUpdateChecklistItem(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { itemId: string; text?: string; complete?: boolean; assigneeUserId?: string | null }) =>
      api.patch(`/checklists/items/${v.itemId}`, { text: v.text, complete: v.complete, assigneeUserId: v.assigneeUserId }),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useDeleteChecklistItem(boardId: string, cardId: string) {
  return useInvalidate((v: { itemId: string }) => api.del(`/checklists/items/${v.itemId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useConvertChecklistItem(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { itemId: string; toListId?: string }) => api.post<{ card: TrelloCard }>(`/checklists/items/${v.itemId}/convert`, { toListId: v.toListId }).then((r) => r.card),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useUploadAttachment(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { file: File }) => {
      const form = new FormData();
      form.append("file", v.file);
      return api.upload(`/cards/${cardId}/attachments`, form);
    },
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useDeleteAttachment(boardId: string, cardId: string) {
  return useInvalidate((v: { attachmentId: string }) => api.del(`/attachments/${v.attachmentId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useToggleVote(boardId: string, cardId: string) {
  return useInvalidate(
    () => api.post<{ voted: boolean; votes: number }>(`/cards/${cardId}/vote`, {}),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useCopyCard(boardId: string) {
  return useInvalidate(
    (v: { cardId: string; toListId?: string; title?: string }) => api.post<{ card: TrelloCard }>(`/cards/${v.cardId}/copy`, { toListId: v.toListId, title: v.title }).then((r) => r.card),
    () => invalidateBoardTree(boardId),
  );
}

export function useCreateField(boardId: string) {
  return useInvalidate(
    (v: { name: string; type: string; options?: string[] }) => api.post("/fields", { ...v, boardId }),
    () => invalidateBoardTree(boardId),
  );
}

export function useUpdateField(boardId: string) {
  return useInvalidate(
    (v: { fieldId: string; name?: string; options?: string[] }) => api.patch(`/fields/${v.fieldId}`, { name: v.name, options: v.options }),
    () => invalidateBoardTree(boardId),
  );
}

export function useDeleteField(boardId: string) {
  return useInvalidate((v: { fieldId: string }) => api.del(`/fields/${v.fieldId}`), () => invalidateBoardTree(boardId));
}

export function useSetFieldValue(boardId: string, cardId: string) {
  return useInvalidate(
    (v: { fieldId: string; value: unknown }) => api.put(`/cards/${cardId}/fields`, v),
    () => [...invalidateBoardTree(boardId), keys.card(cardId)],
  );
}

export function useClearFieldValue(boardId: string, cardId: string) {
  return useInvalidate((v: { fieldId: string }) => api.del(`/cards/${cardId}/fields/${v.fieldId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useAttachLabel(boardId: string, cardId: string) {
  return useInvalidate((v: { labelId: string }) => api.post(`/cards/${cardId}/labels`, v), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}

export function useDetachLabel(boardId: string, cardId: string) {
  return useInvalidate((v: { labelId: string }) => api.del(`/cards/${cardId}/labels/${v.labelId}`), () => [...invalidateBoardTree(boardId), keys.card(cardId)]);
}
