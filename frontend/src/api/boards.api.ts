// Fíjate que ahora importamos CreateBoardPayload
import {
  Board,
  CreateBoardPayload,
  UpdateBoardPayload,
  InviteBoardMemberPayload,
  BoardMemberSummary,
  BoardActivityEntry,
} from '../types/board.types';
import api from './axios.instance';

/** Lista tableros accesibles para el usuario autenticado. */
export const getBoardsRequest = async (): Promise<Board[]> => {
  const response = await api.get<Board[]>('/boards');
  return response.data;
};

/** Crea tablero nuevo (título + descripción opcional). */
export const createBoardRequest = async (data: CreateBoardPayload): Promise<Board> => {
  const response = await api.post<Board>('/boards', data);
  return response.data;
};

/** Edita datos básicos del tablero. */
export const updateBoardRequest = async (
  id: string,
  data: UpdateBoardPayload,
): Promise<Board> => {
  const response = await api.patch<Board>(`/boards/${id}`, data);
  return response.data;
};

/** Borra un tablero por id de documento. */
export const deleteBoardRequest = async (id: string): Promise<void> => {
  await api.delete(`/boards/${id}`);
};

/** Carga tablero completo por slug (incluye columnas y tareas). */
export const getBoardBySlugRequest = async (slug: string): Promise<Board> => {
  const response = await api.get<Board>(
    `/boards/by-slug/${encodeURIComponent(slug)}`,
  );
  return response.data;
};

/** Añade columna al tablero con order pre-calculado en frontend. */
export const addColumnRequest = async (
  boardId: string, 
  title: string, 
  order: string 
): Promise<Board> => {
  const response = await api.post(`/boards/${boardId}/columns`, { title, order });
  return response.data;
};

/** PATCH /boards/:boardId/columns/:columnId — title and/or columnKind for sprint rules. */
export type UpdateColumnPayload = {
  title?: string;
  columnKind?: 'workflow' | 'done' | 'archived';
};

export const updateColumnRequest = async (
  boardId: string,
  columnId: string,
  payload: UpdateColumnPayload,
): Promise<Board> => {
  const response = await api.patch(
    `/boards/${boardId}/columns/${columnId}`,
    payload,
  );
  return response.data;
};

export type CreateSprintPayload = {
  name: string;
  startedAt?: string;
  plannedEndAt?: string;
  objective?: string;
};

/** POST /boards/:boardId/sprints — starts the single active sprint (board must enable sprints first). */
export const createSprintRequest = async (
  boardId: string,
  payload: CreateSprintPayload,
): Promise<Board> => {
  const response = await api.post<Board>(`/boards/${boardId}/sprints`, payload);
  return response.data;
};

/** POST /boards/:boardId/sprints/:sprintId/close — freezes snapshot and clears sprintId on tasks. */
export const closeSprintRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  const response = await api.post<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}/close`,
  );
  return response.data;
};

export type UpdateActiveSprintPayload = {
  name?: string;
  startedAt?: string;
  plannedEndAt?: string;
  /** Cadena vacía borra el objetivo en el servidor. */
  objective?: string;
};

/** PATCH active sprint (name / start / planned end). */
export const updateActiveSprintRequest = async (
  boardId: string,
  sprintId: string,
  payload: UpdateActiveSprintPayload,
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}`,
    payload,
  );
  return response.data;
};

/** DELETE active sprint without archiving (clears sprint tags on tasks). */
export const cancelActiveSprintRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  const response = await api.delete<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}`,
  );
  return response.data;
};

/** PATCH closed sprint display name (board admin). */
export const updateClosedSprintHistoryRequest = async (
  boardId: string,
  sprintId: string,
  payload: { sprintName: string },
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/sprints/history/${encodeURIComponent(sprintId)}`,
    payload,
  );
  return response.data;
};

/** DELETE one sprint from history (board admin). */
export const deleteClosedSprintHistoryRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  const response = await api.delete<Board>(
    `/boards/${boardId}/sprints/history/${encodeURIComponent(sprintId)}`,
  );
  return response.data;
};

/** Oculta la columna del tablero y archiva las tareas activas de esa columna. */
export const archiveColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/columns/${columnId}/archive`,
  );
  return response.data;
};

/** Devuelve una columna archivada al tablero y restaura las tareas archivadas con ella. */
export const restoreArchivedColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/columns/${columnId}/restore`,
  );
  return response.data;
};

/**
 * Elimina definitivamente una columna **ya archivada** y todas las tareas con ese columnId.
 */
export const deleteColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.delete(`/boards/${boardId}/columns/${columnId}`);
  return response.data;
};

/**
 * Actualiza la posición de una columna enviando su nuevo Fractional Index (order).
 */
export const updateColumnPositionRequest = async (
  boardId: string,
  columnId: string,
  order: string
): Promise<Board> => {
  const response = await api.patch(`/boards/${boardId}/columns/${columnId}/position`, { order });
  return response.data;
};

/** Invita usuario al tablero o actualiza su rol. */
export const inviteBoardMemberRequest = async (
  boardId: string,
  payload: InviteBoardMemberPayload,
): Promise<Board> => {
  const response = await api.post<Board>(`/boards/${boardId}/members`, payload);
  return response.data;
};

/** Lista owner y miembros para vista de participantes. */
export const getBoardMembersRequest = async (
  boardId: string,
): Promise<{ ownerId: string; members: BoardMemberSummary[] }> => {
  const response = await api.get<{ ownerId: string; members: BoardMemberSummary[] }>(
    `/boards/${boardId}/members`,
  );
  return response.data;
};

/** Historial de actividad del tablero (más reciente primero). */
export const getBoardActivityRequest = async (
  boardId: string,
  limit = 60,
): Promise<BoardActivityEntry[]> => {
  const response = await api.get<BoardActivityEntry[]>(
    `/boards/${boardId}/activity`,
    { params: { limit } },
  );
  return response.data;
};

/** Expulsa miembro del tablero. */
export const removeBoardMemberRequest = async (
  boardId: string,
  memberUserId: string,
): Promise<void> => {
  await api.delete(`/boards/${boardId}/members/${memberUserId}`);
};

/** El usuario autenticado abandona el tablero actual. */
export const leaveBoardRequest = async (boardId: string): Promise<void> => {
  await api.delete(`/boards/${boardId}/leave`);
};
