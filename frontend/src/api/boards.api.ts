// Fíjate que ahora importamos CreateBoardPayload
import {
  Board,
  CreateBoardPayload,
  UpdateBoardPayload,
  InviteBoardMemberPayload,
  BoardMemberSummary,
} from '../types/board.types';
import api from './axios.instance';

export const getBoardsRequest = async (): Promise<Board[]> => {
  const response = await api.get<Board[]>('/boards');
  return response.data;
};

export const createBoardRequest = async (data: CreateBoardPayload): Promise<Board> => {
  const response = await api.post<Board>('/boards', data);
  return response.data;
};

export const updateBoardRequest = async (
  id: string,
  data: UpdateBoardPayload,
): Promise<Board> => {
  const response = await api.patch<Board>(`/boards/${id}`, data);
  return response.data;
};

export const deleteBoardRequest = async (id: string): Promise<void> => {
  await api.delete(`/boards/${id}`);
};

export const getBoardBySlugRequest = async (slug: string): Promise<Board> => {
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
  const response = await api.post(`/boards/${boardId}/columns`, { title, order });
  return response.data;
};

/**
 * Renombra una columna existente.
 */
export const updateColumnRequest = async (
  boardId: string, 
  columnId: string, 
  title: string
): Promise<Board> => {
  const response = await api.patch(`/boards/${boardId}/columns/${columnId}`, { title });
  return response.data;
};

/**
 * Borra una columna y desencadena el borrado en cascada de sus tareas en el backend.
 */
export const deleteColumnRequest = async (
  boardId: string, 
  columnId: string
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

export const removeBoardMemberRequest = async (
  boardId: string,
  memberUserId: string,
): Promise<void> => {
  await api.delete(`/boards/${boardId}/members/${memberUserId}`);
};