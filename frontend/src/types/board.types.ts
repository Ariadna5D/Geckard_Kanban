// Define los tipos principales de tablero y tareas
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskLabelColor =
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'purple'
  | 'blue'
  | 'sky'
  | 'gray';

export interface TaskLabel {
  name: string;
  color: TaskLabelColor;
}

export interface TaskLink {
  url: string;
  title?: string;
}

export interface TaskChecklistItem {
  text: string;
  checked: boolean;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  boardId: string;
  columnId: string;
  order: string;
  priority: TaskPriority;
  labels?: TaskLabel[];
  links?: TaskLink[];
  checklist?: TaskChecklistItem[];
  storyPoints?: number;
  dueDate?: string;
  assigneeIds: string[];
  storyPointVotingStatus?: StoryPointVotingStatus;
  storyPointVotes?: { userId: string; value: number }[];
  sprintId?: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type StoryPointVotingStatus = "idle" | "voting" | "revealed" | "locked";

export interface StoryPointVoteSummary {
  userId: string;
  value: number;
}

export interface StoryPointVotingState {
  totalVotes: number;
  myVote: number | null;
  average: number | null;
  votes: StoryPointVoteSummary[];
}

export type BoardColumnKind = 'workflow' | 'done' | 'archived';

export interface Column {
  _id: string;
  title: string;
  order: string;
  columnKind?: BoardColumnKind;
  tasks?: Task[];
}

export interface ArchivedBoardColumnSummary {
  _id: string;
  title: string;
  order: string;
  columnKind?: BoardColumnKind;
  archivedAt: string;
  archivedBy?: string;
}

export interface BoardSprintSummary {
  _id: string;
  name: string;
  startedAt: string;
  plannedEndAt?: string;
  objective?: string;
}

export interface ClosedSprintTaskSnapshot {
  taskId: string;
  title: string;
  columnId: string;
  columnTitleAtClose: string;
  wasCompleted: boolean;
  storyPointsWhenDone?: number;
  taskUpdatedAtAtClose?: string;
  assigneeIdsAtClose?: string[];
  labelsAtClose?: TaskLabel[];
}

export interface ClosedSprintRecord {
  sprintId: string;
  sprintName: string;
  closedAt: string;
  startedAt?: string;
  plannedEndAt?: string;
  objective?: string;
  taskSnapshots: ClosedSprintTaskSnapshot[];
}

export type BoardActivityEntityType =
  | 'board'
  | 'column'
  | 'task'
  | 'sprint'
  | 'member';

export interface BoardActivityEntry {
  _id: string;
  boardId: string;
  actorUserId: string;
  actorUsername?: string;
  actorEmail: string;
  actorAvatarUrl?: string;
  entityType: BoardActivityEntityType;
  action: string;
  message: string;
  entityId?: string;
  createdAt: string;
}

export interface BoardMember {
  user: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface Board {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  owner: string;
  members: BoardMember[];
  columns: Column[];
  archivedColumns?: ArchivedBoardColumnSummary[];
  sprintsEnabled?: boolean;
  sprints?: BoardSprintSummary[];
  activeSprintId?: string;
  closedSprintRecords?: ClosedSprintRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  boardId: string;
  columnId: string;
  order: string;
  sprintId?: string;
}

export interface UpdateTaskPositionPayload {
  newColumnId: string;
  newOrder: string;
}

export interface CreateBoardPayload {
  title: string;
  description?: string;
}

export interface UpdateBoardPayload {
  title?: string;
  description?: string;
  sprintsEnabled?: boolean;
}

// Intenta sacar id estable del tablero para llamadas a API
export function getBoardDocumentId(
  board: Pick<Board, "_id"> & { id?: string },
): string | null {
  const raw = board._id ?? board.id;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw);
}

// Lee el owner del tablero aunque venga string u objeto
export function boardOwnerUserId(board: Board): string {
  const ownerRaw = board.owner as unknown;
  if (typeof ownerRaw === "string") return ownerRaw;
  if (ownerRaw && typeof ownerRaw === "object" && "_id" in (ownerRaw as object))
    return String((ownerRaw as { _id: string })._id);
  return "";
}

// Normaliza referencia de miembro a string de usuario
export function memberUserId(member: BoardMember): string {
  const userRef = member.user as unknown;
  return typeof userRef === "string" ? userRef : String(userRef);
}

export type BoardInviteRole = "admin" | "editor" | "viewer";

export interface InviteBoardMemberPayload {
  userId: string;
  role: BoardInviteRole;
}

export interface BoardMemberSummary {
  userId: string;
  username: string;
  email: string;
  avatarUrl?: string;
  userPlan?: string;
  role: BoardRole;
}

export type BoardRole = BoardMember["role"];

const BOARD_ROLE_RANK: Record<BoardRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function isAppAdminUser(
  user: { role: string } | null | undefined,
): boolean {
  return user?.role === "admin";
}

// Resuelve rol del usuario en tablero actual
export function getCurrentUserBoardRole(
  board: Board,
  userId: string | undefined,
): BoardRole | null {
  if (!userId) return null;
  if (boardOwnerUserId(board) === userId) return "owner";
  const member = board.members.find(
    (entry) => memberUserId(entry) === userId,
  );
  return member?.role ?? null;
}

export function boardRoleAtLeast(
  role: BoardRole | null,
  min: BoardRole,
): boolean {
  if (!role) return false;
  return BOARD_ROLE_RANK[role] >= BOARD_ROLE_RANK[min];
}

// Permite editar contenido del tablero como tareas y columnas
export function canEditBoardContent(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const roleOnBoard = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(roleOnBoard, "editor");
}

// Permite editar ajustes sensibles del tablero
export function canEditBoardSettings(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const roleOnBoard = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(roleOnBoard, "admin");
}

// Solo owner o admin global puede eliminar tablero
export function canDeleteBoard(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  return boardOwnerUserId(board) === user.id;
}

// Un miembro puede salir excepto si es owner
export function canMemberLeaveBoard(
  board: Board,
  user: { id: string; role?: string } | null | undefined,
): boolean {
  if (!user) return false;
  const roleOnBoard = getCurrentUserBoardRole(board, user.id);
  if (roleOnBoard === null) return false;
  if (roleOnBoard === 'owner') return false;
  return true;
}

// Controla gestion de miembros e invitaciones del tablero
export function canManageBoardMembers(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const roleOnBoard = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(roleOnBoard, "admin");
}

export function canInviteToBoard(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  return canManageBoardMembers(board, user);
}