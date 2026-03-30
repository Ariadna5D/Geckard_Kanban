import { Board, CreateBoardPayload } from '../types/board.types';
import axiosInstance from './axios.instance';


// Por qué hacer esto: Separar las llamadas a la API de los componentes de React 
// hace que el código sea testeable y reutilizable en cualquier parte de la app.

export const getBoardsRequest = async (): Promise<Board[]> => {
  const response = await axiosInstance.get<Board[]>('/boards');
  return response.data;
};

export const createBoardRequest = async (data: CreateBoardPayload): Promise<Board> => {
  const response = await axiosInstance.post<Board>('/boards', data);
  return response.data;
};