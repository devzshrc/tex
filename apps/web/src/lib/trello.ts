export type OrgRole = "ADMIN" | "MEMBER";

export interface Org {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyOrg extends Org {
  role: OrgRole;
}

export interface OrgDetail extends Org {
  myRole: OrgRole;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Member {
  userId: string;
  role: OrgRole;
  joinedAt: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Invite {
  id: string;
  email: string;
  role: OrgRole;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  organizationId: string;
  invitedBy: string | null;
  createdAt: string;
}

export interface Board {
  id: string;
  title: string;
  organizationId: string;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrelloList {
  id: string;
  title: string;
  rank: string;
  boardId: string;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrelloCard {
  id: string;
  title: string;
  description: string | null;
  rank: string;
  listId: string;
  version: number;
  dueAt: string | null;
  dueComplete: boolean;
  coverColor: string | null;
  coverAttachmentId: string | null;
  storyPoints: number | null;
  isTemplate: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  boardId: string;
  createdAt: string;
}

export interface CardLabelJoin {
  id: string;
  cardId: string;
  labelId: string;
  label: Label;
}

export interface Reminder {
  id: string;
  title: string;
  dueAt: string;
  dueComplete: boolean;
  listId: string;
  listTitle: string;
  boardId: string;
  boardTitle: string;
  organizationId: string;
  organizationName: string;
}

export interface Assignee {
  id: string;
  cardId: string;
  userId: string;
  user: Profile | null;
}

export interface ChecklistItem {
  id: string;
  text: string;
  complete: boolean;
  order: number;
  checklistId: string;
  assigneeUserId: string | null;
  assignee?: Profile | null;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  title: string;
  order: number;
  cardId: string;
  createdAt: string;
  items: ChecklistItem[];
}

export interface Attachment {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  storageKey: string;
  cardId: string;
  uploadedBy: string | null;
  createdAt: string;
}

export interface Vote {
  userId: string;
  user?: Profile | null;
}

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT";

export interface CustomFieldDef {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  order: number;
  boardId: string;
  createdAt: string;
}

export interface CustomFieldValue {
  id: string;
  cardId: string;
  fieldId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  field: CustomFieldDef;
}

export interface CardComment {
  id: string;
  text: string;
  cardId: string;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Null user = tombstoned "Deleted user". */
  user: Profile | null;
}

export interface CardActivity {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  cardId: string;
  userId: string | null;
  createdAt: string;
  user: Profile | null;
}

export type BoardCard = TrelloCard & {
  assignees: { userId: string; user: Profile | null }[];
  cardLabels: CardLabelJoin[];
  checklists: { id: string; items: { id: string; complete: boolean }[] }[];
  votes: { userId: string }[];
};

export type BoardList = TrelloList & { cards: BoardCard[] };

export interface BoardDetail extends Board {
  labels: Label[];
  customFieldDefs: CustomFieldDef[];
  lists: BoardList[];
}

export interface CardDetail extends TrelloCard {
  list: { id: string; title: string; boardId: string; board: { id: string; title: string; organizationId: string } };
  assignees: Assignee[];
  cardLabels: CardLabelJoin[];
  checklists: (Checklist & { items: (ChecklistItem & { assignee: Profile | null })[] })[];
  attachments: Attachment[];
  votes: { userId: string; user: Profile | null }[];
  customFieldValues: CustomFieldValue[];
  comments: CardComment[];
  activities: CardActivity[];
}
