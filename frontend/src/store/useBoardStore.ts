// src/store/useBoardStore.ts
import { create } from 'zustand';
import { Board, CreateBoardPayload, UpdateBoardPayload } from '../types/board.types';
import {
  getBoardsRequest,
  createBoardRequest,
  updateBoardRequest,
  deleteBoardRequest,
} from '../api/boards.api';
import { useActiveBoardStore } from './useActiveBoardStore';

interface BoardState {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  fetchBoards: () => Promise<void>;
  addBoard: (data: CreateBoardPayload) => Promise<void>;
  updateBoard: (id: string, data: UpdateBoardPayload) => Promise<void>;
  removeBoard: (id: string) => Promise<void>;
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
      throw error;
    }
  },

  updateBoard: async (id: string, data: UpdateBoardPayload) => {
    set({ error: null });
    try {
      const updated = await updateBoardRequest(id, data);
      set((state) => ({
        boards: state.boards.map((b) => (b._id === id ? { ...b, ...updated } : b)),
      }));
      const active = useActiveBoardStore.getState().board;
      if (active?._id === id) {
        useActiveBoardStore.setState((s) =>
          s.board
            ? {
                board: {
                  ...s.board,
                  title: updated.title,
                  description: updated.description,
                },
              }
            : {},
        );
      }
    } catch (e) {
      set({ error: 'No se pudo actualizar el tablero.' });
      throw e;
    }
  },

  removeBoard: async (id: string) => {
    set({ error: null });
    try {
      await deleteBoardRequest(id);
      set((state) => ({
        boards: state.boards.filter((b) => b._id !== id),
      }));
      const active = useActiveBoardStore.getState().board;
      if (active?._id === id) {
        useActiveBoardStore.setState({ board: null, error: null });
      }
    } catch (e) {
      set({ error: 'No se pudo eliminar el tablero.' });
      throw e;
    }
  },
}));