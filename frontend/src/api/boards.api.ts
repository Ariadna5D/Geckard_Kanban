import {
  Board,
  CreateBoardPayload,
  UpdateBoardPayload,
  InviteBoardMemberPayload,
  BoardMemberSummary,
  BoardActivityEntry,
} from '../types/board.types';
import api from './axios.instance';

// Gestiona peticiones de tableros y sprints
export const getBoardsRequest = async (): Promise<Board[]> => {
  // Pide lista de tableros visibles para el usuario logueado
  const response = await api.get<Board[]>('/boards');
  return response.data;
};

export const createBoardRequest = async (data: CreateBoardPayload): Promise<Board> => {
  // Crea tablero nuevo y devuelve el registro guardado
  const response = await api.post<Board>('/boards', data);
  return response.data;
};

export const updateBoardRequest = async (
  id: string,
  data: UpdateBoardPayload,
): Promise<Board> => {
  // Actualiza datos principales del tablero por id
  const response = await api.patch<Board>(`/boards/${id}`, data);
  return response.data;
};

export const deleteBoardRequest = async (id: string): Promise<void> => {
  // Elimina tablero completo desde ajustes
  await api.delete(`/boards/${id}`);
};

export const getBoardBySlugRequest = async (slug: string): Promise<Board> => {
  // Carga tablero completo por slug para la vista principal
  const response = await api.get<Board>(
    `/boards/by-slug/${encodeURIComponent(slug)}`,
  );
  return response.data;
};

export const addColumnRequest = async (
  boardId: string, 
  title: string, 
  order: string 
): Promise<Board> => {
  // Crea columna y devuelve tablero actualizado desde backend
  const response = await api.post(`/boards/${boardId}/columns`, { title, order });
  return response.data;
};

export type UpdateColumnPayload = {
  title?: string;
  columnKind?: 'workflow' | 'done' | 'archived';
};

export const updateColumnRequest = async (
  boardId: string,
  columnId: string,
  payload: UpdateColumnPayload,
): Promise<Board> => {
  // Actualiza titulo o tipo de columna segun payload enviado
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

export const createSprintRequest = async (
  boardId: string,
  payload: CreateSprintPayload,
): Promise<Board> => {
  // Crea sprint activo en el tablero actual
  const response = await api.post<Board>(`/boards/${boardId}/sprints`, payload);
  return response.data;
};

export const closeSprintRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  // Cierra sprint activo y guarda su historial
  const response = await api.post<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}/close`,
  );
  return response.data;
};

export type UpdateActiveSprintPayload = {
  name?: string;
  startedAt?: string;
  plannedEndAt?: string;
  objective?: string;
};

export const updateActiveSprintRequest = async (
  boardId: string,
  sprintId: string,
  payload: UpdateActiveSprintPayload,
): Promise<Board> => {
  // Actualiza nombre, fechas u objetivo del sprint activo
  const response = await api.patch<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}`,
    payload,
  );
  return response.data;
};

export const cancelActiveSprintRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  // Cancela sprint activo y limpia vinculos en tareas
  const response = await api.delete<Board>(
    `/boards/${boardId}/sprints/${encodeURIComponent(sprintId)}`,
  );
  return response.data;
};

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

export const deleteClosedSprintHistoryRequest = async (
  boardId: string,
  sprintId: string,
): Promise<Board> => {
  const response = await api.delete<Board>(
    `/boards/${boardId}/sprints/history/${encodeURIComponent(sprintId)}`,
  );
  return response.data;
};

export const archiveColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/columns/${columnId}/archive`,
  );
  return response.data;
};

export const restoreArchivedColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.patch<Board>(
    `/boards/${boardId}/columns/${columnId}/restore`,
  );
  return response.data;
};

export const deleteColumnRequest = async (
  boardId: string,
  columnId: string,
): Promise<Board> => {
  const response = await api.delete(`/boards/${boardId}/columns/${columnId}`);
  return response.data;
};

export const updateColumnPositionRequest = async (
  boardId: string,
  columnId: string,
  order: string
): Promise<Board> => {
  const response = await api.patch(`/boards/${boardId}/columns/${columnId}/position`, { order });
  return response.data;
};

export const inviteBoardMemberRequest = async (
  boardId: string,
  payload: InviteBoardMemberPayload,
): Promise<Board> => {
  const response = await api.post<Board>(`/boards/${boardId}/members`, payload);
  return response.data;
};

export const getBoardMembersRequest = async (
  boardId: string,
): Promise<{ ownerId: string; members: BoardMemberSummary[] }> => {
  const response = await api.get<{ ownerId: string; members: BoardMemberSummary[] }>(
    `/boards/${boardId}/members`,
  );
  return response.data;
};

export const getBoardActivityRequest = async (
  boardId: string,
  limit = 60,
): Promise<BoardActivityEntry[]> => {
  // Pide actividad reciente con limite para no cargar lista gigante
  const response = await api.get<BoardActivityEntry[]>(
    `/boards/${boardId}/activity`,
    { params: { limit } },
  );
  return response.data;
};

export const removeBoardMemberRequest = async (
  boardId: string,
  memberUserId: string,
): Promise<void> => {
  await api.delete(`/boards/${boardId}/members/${memberUserId}`);
};

export const leaveBoardRequest = async (boardId: string): Promise<void> => {
  await api.delete(`/boards/${boardId}/leave`);
};
