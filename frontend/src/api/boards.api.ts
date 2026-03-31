// Fíjate que ahora importamos CreateBoardPayload
import { Board, CreateBoardPayload } from '../types/board.types';
import api from './axios.instance';

export const getBoardsRequest = async (): Promise<Board[]> => {
  const response = await api.get<Board[]>('/boards');
  return response.data;
};

export const createBoardRequest = async (data: CreateBoardPayload): Promise<Board> => {
  const response = await api.post<Board>('/boards', data);
  return response.data;
};

export const getBoardBySlugRequest = async (slug: string): Promise<Board> => {
  const response = await api.get(`/boards/${slug}`);
  return response.data;
};

export const addColumnRequest = async (boardId: string, title: string): Promise<Board> => {
  const response = await api.post<Board>(`/boards/${boardId}/columns`, { title });
  return response.data;
};

export const updateColumnRequest = async (
  boardId: string, 
  columnId: string, 
  title: string
): Promise<Board> => {
  const response = await api.patch<Board>(`/boards/${boardId}/columns/${columnId}`, { title });
  return response.data;
};

export const deleteColumnRequest = async (boardId: string, columnId: string): Promise<Board> => {
  const response = await api.delete<Board>(`/boards/${boardId}/columns/${columnId}`);
  return response.data;
};