import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  useRef,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, MoreHorizontal, RefreshCw, Settings, UserPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRefetchBoardWhenTabVisible } from '../hooks/useRefetchBoardWhenTabVisible';
import { BOARD_SILENT_POLL_INTERVAL_MS } from '../constants/boardRefetch';
import { calculateNewOrder } from '../utils/boardMath';
import {
  computeTaskDropOrder,
  createBoardCollisionDetection,
  destinationColumnIdFromDroppable,
  type ColumnDropPayload,
  type TaskDropPayload,
} from '../utils/boardDnd';
import { Column } from '../types/board.types';
import {
  applyBoardTaskFilter,
  collectTaskLabelOptionsFromBoard,
  sortTasksForBoardView,
  shouldLockTaskDrag,
  type BoardTaskFilter,
  type BoardTaskSortKey,
  type BoardSortDirection,
} from '../utils/boardTaskView';
import { BoardViewToolbar } from '../components/board/BoardViewToolbar';
import {
  BoardSprintHeaderControls,
  type BoardSprintHeaderControlsHandle,
  type SprintViewValue,
} from '../components/board/BoardSprintHeaderControls';
import {
  ClosedSprintHistoryView,
  type ClosedSprintFlowNavState,
} from '../components/board/ClosedSprintHistoryView';

// DND-KIT
import {
  DndContext,
  MouseSensor,
  TouchSensor,
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
  /** Evita doble clic mientras termina el refetch manual. */
  const [refreshBusy, setRefreshBusy] = useState(false);

  /**
   * El primer render ocurre ANTES de useLayoutEffect/useEffect. Sin esto, con
   * `isLoading` aún false y `board` null (estado inicial del store), `!board`
   * redirige al dashboard en F5 o recarga directa en /boards/:slug.
   */
  const [fetchSettled, setFetchSettled] = useState(false);
  /** Filtro de vista (solo sesión; no se persiste). */
  const [taskFilter, setTaskFilter] = useState<BoardTaskFilter>({ kind: 'all' });
  /** Orden dentro de cada columna en pantalla (solo sesión). */
  const [sortKey, setSortKey] = useState<BoardTaskSortKey>('manual');
  const [sortDirection, setSortDirection] =
    useState<BoardSortDirection>('asc');
  /** Sprint navigation: all tasks, active sprint filter, or read-only closed sprint. */
  const [sprintView, setSprintView] = useState<SprintViewValue>('all');

  const sprintHeaderRef = useRef<BoardSprintHeaderControlsHandle | null>(null);

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

  /**
   * Pide otra vez el tablero y la lista de miembros al API en segundo plano.
   * No activa `isLoading` del store (modo `silent`), así no tapas el tablero con el spinner grande.
   */
  const handleRefreshBoard = useCallback(async () => {
    if (!slug) return;
    setRefreshBusy(true);
    try {
      await fetchBoard(slug, { silent: true });
    } finally {
      setRefreshBusy(false);
    }
  }, [slug, fetchBoard]);

  const handleBoardSortChange = useCallback(
    (key: BoardTaskSortKey, dir: BoardSortDirection) => {
      setSortKey(key);
      setSortDirection(dir);
    },
    [],
  );

  /**
   * Cuando vuelves a esta pestaña, alineamos datos con el servidor (otro usuario, otro dispositivo).
   */
  useRefetchBoardWhenTabVisible({
    slug,
    fetchBoard,
    enabled: fetchSettled && Boolean(slug),
    pollIntervalMs: BOARD_SILENT_POLL_INTERVAL_MS,
  });

  /**
   * Sensores de drag:
   * - Mouse: mantiene experiencia actual en escritorio.
   * - Touch: requiere pulsación breve para no chocar con el scroll en móvil.
   */
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 160, tolerance: 8 },
    }),
  );

  const columnIds = useMemo(() => {
    if (!board) return [];
    const ids: string[] = [];
    for (let i = 0; i < board.columns.length; i++) {
      ids.push(board.columns[i]._id);
    }
    return ids;
  }, [board]);

  const boardLabelOptions = useMemo(
    () => collectTaskLabelOptionsFromBoard(board),
    [board],
  );

  const selectedClosedSprintRecord = useMemo(() => {
    if (!board || !sprintView.startsWith('closed:')) {
      return null;
    }
    const sprintHistoryId = sprintView.slice('closed:'.length);
    const list = board.closedSprintRecords ?? [];
    for (let index = 0; index < list.length; index++) {
      if (list[index].sprintId === sprintHistoryId) {
        return list[index];
      }
    }
    return null;
  }, [board, sprintView]);

  const closedSprintFlowNav = useMemo((): ClosedSprintFlowNavState | null => {
    if (!board || !selectedClosedSprintRecord) {
      return null;
    }
    const list = board.closedSprintRecords ?? [];
    let idx = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].sprintId === selectedClosedSprintRecord.sprintId) {
        idx = i;
        break;
      }
    }
    if (idx < 0) {
      return null;
    }
    const olderClosed = idx > 0 ? list[idx - 1]! : null;
    const newerClosed = idx < list.length - 1 ? list[idx + 1]! : null;
    const isNewestClosed = idx === list.length - 1;
    const userCanEdit = user ? canEditBoardContent(board, user) : false;
    const hasActive =
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0;

    let startNextSprintBlockedReason: string | null = null;
    if (!board.sprintsEnabled) {
      startNextSprintBlockedReason =
        'Activa los sprints en la configuración del tablero.';
    } else if (!userCanEdit) {
      startNextSprintBlockedReason =
        'Necesitas permisos de edición para iniciar un sprint.';
    } else if (hasActive) {
      startNextSprintBlockedReason =
        'Cierra o cancela el sprint activo antes de iniciar otro.';
    }

    const canStartNextSprint = startNextSprintBlockedReason === null;

    return {
      olderClosed,
      newerClosed,
      isNewestClosed,
      canStartNextSprint,
      startNextSprintBlockedReason,
    };
  }, [board, selectedClosedSprintRecord, user]);

  useEffect(() => {
    if (!board) {
      return;
    }
    if (!board.sprintsEnabled && sprintView !== 'all') {
      setSprintView('all');
      return;
    }
    if (sprintView === 'active') {
      const hasActive =
        typeof board.activeSprintId === 'string' &&
        board.activeSprintId.length > 0;
      if (!hasActive) {
        setSprintView('all');
      }
      return;
    }
    if (sprintView.startsWith('closed:')) {
      const sprintHistoryId = sprintView.slice('closed:'.length);
      const list = board.closedSprintRecords ?? [];
      let found = false;
      for (let index = 0; index < list.length; index++) {
        if (list[index].sprintId === sprintHistoryId) {
          found = true;
          break;
        }
      }
      if (!found) {
        setSprintView('all');
      }
    }
  }, [board, sprintView]);

  /**
   * Por columna: primero filtro (menú), luego orden de vista (menú).
   * El store sigue guardando el orden real (`task.order`) para cuando vuelves a “manual”.
   */
  const columnsWithVisibleTasks = useMemo(() => {
    if (!board) return [];
    const out: { column: Column; visibleTasks: Task[] }[] = [];
    for (let i = 0; i < board.columns.length; i++) {
      const column = board.columns[i];
      const afterFilter = applyBoardTaskFilter(column.tasks ?? [], taskFilter);
      let forSprintView = afterFilter;
      if (
        board.sprintsEnabled === true &&
        sprintView === 'active' &&
        typeof board.activeSprintId === 'string' &&
        board.activeSprintId.length > 0
      ) {
        const activeId = board.activeSprintId;
        const onlySprint: Task[] = [];
        for (let taskIndex = 0; taskIndex < afterFilter.length; taskIndex++) {
          const taskRow = afterFilter[taskIndex];
          if (taskRow.sprintId === activeId) {
            onlySprint.push(taskRow);
          }
        }
        forSprintView = onlySprint;
      }
      const visibleTasks = sortTasksForBoardView(
        forSprintView,
        sortKey,
        sortDirection,
      );
      out.push({ column, visibleTasks });
    }
    return out;
  }, [board, taskFilter, sortKey, sortDirection, sprintView]);

  /** Vista sprint activo = filtro visual; las tareas siguen siendo las mismas en el backend (cf. sprint cerrado = solo lectura). */
  const taskDragLocked = shouldLockTaskDrag(taskFilter, sortKey);
  const columnDragLocked = sprintView !== 'all';

  /** Detección de colisión custom: columnas solo contra columnas al reordenar. */
  const collisionDetection = useMemo(
    () => createBoardCollisionDetection(board),
    [board],
  );

  /** Guarda el elemento activo para dibujar su DragOverlay ("fantasma"). */
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
      if (columnDragLocked) {
        return;
      }
      // Índices actual y destino dentro del orden visual de columnas.
      const oldIndex = columnIndexById(board.columns, activeId);
      const newIndex = columnIndexById(board.columns, overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const tempColumns = [...board.columns];
      const [movedColumn] = tempColumns.splice(oldIndex, 1);
      tempColumns.splice(newIndex, 0, movedColumn);

      const prevCol = newIndex > 0 ? tempColumns[newIndex - 1] : null;
      const nextCol = newIndex < tempColumns.length - 1 ? tempColumns[newIndex + 1] : null;
      
      // Evita colisión de índices cuando dos columnas comparten la misma clave `order`.
      const prevOrder = prevCol?.order;
      const nextOrder = (nextCol?.order === prevOrder) ? null : nextCol?.order;
      
      // Genera nueva clave fraccional y persiste de forma optimista.
      const newOrder = calculateNewOrder(prevOrder || null, nextOrder || null);
      moveColumnOptimistic(board._id, activeId, newOrder);
      return;
    }

    // --- Reorden/movimiento de tareas ---
    if (activeType === 'Task') {
      // Con filtros u orden no manual, bloqueamos drag para no desincronizar orden real.
      if (shouldLockTaskDrag(taskFilter, sortKey)) {
        return;
      }
      const sourceColumnId = active.data.current?.task?.columnId;
      const activeTask = active.data.current?.task as Task | undefined;
      const destColumnId = destinationColumnIdFromDroppable(overData);

      if (!sourceColumnId || !destColumnId || !activeTask) return;

      // Señal de posición relativa para saber si insertar arriba o abajo del `over`.
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

      // Aplica movimiento optimista y luego sincroniza con backend.
      moveTaskOptimistic(activeId, sourceColumnId, destColumnId, nextOrder, {
        newColumnId: destColumnId,
        newOrder: nextOrder,
      });
    }
  };

  const handleCreateColumn = (title: string) => {
    const columns = board?.columns || [];
    const lastCol = columns.length > 0 ? columns[columns.length - 1] : null;
    // Nueva columna al final: order entre último elemento y null (final de lista).
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
      <header className="relative z-10 flex shrink-0 flex-col gap-3 border-b border-surface-200 bg-surface-50 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 dark:border-surface-800 dark:bg-surface-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-bold text-surface-900 dark:text-surface-50">
              {board.title}
            </h1>
            {!canEdit && (
              <span className="hidden shrink-0 rounded-md border border-surface-200 bg-surface-100 px-2 py-0.5 text-xs font-medium text-surface-600 sm:inline dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400">
                Solo lectura
              </span>
            )}
          </div>
          {board.sprintsEnabled === true && slug ? (
            <BoardSprintHeaderControls
              ref={sprintHeaderRef}
              board={board}
              slug={slug}
              canEdit={canEdit}
              sprintView={sprintView}
              onSprintViewChange={setSprintView}
            />
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-start gap-2 sm:flex-wrap sm:justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
                onClick={() => void handleRefreshBoard()}
                disabled={refreshBusy}
                aria-label="Actualizar tablero desde el servidor"
              >
                {refreshBusy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Sincronizar con el servidor
            </TooltipContent>
          </Tooltip>
          {user && slug && (
            <div className="hidden sm:block">
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="bottom">Ajustes del tablero</TooltipContent>
              </Tooltip>
            </div>
          )}
          {user && canInviteToBoard(board, user) && slug && (
            <div className="hidden sm:block">
              <Tooltip>
                <TooltipTrigger asChild>
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
                </TooltipTrigger>
                <TooltipContent side="bottom">Invitar al tablero</TooltipContent>
              </Tooltip>
            </div>
          )}
          <div className="hidden sm:block">
            <BoardViewToolbar
              taskFilter={taskFilter}
              onTaskFilterChange={setTaskFilter}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleBoardSortChange}
              boardLabelOptions={boardLabelOptions}
              compactMobile={false}
            />
          </div>
          <div className="sm:hidden">
            <BoardViewToolbar
              taskFilter={taskFilter}
              onTaskFilterChange={setTaskFilter}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleBoardSortChange}
              boardLabelOptions={boardLabelOptions}
              compactMobile
            />
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 border-surface-200 bg-surface-50 px-0 dark:border-surface-700 dark:bg-surface-900"
                  aria-label="Más acciones del tablero"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[90] w-52">
                {user && slug ? (
                  <DropdownMenuItem onClick={handleOpenSettings}>
                    <Settings className="size-4 opacity-80" aria-hidden />
                    Ajustes del tablero
                  </DropdownMenuItem>
                ) : null}
                {user && canInviteToBoard(board, user) && slug ? (
                  <DropdownMenuItem onClick={handleOpenShare}>
                    <UserPlus className="size-4 opacity-80" aria-hidden />
                    Compartir tablero
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {user && slug ? (
            <BoardSettingsSheet
              board={board}
              slug={slug}
              user={user}
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onViewClosedSprint={(sprintId) => {
                setSprintView(`closed:${sprintId}` as SprintViewValue);
                setSettingsOpen(false);
              }}
            />
          ) : null}
          {user && canInviteToBoard(board, user) && slug ? (
            <BoardShareDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              slug={slug}
              boardId={board._id}
            />
          ) : null}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-100 dark:bg-surface-950">
        {selectedClosedSprintRecord ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ClosedSprintHistoryView
              record={selectedClosedSprintRecord}
              flowNav={closedSprintFlowNav}
              onSelectClosedSprint={(sprintId) =>
                setSprintView(`closed:${sprintId}` as SprintViewValue)
              }
              onStartNextSprint={() =>
                sprintHeaderRef.current?.openNewSprintDialog()
              }
            />
          </div>
        ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex h-full min-h-0 min-w-min items-stretch gap-4 sm:gap-6">
              <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                {columnsWithVisibleTasks.map(({ column, visibleTasks }) => (
                  <BoardColumn
                    key={column._id}
                    column={column}
                    visibleTasks={visibleTasks}
                    taskDragDisabled={taskDragLocked}
                    columnDragDisabled={columnDragLocked}
                    boardId={board._id}
                    canEdit={canEdit}
                  />
                ))}
              </SortableContext>
              {canEdit && (
                <div className="kanban-column-width">
                  <InlineCreateForm actionText="Añadir columna" onSubmit={handleCreateColumn} />
                </div>
              )}
            </div>
          </div>
          <DragOverlay>
            {/* Fantasma visual durante drag de tarea */}
            {activeTask && <TaskCard task={activeTask} isOverlay />}
            {/* Fantasma visual durante drag de columna */}
            {activeColumn && (
               <div className="kanban-column-width rotate-2 rounded-xl border-2 border-primary-500/40 bg-surface-50 p-4 opacity-95 shadow-2xl ring-2 ring-primary-500/20 dark:border-primary-400/35 dark:bg-surface-900 dark:ring-primary-400/15">
                 <h3 className="font-semibold text-surface-900 dark:text-surface-50">{activeColumn.title}</h3>
               </div>
            )}
          </DragOverlay>
        </DndContext>
        )}
      </main>
    </div>
  );
};
