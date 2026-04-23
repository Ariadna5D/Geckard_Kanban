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

/** Devuelve solo tareas archivadas del tablero (panel de archivo). */
export const getArchivedTasksByBoardRequest = async (
  boardId: string,
): Promise<Task[]> => {
  const response = await api.get(`/tasks/board/${boardId}/archived`);
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

/** Actualiza campos editables de tarea (title, description, labels, sprintId con null para quitar, etc.). */
export const updateTaskRequest = async (
  taskId: string,
  data: Partial<Task> & { sprintId?: string | null },
): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}`, data);
  return response.data;
};

/** Archiva tarea por id (sale del tablero principal). */
export const deleteTaskRequest = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};

/** Restaura una tarea archivada al tablero. */
export const restoreTaskRequest = async (taskId: string): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}/restore`);
  return response.data;
};

/** Borrado definitivo (solo admin/owner). */
export const purgeTaskRequest = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}/purge`);
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