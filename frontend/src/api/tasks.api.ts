import api from './axios.instance';
import {
  Task,
  CreateTaskPayload,
  UpdateTaskPositionPayload,
  StoryPointVotingState,
} from '../types/board.types';

export const getTasksByBoardRequest = async (boardId: string): Promise<Task[]> => {
  // Trae tareas activas del tablero para pintar columnas
  const response = await api.get(`/tasks/board/${boardId}`);
  return response.data;
};

export const getArchivedTasksByBoardRequest = async (
  boardId: string,
): Promise<Task[]> => {
  // Trae tareas archivadas para la vista de limpieza
  const response = await api.get(`/tasks/board/${boardId}/archived`);
  return response.data;
};

export const createTaskRequest = async (
  createPayload: CreateTaskPayload,
): Promise<Task> => {
  // Crea tarea nueva en backend y devuelve entidad creada
  const response = await api.post('/tasks', createPayload);
  return response.data;
};

export const updateTaskPosition = async (
  taskId: string,
  positionPayload: UpdateTaskPositionPayload,
): Promise<Task> => {
  // Guarda nueva posicion despues de drag and drop
  const response = await api.patch(`/tasks/${taskId}/position`, positionPayload);
  return response.data;
};

export type UpdateTaskRequestBody = Partial<Omit<Task, 'sprintId'>> & {
  sprintId?: string | null;
};

export const updateTaskRequest = async (
  taskId: string,
  patchBody: UpdateTaskRequestBody,
): Promise<Task> => {
  // Envia patch parcial de tarea para cambios de detalle
  const response = await api.patch(`/tasks/${taskId}`, patchBody);
  return response.data;
};

export const deleteTaskRequest = async (taskId: string): Promise<void> => {
  // Archiva tarea activa para ocultarla del flujo diario
  await api.delete(`/tasks/${taskId}`);
};

export const restoreTaskRequest = async (taskId: string): Promise<Task> => {
  // Restaura tarea archivada al flujo activo
  const response = await api.patch(`/tasks/${taskId}/restore`);
  return response.data;
};

export const purgeTaskRequest = async (taskId: string): Promise<void> => {
  // Elimina tarea archivada de forma definitiva
  await api.delete(`/tasks/${taskId}/purge`);
};

export const getStoryPointVotingRequest = async (
  taskId: string,
): Promise<StoryPointVotingState> => {
  // Consulta estado de votacion de story points
  const response = await api.get(`/tasks/${taskId}/story-points`);
  return response.data;
};

export const voteStoryPointsRequest = async (
  taskId: string,
  value: number,
): Promise<void> => {
  // Guarda voto del usuario para la sesion de planning poker
  await api.patch(`/tasks/${taskId}/story-points/vote`, { value });
};

export const clearStoryPointsVoteRequest = async (
  taskId: string,
): Promise<void> => {
  // Quita el voto del usuario actual en la sesion de planning poker
  await api.delete(`/tasks/${taskId}/story-points/vote`);
};