export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: string;
  title: string;
  description: string;
  boardId: string;
  columnId: string;
  order: string;
  priority: TaskPriority;
  storyPoints?: number;
  dueDate?: string;
  assigneeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  _id: string;
  title: string;
  order: string;
  tasks?: Task[]; 
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
  createdAt: string;
  updatedAt: string;
}

// --- DTOs del Frontend ---

export interface CreateTaskPayload {
  title: string;
  boardId: string;
  columnId: string;
}

export interface UpdateTaskPositionPayload {
  newColumnId: string;
  newOrder: string;
}

export interface CreateBoardPayload {
  title: string;
  description?: string;
}

/** PATCH /boards/:id — el slug no se expone en el DTO (permanece fijo tras crear). */
export interface UpdateBoardPayload {
  title?: string;
  description?: string;
}

/** `_id` del documento en Mongo (PATCH/DELETE /boards/:id). */
export function getBoardDocumentId(
  board: Pick<Board, "_id"> & { id?: string },
): string | null {
  const raw = board._id ?? board.id;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw);
}

export function boardOwnerUserId(board: Board): string {
  const o = board.owner as unknown;
  if (typeof o === "string") return o;
  if (o && typeof o === "object" && "_id" in (o as object))
    return String((o as { _id: string })._id);
  return "";
}

export function memberUserId(m: BoardMember): string {
  const u = m.user as unknown;
  return typeof u === "string" ? u : String(u);
}

/** Roles asignables al invitar (el owner no se invita por este flujo). */
export type BoardInviteRole = "admin" | "editor" | "viewer";

export interface InviteBoardMemberPayload {
  userId: string;
  role: BoardInviteRole;
}

/** Respuesta de GET /boards/:id/members */
export interface BoardMemberSummary {
  userId: string;
  username: string;
  email: string;
  avatarUrl?: string;
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

/** Rol del usuario en el tablero (el owner cuenta como `owner` aunque esté en `members`). */
export function getCurrentUserBoardRole(
  board: Board,
  userId: string | undefined,
): BoardRole | null {
  if (!userId) return null;
  if (boardOwnerUserId(board) === userId) return "owner";
  const m = board.members.find((x) => memberUserId(x) === userId);
  return m?.role ?? null;
}

export function boardRoleAtLeast(
  role: BoardRole | null,
  min: BoardRole,
): boolean {
  if (!role) return false;
  return BOARD_ROLE_RANK[role] >= BOARD_ROLE_RANK[min];
}

/** Crear/editar/mover tareas y columnas (no lectores). */
export function canEditBoardContent(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const r = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(r, "editor");
}

/** Título / descripción del tablero (admin del tablero o superior). */
export function canEditBoardSettings(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const r = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(r, "admin");
}

/** Solo el propietario (o admin de la app) puede borrar el tablero. */
export function canDeleteBoard(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  return boardOwnerUserId(board) === user.id;
}

/**
 * Puede gestionar miembros del tablero: invitar, cambiar roles y expulsar.
 *
 * Permitido: administrador de la plataforma (`user.role === 'admin'`),
 * propietario del tablero (`owner`) o miembro con rol **administrador del tablero**
 * (`admin` — co-admin, equivalente a un “moderador” del tablero).
 *
 * **No** pueden: rol `editor` ni `viewer` (solo colaboran o leen).
 */
export function canManageBoardMembers(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAppAdminUser(user)) return true;
  const r = getCurrentUserBoardRole(board, user.id);
  return boardRoleAtLeast(r, "admin");
}

/** Mismo criterio que {@link canManageBoardMembers}: solo quien puede invitar al tablero. */
export function canInviteToBoard(
  board: Board,
  user: { id: string; role: string } | null | undefined,
): boolean {
  return canManageBoardMembers(board, user);
}