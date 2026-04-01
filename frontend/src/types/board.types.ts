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