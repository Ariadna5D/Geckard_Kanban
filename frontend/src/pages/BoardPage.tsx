import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveBoardStore } from '../store/useActiveBoardStore';
import { BoardColumn } from '../components/board/BoardColumn';
import { InlineCreateForm } from '../components/shared/InlineCreateForm';
import { Loader2 } from 'lucide-react';
import { calculateNewOrder } from '../utils/boardMath';
import { Task, Column } from '../types/board.types';

// DND-KIT
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from '../components/board/TaskCard';

export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { 
    board, 
    isLoading, 
    error, 
    fetchBoard, 
    addColumn, 
    moveTaskOptimistic, 
    moveColumnOptimistic 
  } = useActiveBoardStore();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);

  /**
   * El primer render ocurre ANTES de useLayoutEffect/useEffect. Sin esto, con
   * `isLoading` aún false y `board` null (estado inicial del store), `!board`
   * redirige al dashboard en F5 o recarga directa en /boards/:slug.
   */
  const [fetchSettled, setFetchSettled] = useState(false);

  useLayoutEffect(() => {
    if (!slug) return;
    setFetchSettled(false);
    useActiveBoardStore.setState({ isLoading: true, error: null, board: null });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    void fetchBoard(slug).finally(() => {
      if (alive) setFetchSettled(true);
    });
    return () => {
      alive = false;
    };
  }, [slug, fetchBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnIds = board?.columns.map((c) => c._id) || [];

  /**
   * Si no filtramos, al arrastrar una columna `closestCorners` choca casi siempre
   * con las tareas (más superficie) y `over.id` deja de ser un id de columna:
   * el reorden horizontal y la previsualización solo encajan al inicio/final.
   */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const draggingColumn = args.active.data.current?.type === 'Column';
      if (draggingColumn && board) {
        const columnIdSet = new Set(board.columns.map((c) => c._id));
        const onlyColumns = args.droppableContainers.filter((c) =>
          columnIdSet.has(String(c.id)),
        );
        if (onlyColumns.length > 0) {
          return closestCorners({ ...args, droppableContainers: onlyColumns });
        }
      }
      return closestCorners(args);
    },
    [board],
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Task') {
      setActiveTask(active.data.current.task);
    } else if (active.data.current?.type === 'Column') {
      setActiveColumn(active.data.current.column);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setActiveColumn(null);

    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;

    const activeType = active.data.current?.type;
    const overData = over.data.current as any;

    // --- LÓGICA DE COLUMNAS (HORIZONTAL) ---
    if (activeType === 'Column') {
      const oldIndex = board.columns.findIndex((c) => c._id === activeId);
      const newIndex = board.columns.findIndex((c) => c._id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const tempColumns = [...board.columns];
      const [movedColumn] = tempColumns.splice(oldIndex, 1);
      tempColumns.splice(newIndex, 0, movedColumn);

      const prevCol = newIndex > 0 ? tempColumns[newIndex - 1] : null;
      const nextCol = newIndex < tempColumns.length - 1 ? tempColumns[newIndex + 1] : null;
      
      // Seguridad: Si los órdenes son iguales, forzamos un valor nulo para recalcular
      const prevOrder = prevCol?.order;
      const nextOrder = (nextCol?.order === prevOrder) ? null : nextCol?.order;
      
      const newOrder = calculateNewOrder(prevOrder || null, nextOrder || null);
      moveColumnOptimistic(board._id, activeId, newOrder);
      return;
    }

    // --- LÓGICA DE TAREAS (VERTICAL) ---
    if (activeType === 'Task') {
      const sourceColumnId = active.data.current?.task?.columnId;
      const destColumnId = overData?.type === 'Column' ? overData.column._id : overData.task.columnId;

      if (!sourceColumnId || !destColumnId) return;

      const destCol = board.columns.find(c => c._id === destColumnId);
      if (!destCol) return;
      const destTasks = destCol.tasks || [];

      let newOrder = '';

      // Calculamos la posición real dentro del array de destino
      const oldIndexInDest = destTasks.findIndex(t => t._id === activeId);
      const overIndex = destTasks.findIndex(t => t._id === overId);

      // Usamos la posición del puntero para saber si insertar arriba o abajo
      const isBelow = over && active.rect.current.translated && 
                      active.rect.current.translated.top > over.rect.top + over.rect.height / 2;

      let tempTasks = [...destTasks];
      if (oldIndexInDest !== -1) tempTasks.splice(oldIndexInDest, 1);

      // Encontrar el nuevo índice de inserción
      let insertIndex = overIndex === -1 ? tempTasks.length : overIndex;
      if (isBelow && overIndex !== -1) insertIndex++;

      tempTasks.splice(insertIndex, 0, active.data.current?.task);

      const prev = insertIndex > 0 ? tempTasks[insertIndex - 1] : null;
      const next = insertIndex < tempTasks.length - 1 ? tempTasks[insertIndex + 1] : null;

      // Seguridad anti "a0 >= a0"
      const prevOrder = prev?.order;
      const nextOrder = (next?.order === prevOrder) ? null : next?.order;

      newOrder = calculateNewOrder(prevOrder || null, nextOrder || null);
      
      moveTaskOptimistic(activeId, sourceColumnId, destColumnId, newOrder, { newColumnId: destColumnId, newOrder });
    }
  };

  const handleCreateColumn = (title: string) => {
    const columns = board?.columns || [];
    const lastCol = columns.length > 0 ? columns[columns.length - 1] : null;
    const newOrder = calculateNewOrder(lastCol?.order || null, null);
    addColumn(board!._id, title, newOrder);
  };

  if (!slug) return <Navigate to="/dashboard" replace />;

  if (!fetchSettled || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-100 dark:bg-surface-950">
        <Loader2 className="size-8 animate-spin text-surface-400 dark:text-surface-500" />
      </div>
    );
  }

  if (error) return <Navigate to="/dashboard" replace />;
  if (!board) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex h-screen flex-col bg-surface-100 dark:bg-surface-950">
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-surface-200 bg-surface-50 px-8 py-4 dark:border-surface-800 dark:bg-surface-900">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50">{board.title}</h1>
      </header>

      <main className="flex-1 overflow-x-auto bg-surface-100 p-8 dark:bg-surface-950">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full items-start">
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {board.columns.map((column) => (
                <BoardColumn key={column._id} column={column} boardId={board._id} />
              ))}
            </SortableContext>
            <div className="shrink-0 w-80">
              <InlineCreateForm actionText="Add column" onSubmit={handleCreateColumn} />
            </div>
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isOverlay />}
            {activeColumn && (
               <div className="w-80 rotate-2 rounded-xl border-2 border-primary-500/40 bg-surface-50 p-4 opacity-95 shadow-2xl ring-2 ring-primary-500/20 dark:border-primary-400/35 dark:bg-surface-900 dark:ring-primary-400/15">
                 <h3 className="font-semibold text-surface-900 dark:text-surface-50">{activeColumn.title}</h3>
               </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};