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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, RefreshCw, Settings, SlidersHorizontal, UserPlus } from 'lucide-react';
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

// Busca el indice de una columna por id
function columnIndexById(columns: Column[], id: string): number {
  for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
    if (columns[columnIndex]._id === id) {
      return columnIndex;
    }
  }
  return -1;
}

// Gestiona la vista principal del tablero y sus interacciones
export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore(function selectUser(authState) {
    return authState.user;
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
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  const [fetchSettled, setFetchSettled] = useState(false);
  const [taskFilter, setTaskFilter] = useState<BoardTaskFilter>({ kind: 'all' });
  const [sortKey, setSortKey] = useState<BoardTaskSortKey>('manual');
  const [sortDirection, setSortDirection] =
    useState<BoardSortDirection>('asc');
  const [sprintView, setSprintView] = useState<SprintViewValue>('all');

  const sprintHeaderRef = useRef<BoardSprintHeaderControlsHandle | null>(null);

  useLayoutEffect(() => {
    if (!slug) return;
    // Al cambiar slug reinicia estado para evitar mezclar tableros
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
    // Pide tablero al backend y marca cuando termina la carga inicial
    void fetchBoard(slug).finally(() => {
      if (isMounted) setFetchSettled(true);
    });
    return () => {
      isMounted = false;
    };
  }, [slug, fetchBoard]);

  // Refresca tablero y miembros sin bloquear la interfaz
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

  useRefetchBoardWhenTabVisible({
    slug,
    fetchBoard,
    enabled: fetchSettled && Boolean(slug),
    pollIntervalMs: BOARD_SILENT_POLL_INTERVAL_MS,
  });

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
    for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
      ids.push(board.columns[columnIndex]._id);
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
    let sprintIndex = -1;
    for (let listIndex = 0; listIndex < list.length; listIndex++) {
      if (list[listIndex].sprintId === selectedClosedSprintRecord.sprintId) {
        sprintIndex = listIndex;
        break;
      }
    }
    if (sprintIndex < 0) {
      return null;
    }
    const olderClosed = sprintIndex > 0 ? list[sprintIndex - 1]! : null;
    const newerClosed = sprintIndex < list.length - 1 ? list[sprintIndex + 1]! : null;
    const isNewestClosed = sprintIndex === list.length - 1;
    const userCanEdit = user ? canEditBoardContent(board, user) : false;
    const hasActive =
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0;

    // Construye razon de bloqueo para guiar al usuario en UI
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
    const closeActiveSprintAvailable =
      board.sprintsEnabled === true && userCanEdit && hasActive;

    return {
      olderClosed,
      newerClosed,
      isNewestClosed,
      canStartNextSprint,
      startNextSprintBlockedReason,
      closeActiveSprintAvailable,
    };
  }, [board, selectedClosedSprintRecord, user]);

  const activeSprintHeaderInfo = useMemo(() => {
    if (!board || sprintView !== 'active') {
      return null;
    }
    const activeId = board.activeSprintId;
    if (typeof activeId !== 'string' || activeId.length === 0) {
      return null;
    }
    const rows = board.sprints ?? [];
    for (let index = 0; index < rows.length; index++) {
      if (rows[index]._id === activeId) {
        const objective = rows[index].objective?.trim() ?? '';
        return {
          name: rows[index].name,
          objective,
        };
      }
    }
    return null;
  }, [board, sprintView]);

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

  const columnsWithVisibleTasks = useMemo(() => {
    if (!board) return [];
    const out: { column: Column; visibleTasks: Task[] }[] = [];
    for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
      const column = board.columns[columnIndex];
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

  const taskDragLocked = shouldLockTaskDrag(sortKey);
  const columnDragLocked = sprintView !== 'all';

  const collisionDetection = useMemo(
    () => createBoardCollisionDetection(board),
    [board],
  );

  // Guarda el elemento activo para mostrar el overlay de arrastre
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Task') {
      setActiveTask(active.data.current.task);
    } else if (active.data.current?.type === 'Column') {
      setActiveColumn(active.data.current.column);
    }
  };

  // Gestiona el fin del arrastre para columnas y tareas
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

    if (activeType === 'Column') {
      if (columnDragLocked) {
        return;
      }
      const oldIndex = columnIndexById(board.columns, activeId);
      const newIndex = columnIndexById(board.columns, overId);

      if (oldIndex === -1 || newIndex === -1) return;

      const tempColumns = [...board.columns];
      const [movedColumn] = tempColumns.splice(oldIndex, 1);
      tempColumns.splice(newIndex, 0, movedColumn);

      const prevCol = newIndex > 0 ? tempColumns[newIndex - 1] : null;
      const nextCol = newIndex < tempColumns.length - 1 ? tempColumns[newIndex + 1] : null;
      
      const prevOrder = prevCol?.order;
      const nextOrder = (nextCol?.order === prevOrder) ? null : nextCol?.order;
      
      const newOrder = calculateNewOrder(prevOrder || null, nextOrder || null);
      // Mueve columna en store y lanza peticion optimista al backend
      moveColumnOptimistic(board._id, activeId, newOrder);
      return;
    }

    if (activeType === 'Task') {
      if (shouldLockTaskDrag(sortKey)) {
        return;
      }
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

      // Mueve tarjeta en store y sincroniza posicion via API
      moveTaskOptimistic(activeId, sourceColumnId, destColumnId, nextOrder, {
        newColumnId: destColumnId,
        newOrder: nextOrder,
      });
    }
  };

  // Crea una columna nueva al final del tablero
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
      <header className="relative z-10 flex shrink-0 flex-col gap-3 border-b border-surface-300/95 bg-surface-50/70 px-4 py-3 shadow-sm ring-1 ring-surface-200/80 backdrop-blur-sm sm:min-h-22 sm:px-6 sm:py-4 lg:px-8 dark:border-surface-700/80 dark:bg-surface-900/70 dark:ring-surface-700/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="min-w-0 truncate text-2xl font-bold text-surface-900 dark:text-surface-50">
              {board.title}
            </h1>
            {!canEdit && (
              <span className="hidden shrink-0 rounded-md border border-surface-200 bg-surface-100 px-2 py-0.5 text-base font-medium text-surface-600 sm:inline dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400">
                Solo lectura
              </span>
            )}
          </div>
          {activeSprintHeaderInfo ? (
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <span
                className="h-9 w-px shrink-0 bg-surface-300 dark:bg-surface-600"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-surface-800 dark:text-surface-100">
                  {activeSprintHeaderInfo.name}
                </p>
                {activeSprintHeaderInfo.objective.length > 0 ? (
                  <p className="text-muted-foreground truncate text-base leading-snug">
                    {activeSprintHeaderInfo.objective}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
          <div className="sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 border-surface-500 bg-surface-50 px-3 text-lg font-semibold text-surface-800 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70"
              onClick={() => setMobileControlsOpen(true)}
              aria-label="Abrir controles del tablero"
            >
              <SlidersHorizontal className="size-4.5" aria-hidden />
              <span>Controles</span>
            </Button>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-row"
              className="border-surface-500 bg-surface-50 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:ring-surface-700/70"
              onClick={() => void handleRefreshBoard()}
              disabled={refreshBusy}
              aria-label="Actualizar tablero desde el servidor"
            >
                {refreshBusy ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-5" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Sincronizar con el servidor
            </TooltipContent>
          </Tooltip>
          {board.sprintsEnabled === true && slug ? (
            <div className="hidden shrink-0 sm:block">
              <BoardSprintHeaderControls
                ref={sprintHeaderRef}
                board={board}
                slug={slug}
                canEdit={canEdit}
                sprintView={sprintView}
                onSprintViewChange={setSprintView}
                placement="actions-row"
              />
            </div>
          ) : null}
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
          {user && canInviteToBoard(board, user) && slug && (
            <Button
              type="button"
              variant="outline"
              className="hidden h-11 w-11 shrink-0 gap-0 border-surface-500 bg-surface-50 p-0 text-lg font-semibold ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70 sm:inline-flex sm:w-auto sm:gap-2 sm:px-4"
              onClick={handleOpenShare}
              aria-label="Invitar al tablero"
            >
              <UserPlus className="size-5 shrink-0 sm:shrink-0" aria-hidden />
              <span className="hidden sm:inline text-surface-800 dark:text-surface-100">
                Invitar
              </span>
            </Button>
          )}
          {user && slug && (
            <Button
              type="button"
              variant="outline"
              size="icon-row"
              className="hidden border-surface-500 bg-surface-50 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:ring-surface-700/70 sm:inline-flex"
              onClick={handleOpenSettings}
              aria-label="Configuración del tablero"
            >
              <Settings className="size-5" aria-hidden />
            </Button>
          )}
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

        <Sheet open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
          <SheetContent side="right" className="w-11/12 px-0 sm:hidden">
            <SheetHeader className="px-4 sm:px-5">
              <SheetTitle>Controles</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 px-4 pb-4 sm:px-5">
              <div className="space-y-2">
                {board.sprintsEnabled === true && slug ? (
                  <BoardSprintHeaderControls
                    ref={sprintHeaderRef}
                    board={board}
                    slug={slug}
                    canEdit={canEdit}
                    sprintView={sprintView}
                    onSprintViewChange={setSprintView}
                    placement="panel-row"
                  />
                ) : null}
                <BoardViewToolbar
                  taskFilter={taskFilter}
                  onTaskFilterChange={setTaskFilter}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={handleBoardSortChange}
                  boardLabelOptions={boardLabelOptions}
                  compactMobile
                  mobileLayout="list"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-start border-surface-400 bg-surface-50 px-3 text-lg font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
                  onClick={() => void handleRefreshBoard()}
                  disabled={refreshBusy}
                >
                  {refreshBusy ? (
                    <Loader2 className="mr-2 size-4.5 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="mr-2 size-4.5" aria-hidden />
                  )}
                  Sincronizar con el servidor
                </Button>
                {user && canInviteToBoard(board, user) && slug ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start border-surface-400 bg-surface-50 px-3 text-lg font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
                    onClick={() => {
                      setMobileControlsOpen(false);
                      handleOpenShare();
                    }}
                  >
                    <UserPlus className="mr-2 size-4.5" aria-hidden />
                    Invitar al tablero
                  </Button>
                ) : null}
                {user && slug ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start border-surface-400 bg-surface-50 px-3 text-lg font-semibold text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
                    onClick={() => {
                      setMobileControlsOpen(false);
                      handleOpenSettings();
                    }}
                  >
                    <Settings className="mr-2 size-4.5" aria-hidden />
                    Configuración del tablero
                  </Button>
                ) : null}
              </div>
            </div>
          </SheetContent>
        </Sheet>
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
              onCloseActiveSprint={() =>
                sprintHeaderRef.current?.openCloseSprintDialog()
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
            {activeTask && <TaskCard task={activeTask} isOverlay />}
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
