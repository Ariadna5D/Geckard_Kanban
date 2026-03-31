import { create } from 'zustand';
import { Board, UpdateTaskPositionPayload } from '../types/board.types';
import { addColumnRequest, getBoardBySlugRequest } from '../api/boards.api';
import { updateTaskPosition } from '../api/tasks.api';

interface ActiveBoardState {
  board: Board | null;
  isLoading: boolean;
  error: string | null;

  // Acciones
  fetchBoard: (slug: string) => Promise<void>;
  
  // LA JOYA DE LA CORONA: El método optimista para el Drag & Drop
  moveTaskOptimistic: (
    taskId: string,
    oldColumnId: string,
    newColumnId: string,
    newOrder: number,
    apiPayload: UpdateTaskPositionPayload
  ) => Promise<void>;

  addColumn: (boardId: string, title: string) => Promise<void>;
}

export const useActiveBoardStore = create<ActiveBoardState>((set, get) => ({
  board: null,
  isLoading: false,
  error: null,

  // 1. CARGA INICIAL
  fetchBoard: async (slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const board = await getBoardBySlugRequest(slug);
      
      // Ordenamos las tareas de cada columna por su propiedad 'order' 
      // para asegurarnos de que se renderizan bien desde el principio
      const sortedColumns = board.columns.map(col => ({
        ...col,
        tasks: col.tasks?.sort((a, b) => a.order - b.order) || []
      }));

      set({ board: { ...board, columns: sortedColumns }, isLoading: false });
    } catch (error) {
      set({ error: 'Error al cargar el tablero.', isLoading: false });
    }
  },

  // 2. MOVIMIENTO OPTIMISTA (DRAG & DROP)
  moveTaskOptimistic: async (taskId, oldColumnId, newColumnId, newOrder, apiPayload) => {
    // A. Guardamos el estado actual como "copia de seguridad" por si la API falla
    const previousBoard = get().board;
    if (!previousBoard) return;

    // B. Clonamos el tablero (En React/Zustand NUNCA mutamos directamente el estado original)
    // Usamos JSON parse/stringify para hacer una "copia profunda" rápida
    const newBoard: Board = JSON.parse(JSON.stringify(previousBoard));

    // C. Buscamos las referencias a la columna origen y destino en nuestro clon
    const sourceCol = newBoard.columns.find(c => c._id === oldColumnId);
    const destCol = newBoard.columns.find(c => c._id === newColumnId);

    if (!sourceCol || !destCol) return;

    // D. Encontramos la tarea que estamos moviendo y la sacamos de su columna original
    const taskIndex = sourceCol.tasks!.findIndex(t => t._id === taskId);
    if (taskIndex === -1) return;
    
    const [taskToMove] = sourceCol.tasks!.splice(taskIndex, 1);

    // E. Actualizamos sus datos locales y la metemos en la nueva columna
    taskToMove.columnId = newColumnId;
    taskToMove.order = newOrder;
    destCol.tasks!.push(taskToMove);

    // F. Reordenamos la columna de destino para que la tarea se coloque en la ranura visual correcta
    destCol.tasks!.sort((a, b) => a.order - b.order);

    // G. ¡MAGIA! Actualizamos la pantalla en 0ms
    set({ board: newBoard });

    // H. Lanzamos la petición al backend de forma asíncrona (el usuario ya no está esperando)
    try {
      await updateTaskPosition(taskId, apiPayload);
      // Si va bien, no hacemos nada, la UI ya está actualizada.
    } catch (error) {
      // I. EL ROLLBACK: Si el backend da error (ej. se cayó el internet),
      // restauramos la copia de seguridad instantáneamente.
      console.error("Error al mover la tarea, revirtiendo cambios...", error);
      set({ board: previousBoard });
    }
  },
  addColumn: async (boardId: string, title: string) => {
    try {
      // Llamamos a la API. Recuerda que el backend nos devuelve el Board completo actualizado
      const updatedBoard = await addColumnRequest(boardId, title);
      
      // Aseguramos el orden de las tareas por si acaso (aunque estarán vacías al crear la columna)
      const sortedColumns = updatedBoard.columns.map(col => ({
        ...col,
        tasks: col.tasks?.sort((a, b) => a.order - b.order) || []
      }));

      // Actualizamos el estado global de golpe. React repintará la pantalla al instante.
      set({ board: { ...updatedBoard, columns: sortedColumns } });
    } catch (error) {
      console.error("Error al crear la columna:", error);
      // Aquí podríamos disparar un toast notification de error en el futuro
    }
  },
}));