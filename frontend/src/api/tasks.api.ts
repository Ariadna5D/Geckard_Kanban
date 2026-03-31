import api from './axios.instance';
import { Task, CreateTaskPayload, UpdateTaskPositionPayload } from '../types/board.types';

export const getTasksByBoard = async (boardId: string): Promise<Task[]> => {
  const response = await api.get(`/tasks/board/${boardId}`);
  return response.data;
};

export const createTask = async (data: CreateTaskPayload): Promise<Task> => {
  const response = await api.post('/tasks', data);
  return response.data;
};

export const updateTaskPosition = async (
  taskId: string, 
  data: UpdateTaskPositionPayload
): Promise<Task> => {
  const response = await api.patch(`/tasks/${taskId}/position`, data);
  return response.data;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
};