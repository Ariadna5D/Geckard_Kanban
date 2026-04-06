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
  /** Lista de tableros visibles para el usuario autenticado. */
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  /** Carga inicial del dashboard. */
  fetchBoards: () => Promise<void>;
  /** Crea tablero y lo inserta en la lista local. */
  addBoard: (data: CreateBoardPayload) => Promise<void>;
  /** Edita título/descripción de un tablero existente. */
  updateBoard: (id: string, data: UpdateBoardPayload) => Promise<void>;
  /** Elimina tablero del backend y del estado local. */
  removeBoard: (id: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  isLoading: false,
  error: null,

  fetchBoards: async () => {
    // Estado de carga global de la pantalla dashboard.
    set({ isLoading: true, error: null });
    try {
      const boards = await getBoardsRequest();
      set({ boards, isLoading: false });
    } catch {
      set({ error: 'Error al cargar los tableros. Inténtalo de nuevo.', isLoading: false });
    }
  },

  addBoard: async (data: CreateBoardPayload) => {
    set({ isLoading: true, error: null });
    try {
      const newBoard = await createBoardRequest(data);
      // Nuevo tablero arriba para feedback inmediato al usuario.
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
        boards: state.boards.map((board) =>
          board._id === id ? { ...board, ...updated } : board,
        ),
      }));
      // Sincroniza también el tablero activo si está abierto en /boards/:slug.
      const active = useActiveBoardStore.getState().board;
      if (active?._id === id) {
        useActiveBoardStore.setState((storeState) =>
          storeState.board
            ? {
                board: {
                  ...storeState.board,
                  title: updated.title,
                  description: updated.description,
                },
              }
            : {},
        );
      }
    } catch (error) {
      set({ error: 'No se pudo actualizar el tablero.' });
      throw error;
    }
  },

  removeBoard: async (id: string) => {
    set({ error: null });
    try {
      await deleteBoardRequest(id);
      set((state) => ({
        boards: state.boards.filter((board) => board._id !== id),
      }));
      // Si borra el tablero activo, limpiamos su estado para evitar datos huérfanos.
      const active = useActiveBoardStore.getState().board;
      if (active?._id === id) {
        useActiveBoardStore.setState({ board: null, error: null });
      }
    } catch (error) {
      set({ error: 'No se pudo eliminar el tablero.' });
      throw error;
    }
  },
}));