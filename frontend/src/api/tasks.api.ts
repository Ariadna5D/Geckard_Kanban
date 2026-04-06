import api from './axios.instance';
import {
  Task,
  CreateTaskPayload,
  UpdateTaskPositionPayload,
  StoryPointVotingState,
} from '../types/board.types';

/** Devuelve tareas del tablero ya autorizadas por backend. */
export const getTasksByBoardRequest = async (boardId: string): Promise<Task[]> => {
  const response = await api.get(`/tasks/board/${boardId}`);
  return response.data;
};

/** Crea tarea en columna concreta. */
export const createTaskRequest = async (data: CreateTaskPayload): Promise<Task> => {
  const response = await api.post('/tasks', data);
  return response.data;
};

/** Actualiza columna/order de una tarea (DnD). */
export const updateTaskPosition = async (
  taskId: string, 
  data: UpdateTaskPositionPayload
): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}/position`, data);
  return response.data;
};

/** Actualiza campos editables de tarea (title, description, labels, etc.). */
export const updateTaskRequest = async (taskId: string, data: Partial<Task>): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}`, data);
  return response.data;
};

/** Borra tarea por id. */
export const deleteTaskRequest = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

/** Lee estado de votación de story points de una tarea. */
export const getStoryPointVotingRequest = async (
  taskId: string,
): Promise<StoryPointVotingState> => {
  const response = await api.get(`/tasks/${taskId}/story-points`);
  return response.data;
};

/** Registra o actualiza voto personal de story points. */
export const voteStoryPointsRequest = async (
  taskId: string,
  value: number,
): Promise<void> => {
  await api.patch(`/tasks/${taskId}/story-points/vote`, { value });
};