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
  addBoard: (boardData: CreateBoardPayload) => Promise<void>;
  updateBoard: (id: string, boardData: UpdateBoardPayload) => Promise<void>;
  removeBoard: (id: string) => Promise<void>;
}

export const useBoardStore = create<BoardState>((set) => ({
  boards: [],
  isLoading: false,
  error: null,

  // Carga los tableros disponibles para el usuario
  fetchBoards: async () => {
    set({ isLoading: true, error: null });
    try {
      // Carga tablero resumido para dashboard principal
      const boards = await getBoardsRequest();
      set({ boards, isLoading: false });
    } catch {
      set({ error: 'Error al cargar los tableros. Inténtalo de nuevo.', isLoading: false });
    }
  },

  // Crea un tablero y lo agrega al inicio de la lista
  addBoard: async (boardData: CreateBoardPayload) => {
    set({ isLoading: true, error: null });
    try {
      // Crea tablero y lo pone arriba para feedback inmediato
      const newBoard = await createBoardRequest(boardData);
      set((state) => ({
        boards: [newBoard, ...state.boards],
        isLoading: false,
      }));
    } catch (error) {
      set({ error: 'No se pudo crear el tablero.', isLoading: false });
      throw error;
    }
  },

  // Actualiza un tablero y sincroniza el tablero activo si aplica
  updateBoard: async (id: string, boardData: UpdateBoardPayload) => {
    set({ error: null });
    try {
      // Guarda cambios de tablero y actualiza lista local
      const updated = await updateBoardRequest(id, boardData);
      set((state) => ({
        boards: state.boards.map((board) =>
          board._id === id ? { ...board, ...updated } : board,
        ),
      }));
      const active = useActiveBoardStore.getState().board;
      if (active?._id === id) {
        // Sincroniza tambien tablero activo si coincide con el editado
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

  // Elimina un tablero de backend y de la lista local
  removeBoard: async (id: string) => {
    set({ error: null });
    try {
      // Borra en backend y lo quita de dashboard local
      await deleteBoardRequest(id);
      set((state) => ({
        boards: state.boards.filter((board) => board._id !== id),
      }));
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