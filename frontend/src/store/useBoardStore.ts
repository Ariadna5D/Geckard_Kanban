// src/store/useBoardStore.ts
import { create } from 'zustand';
import { Board, CreateBoardPayload } from '../types/board.types';
import { getBoardsRequest, createBoardRequest } from '../api/boards.api';

interface BoardState {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  // Acciones
  fetchBoards: () => Promise<void>;
  addBoard: (data: CreateBoardPayload) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  isLoading: false,
  error: null,

  fetchBoards: async () => {
    // Activamos el loading y limpiamos errores antes de empezar
    set({ isLoading: true, error: null });
    try {
      const boards = await getBoardsRequest();
      // Guardamos los tableros y quitamos el loading
      set({ boards, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar los tableros. Inténtalo de nuevo.', isLoading: false });
    }
  },

  addBoard: async (data: CreateBoardPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newBoard = await createBoardRequest(data);
      // Magia de Zustand: Actualizamos el estado inyectando el nuevo tablero 
      // al principio del array, manteniendo los que ya estaban (...state.boards).
      // Así la UI se actualiza al instante sin tener que hacer otro GET al backend.
      set((state) => ({
        boards: [newBoard, ...state.boards],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'No se pudo crear el tablero.', isLoading: false });
      // Lanzamos el error hacia arriba por si queremos mostrar un Toast/Alerta en el componente
      throw error; 
    }
  },
}));