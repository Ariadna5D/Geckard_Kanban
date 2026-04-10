import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveBoardStore } from '../store/useActiveBoardStore';
import { useAuthStore } from '../store/useAuthStore';
import { BoardColumn } from '../components/board/BoardColumn';
import { BoardShareDialog } from '../components/board/BoardShareDialog';
import { BoardSettingsSheet } from '../components/board/BoardSettingsSheet';
import { InlineCreateForm } from '../components/shared/InlineCreateForm';
import {
  canEditBoardContent,
  canInviteToBoard,
} from '../types/board.types';
import { Button } from '@/components/ui/button';
import { Loader2, Settings, UserPlus } from 'lucide-react';
import { calculateNewOrder } from '../utils/boardMath';
import {
  computeTaskDropOrder,
  createBoardCollisionDetection,
  destinationColumnIdFromDroppable,
  type ColumnDropPayload,
  type TaskDropPayload,
} from '../utils/boardDnd';
import { Column } from '../types/board.types';

// DND-KIT
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from '../components/board/TaskCard';
import type { Task } from '../types/board.types';

function columnIndexById(columns: Column[], id: string): number {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i]._id === id) {
      return i;
    }
  }
  return -1;
}

export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore(function selectUser(s) {
    return s.user;
  });
  const {
    board,
    isLoading,
    error,
    fetchBoard,
    addColumn,
    moveTaskOptimistic,
    moveColumnOptimistic,
  } = useActiveBoardStore();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /**
   * El primer render ocurre ANTES de useLayoutEffect/useEffect. Sin esto, con
   * `isLoading` aún false y `board` null (estado inicial del store), `!board`
   * redirige al dashboard en F5 o recarga directa en /boards/:slug.
   */
  const [fetchSettled, setFetchSettled] = useState(false);

  useLayoutEffect(() => {
    if (!slug) return;
    setFetchSettled(false);
    useActiveBoardStore.setState({
      isLoading: true,
      error: null,
      board: null,
      boardMembers: [],
    });
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;
    void fetchBoard(slug).finally(() => {
      if (isMounted) setFetchSettled(true);
    });
    return () => {
      isMounted = false;
    };
  }, [slug, fetchBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnIds = useMemo(() => {
    if (!board) return [];
    const ids: string[] = [];
    for (let i = 0; i < board.columns.length; i++) {
      ids.push(board.columns[i]._id);
    }
    return ids;
  }, [board]);

  const collisionDetection = useMemo(
    () => createBoardCollisionDetection(board),
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

  /**
   * Maneja el fin del drag para columnas y tareas.
   * Se apoya en moveColumnOptimistic / moveTaskOptimistic del store.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setActiveColumn(null);

    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;

    const activeType = active.data.current?.type;

    const overData = over.data.current as
      | ColumnDropPayload
      | TaskDropPayload
      | undefined;

    // --- Reorden de columnas ---
    if (activeType === 'Column') {
      const oldIndex = columnIndexById(board.columns, activeId);
      const newIndex = columnIndexById(board.columns, overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const tempColumns = [...board.columns];
      const [movedColumn] = tempColumns.splice(oldIndex, 1);
      tempColumns.splice(newIndex, 0, movedColumn);

      const prevCol = newIndex > 0 ? tempColumns[newIndex - 1] : null;
      const nextCol = newIndex < tempColumns.length - 1 ? tempColumns[newIndex + 1] : null;
      
      // Evita colisión de índices cuando dos columnas comparten order.
      const prevOrder = prevCol?.order;
      const nextOrder = (nextCol?.order === prevOrder) ? null : nextCol?.order;
      
      const newOrder = calculateNewOrder(prevOrder || null, nextOrder || null);
      moveColumnOptimistic(board._id, activeId, newOrder);
      return;
    }

    // --- Reorden/movimiento de tareas ---
    if (activeType === 'Task') {
      const sourceColumnId = active.data.current?.task?.columnId;
      const activeTask = active.data.current?.task as Task | undefined;
      const destColumnId = destinationColumnIdFromDroppable(overData);

      if (!sourceColumnId || !destColumnId || !activeTask) return;

      const isBelowOver = Boolean(
        over &&
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height / 2,
      );

      const nextOrder = computeTaskDropOrder(board, {
        activeTask,
        activeId,
        destColumnId,
        overId,
        overData,
        isBelowOver,
      });
      if (nextOrder == null) return;

      moveTaskOptimistic(activeId, sourceColumnId, destColumnId, nextOrder, {
        newColumnId: destColumnId,
        newOrder: nextOrder,
      });
    }
  };

  const handleCreateColumn = (title: string) => {
    const columns = board?.columns || [];
    const lastCol = columns.length > 0 ? columns[columns.length - 1] : null;
    const newOrder = calculateNewOrder(lastCol?.order || null, null);
    addColumn(board!._id, title, newOrder);
  };

  function handleOpenSettings() {
    setSettingsOpen(true);
  }

  function handleOpenShare() {
    setShareOpen(true);
  }

  if (!slug) return <Navigate to="/dashboard" replace />;

  if (!fetchSettled || isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-100 dark:bg-surface-950">
        <Loader2 className="size-8 animate-spin text-surface-400 dark:text-surface-500" />
      </div>
    );
  }

  if (error) return <Navigate to="/dashboard" replace />;
  if (!board) return <Navigate to="/dashboard" replace />;

  const canEdit = user ? canEditBoardContent(board, user) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface-100 dark:bg-surface-950">
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-surface-200 bg-surface-50 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 dark:border-surface-800 dark:bg-surface-900">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="min-w-0 truncate text-xl font-bold text-surface-900 dark:text-surface-50">
            {board.title}
          </h1>
          {!canEdit && (
            <span className="hidden shrink-0 rounded-md border border-surface-200 bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600 sm:inline dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400">
              Solo lectura
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user && slug && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
                onClick={handleOpenSettings}
                aria-label="Configuración del tablero"
              >
                <Settings className="size-4" />
              </Button>
              <BoardSettingsSheet
                board={board}
                slug={slug}
                user={user}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
              />
            </>
          )}
          {user && canInviteToBoard(board, user) && slug && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
                onClick={handleOpenShare}
              >
                <UserPlus data-icon="inline-start" />
                Compartir
              </Button>
              <BoardShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                slug={slug}
                boardId={board._id}
              />
            </>
          )}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-100 dark:bg-surface-950">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex h-full min-h-0 min-w-min items-stretch gap-4 sm:gap-6">
              <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                {board.columns.map((column) => (
                  <BoardColumn
                    key={column._id}
                    column={column}
                    boardId={board._id}
                    canEdit={canEdit}
                  />
                ))}
              </SortableContext>
              {canEdit && (
                <div className="kanban-column-width">
                  <InlineCreateForm actionText="Add column" onSubmit={handleCreateColumn} />
                </div>
              )}
            </div>
          </div>
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isOverlay />}
            {activeColumn && (
               <div className="kanban-column-width rotate-2 rounded-xl border-2 border-primary-500/40 bg-surface-50 p-4 opacity-95 shadow-2xl ring-2 ring-primary-500/20 dark:border-primary-400/35 dark:bg-surface-900 dark:ring-primary-400/15">
                 <h3 className="font-semibold text-surface-900 dark:text-surface-50">{activeColumn.title}</h3>
               </div>
            )}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
