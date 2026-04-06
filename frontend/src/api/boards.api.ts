// Fíjate que ahora importamos CreateBoardPayload
import {
  Board,
  CreateBoardPayload,
  UpdateBoardPayload,
  InviteBoardMemberPayload,
  BoardMemberSummary,
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

/** Expulsa miembro del tablero. */
export const removeBoardMemberRequest = async (
  boardId: string,
  memberUserId: string,
): Promise<void> => {
  await api.delete(`/boards/${boardId}/members/${memberUserId}`);
};