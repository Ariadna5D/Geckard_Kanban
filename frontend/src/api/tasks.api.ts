import api from './axios.instance';
import { Task, CreateTaskPayload, UpdateTaskPositionPayload } from '../types/board.types';

export const getTasksByBoardRequest = async (boardId: string): Promise<Task[]> => {
  const response = await api.get(`/tasks/board/${boardId}`);
  return response.data;
};

// Renombrada a createTaskRequest para coincidir con Zustand
export const createTaskRequest = async (data: CreateTaskPayload): Promise<Task> => {
  const response = await api.post('/tasks', data);
  return response.data;
};

// Esta la dejamos igual porque en Zustand la importamos así
export const updateTaskPosition = async (
  taskId: string, 
  data: UpdateTaskPositionPayload
): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}/position`, data);
  return response.data;
};

// Nueva: Para cuando editemos el texto o detalles de la tarjeta en el futuro
export const updateTaskRequest = async (taskId: string, data: Partial<Task>): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}`, data);
  return response.data;
};

// Renombrada a deleteTaskRequest para coincidir con Zustand
export const deleteTaskRequest = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};