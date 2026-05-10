import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns3,
  LayoutGrid,
  LayoutList,
  Plus,
  Search,
  Workflow,
} from 'lucide-react';
import type {
  ClosedSprintRecord,
  ClosedSprintTaskSnapshot,
} from '@/types/board.types';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import { TaskDetailSheet } from '@/components/board/taskCard/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ClosedSprintSummaryCharts } from '@/components/board/closedSprint/ClosedSprintSummaryCharts';
import { createClosedSprintReadOnlySheetProps } from '@/components/board/closedSprint/closedSprintReadOnlySheetProps';
import {
  collectBoardLabelSuggestions,
  findTaskOnBoard,
} from '@/components/board/closedSprint/closedSprintBoardHelpers';

// Guarda la navegacion entre cierres
export type ClosedSprintFlowNavState = {
  olderClosed: ClosedSprintRecord | null;
  newerClosed: ClosedSprintRecord | null;
  isNewestClosed: boolean;
  canStartNextSprint: boolean;
  startNextSprintBlockedReason?: string | null;
  closeActiveSprintAvailable: boolean;
};

type ClosedSprintHistoryViewProps = {
  record: ClosedSprintRecord;
  flowNav?: ClosedSprintFlowNavState | null;
  onSelectClosedSprint?: (sprintId: string) => void;
  onStartNextSprint?: () => void;
  onCloseActiveSprint?: () => void;
};

// Da formato corto a una fecha
function formatDateLabel(iso: string | undefined): string {
  if (!iso) {
    return '—';
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return parsed.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Muestra el detalle del cierre
export function ClosedSprintHistoryView({
  record,
  flowNav,
  onSelectClosedSprint,
  onStartNextSprint,
  onCloseActiveSprint,
}: ClosedSprintHistoryViewProps) {
  const board = useActiveBoardStore((state) => state.board);
  const boardMembers = useActiveBoardStore((state) => state.boardMembers);
  const ownerMember = boardMembers.find(m => m.role === 'owner');
  const effectivePlan = ownerMember?.userPlan || 'free';

  const snapshots = record.taskSnapshots ?? [];
  let currentPlan: 'free' | 'pro' | 'team' = 'free';
  if (effectivePlan === 'pro' || effectivePlan === 'team') {
    currentPlan = effectivePlan;
  }
  const canSeeClosedSprintCharts = currentPlan === 'pro' || currentPlan === 'team';
  type CompletionFilter = 'all' | 'completed' | 'incomplete';
  const [taskSearch, setTaskSearch] = useState('');
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>('all');
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);

  useEffect(() => {
    // Al cambiar de sprint cerrado reiniciamos filtros de la vista
    setTaskSearch('');
    setCompletionFilter('all');
    setSelectedColumnIds([]);
  }, [record.sprintId]);

  const columnOptions = useMemo(() => {
    // Leemos tipo de columna desde tablero actual o archivadas
    function kindFromBoard(columnId: string): boolean | null {
      if (!board) {
        return null;
      }
      const boardColumn = board.columns.find((columnRow) => columnRow._id === columnId);
      if (boardColumn) {
        if (boardColumn.columnKind === 'done' || boardColumn.columnKind === 'archived') {
          return true;
        }
        return false;
      }
      const archivedColumn = board.archivedColumns?.find(
        (columnRow) => columnRow._id === columnId,
      );
      if (archivedColumn) {
        if (
          archivedColumn.columnKind === 'done' ||
          archivedColumn.columnKind === 'archived'
        ) {
          return true;
        }
        return false;
      }
      return null;
    }

    function inferCompletionFromSnapshots(columnId: string): boolean {
      let hasAnySnapshot = false;
      let sawIncomplete = false;
      for (let snapshotIndex = 0; snapshotIndex < snapshots.length; snapshotIndex++) {
        const row = snapshots[snapshotIndex];
        if (row.columnId !== columnId) {
          continue;
        }
        hasAnySnapshot = true;
        if (!row.wasCompleted) {
          sawIncomplete = true;
          break;
        }
      }
      return hasAnySnapshot && !sawIncomplete;
    }

    const byId = new Map<
      string,
      { title: string; isCompletionKind: boolean }
    >();
    for (let snapshotIndex = 0; snapshotIndex < snapshots.length; snapshotIndex++) {
      const snapshot = snapshots[snapshotIndex];
      if (byId.has(snapshot.columnId)) {
        continue;
      }
      const fromBoard = kindFromBoard(snapshot.columnId);
      let isCompletionKind = inferCompletionFromSnapshots(snapshot.columnId);
      if (fromBoard !== null) {
        isCompletionKind = fromBoard;
      }
      byId.set(snapshot.columnId, {
        title: snapshot.columnTitleAtClose,
        isCompletionKind,
      });
    }
    return Array.from(byId.entries())
      .map(([id, columnSummary]) => ({
        id,
        title: columnSummary.title,
        isCompletionKind: columnSummary.isCompletionKind,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'es'));
  }, [snapshots, board]);

  const columnTriggerLeadingIcon = useMemo(() => {
    if (selectedColumnIds.length !== 1) {
      return null;
    }
    const onlyId = selectedColumnIds[0];
    const selectedColumnOption = columnOptions.find((columnOption) => columnOption.id === onlyId);
    if (!selectedColumnOption) {
      return null;
    }
    return selectedColumnOption.isCompletionKind
      ? ('done' as const)
      : ('workflow' as const);
  }, [selectedColumnIds, columnOptions]);

  const filteredSnapshots = useMemo(() => {
    // Filtro en cadena: estado, columnas y texto de busqueda
    let list = snapshots;
    if (completionFilter === 'completed') {
      list = list.filter((snapshotRow) => snapshotRow.wasCompleted);
    } else if (completionFilter === 'incomplete') {
      list = list.filter((snapshotRow) => !snapshotRow.wasCompleted);
    }
    if (selectedColumnIds.length > 0) {
      const set = new Set(selectedColumnIds);
      list = list.filter((snapshotRow) => set.has(snapshotRow.columnId));
    }
    const normalizedTaskSearch = taskSearch.trim().toLowerCase();
    if (normalizedTaskSearch.length > 0) {
      list = list.filter(
        (snapshotRow) =>
          snapshotRow.title.toLowerCase().includes(normalizedTaskSearch) ||
          snapshotRow.columnTitleAtClose
            .toLowerCase()
            .includes(normalizedTaskSearch),
      );
    }
    return list;
  }, [snapshots, completionFilter, selectedColumnIds, taskSearch]);

  function handleColumnFilterCheckedChange(columnId: string, checked: boolean) {
    const allIds = columnOptions.map((c) => c.id);
    if (checked) {
      setSelectedColumnIds((prev) => {
        if (prev.length === 0) {
          return prev;
        }
        const merged = [...new Set([...prev, columnId])];
        if (merged.length === allIds.length) {
          return [];
        }
        return merged;
      });
    } else {
      setSelectedColumnIds((prev) => {
        if (prev.length === 0) {
          if (allIds.length <= 1) {
            return [];
          }
          return allIds.filter((id) => id !== columnId);
        }
        const next = prev.filter((id) => id !== columnId);
        if (next.length === 0) {
          return [];
        }
        return next;
      });
    }
  }

  let completionLabel = 'Todas';
  if (completionFilter === 'completed') {
    completionLabel = 'Completadas';
  }
  if (completionFilter === 'incomplete') {
    completionLabel = 'Incompletas';
  }

  let columnTriggerLabel = 'Todas';
  if (selectedColumnIds.length === 1) {
    columnTriggerLabel = '1 columna';
  }
  if (selectedColumnIds.length > 1) {
    columnTriggerLabel = `${selectedColumnIds.length} columnas`;
  }

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<ClosedSprintTaskSnapshot | null>(null);

  const liveTask = useMemo(() => {
    if (!selectedSnapshot || !board) {
      return null;
    }
    return findTaskOnBoard(board, selectedSnapshot.taskId);
  }, [board, selectedSnapshot]);

  // Sugerencias del tablero para mostrar labels consistentes en detalle
  const labelSuggestions = useMemo(() => collectBoardLabelSuggestions(board), [board]);

  const openSnapshot = useCallback((row: ClosedSprintTaskSnapshot) => {
    setSelectedSnapshot(row);
    setDetailOpen(true);
  }, []);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      setSelectedSnapshot(null);
    }
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailOpen(false);
    setSelectedSnapshot(null);
  }, []);

  const detailSheetProps = useMemo(() => {
    if (!selectedSnapshot) {
      return null;
    }
    // Props del panel en modo lectura para snapshots del sprint cerrado
    return createClosedSprintReadOnlySheetProps({
      open: detailOpen,
      onOpenChange: handleDetailOpenChange,
      onClose: handleDetailClose,
      snapshot: selectedSnapshot,
      liveTask,
      boardMembers,
      boardLabelSuggestions: labelSuggestions,
    });
  }, [
    detailOpen,
    selectedSnapshot,
    liveTask,
    boardMembers,
    labelSuggestions,
    handleDetailOpenChange,
    handleDetailClose,
  ]);

  const showFlowNav =
    flowNav !== undefined &&
    flowNav !== null &&
    typeof onSelectClosedSprint === 'function';

  const previousTarget = flowNav?.olderClosed ?? null;
  const newerTarget = flowNav?.newerClosed ?? null;
  const isNewestClosed = flowNav?.isNewestClosed === true;
  const canStartNextSprint = flowNav?.canStartNextSprint === true;
  const closeActiveSprintAvailable =
    flowNav?.closeActiveSprintAvailable === true;

  const nextSprintTooltip =
    flowNav?.startNextSprintBlockedReason?.trim() ||
    'No puedes crear otro sprint ahora.';

  let headerDateText = `Cerró ${formatDateLabel(record.closedAt)}`;
  if (record.startedAt) {
    headerDateText = `${headerDateText} · Inicio ${formatDateLabel(record.startedAt)}`;
  }
  if (record.plannedEndAt) {
    headerDateText = `${headerDateText} · Fin previsto ${formatDateLabel(record.plannedEndAt)}`;
  }

  const hasObjective = Boolean(record.objective?.trim());
  const objectiveText = record.objective?.trim() ?? '';

  let mobileRightAction: React.ReactNode = <div className="flex-1" aria-hidden />;
  if (isNewestClosed) {
    if (canStartNextSprint && typeof onStartNextSprint === 'function') {
      mobileRightAction = (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 flex-1 justify-center"
          onClick={() => onStartNextSprint()}
        >
          <Plus className="mr-1 size-4" aria-hidden />
          Siguiente sprint
        </Button>
      );
    } else if (
      closeActiveSprintAvailable &&
      typeof onCloseActiveSprint === 'function'
    ) {
      mobileRightAction = (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 flex-1 justify-center"
          onClick={() => onCloseActiveSprint()}
        >
          <Archive className="mr-1 size-4" aria-hidden />
          Archivar
        </Button>
      );
    } else {
      mobileRightAction = (
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <span className="flex flex-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-9 w-full justify-center"
              >
                <Plus className="mr-1 size-4" aria-hidden />
                Siguiente sprint
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {nextSprintTooltip}
          </TooltipContent>
        </Tooltip>
      );
    }
  } else if (newerTarget) {
    mobileRightAction = (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 flex-1 justify-end"
        onClick={() => onSelectClosedSprint!(newerTarget.sprintId)}
      >
        Siguiente
        <ChevronRight className="ml-1 size-4" aria-hidden />
      </Button>
    );
  }

  return (
    <div className="mx-auto max-w-6xl overflow-x-clip px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-8 overflow-hidden rounded-xl border border-surface-200 bg-linear-to from-surface-50 to-surface-100/90 p-5 shadow-sm sm:p-6 dark:border-surface-800 dark:from-surface-900 dark:to-surface-950/80">
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-stretch lg:gap-5">
          {showFlowNav ? (
            <div className="hidden shrink-0 justify-center lg:flex lg:flex-col lg:justify-center lg:w-24">
              {previousTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-21 w-full max-w-40 flex-col gap-1 rounded-2xl border-2 border-violet-200/90 bg-surface-50/80 px-3 py-2.5 shadow-sm hover:bg-violet-50/80 dark:border-violet-800/80 dark:bg-surface-950/40 dark:hover:bg-violet-950/30 lg:max-w-none"
                  onClick={() =>
                    onSelectClosedSprint!(previousTarget.sprintId)
                  }
                  aria-label={`Ver sprint anterior cerrado del ${formatDateLabel(previousTarget.closedAt)}`}
                >
                  <ChevronLeft
                    className="size-8 shrink-0 text-violet-700 dark:text-violet-300"
                    aria-hidden
                  />
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Anterior
                  </span>
                  <span className="text-center text-sm font-semibold leading-tight text-surface-900 dark:text-surface-50">
                    {formatDateLabel(previousTarget.closedAt)}
                  </span>
                </Button>
              ) : (
                <div className="hidden min-h-21 w-full lg:block" aria-hidden />
              )}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
              <LayoutList className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold tracking-tight text-surface-900 sm:text-3xl dark:text-surface-50">
                {record.sprintName}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-snug sm:text-sm">
                {headerDateText}
              </p>
              {hasObjective && (
                <p className="text-surface-800 dark:text-surface-200 mt-3 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap sm:text-sm sm:leading-relaxed">
                  <span className="text-muted-foreground font-medium">Objetivo · </span>
                  {objectiveText}
                </p>
              )}
            </div>
          </div>

          {showFlowNav ? (
            <div className="hidden shrink-0 justify-center lg:flex lg:flex-col lg:justify-center lg:w-28">
              {isNewestClosed ? (
                canStartNextSprint && typeof onStartNextSprint === 'function' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-21 w-full max-w-44 flex-col gap-1.5 rounded-2xl border-2 border-emerald-200/90 bg-emerald-50/50 px-3 py-3 shadow-sm hover:bg-emerald-100/70 dark:border-emerald-800/80 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/45 lg:max-w-none"
                    onClick={() => onStartNextSprint()}
                    aria-label="Crear el siguiente sprint"
                  >
                    <Plus
                      className="size-10 shrink-0 stroke-[2.25] text-emerald-700 dark:text-emerald-300"
                      aria-hidden
                    />
                    <span className="text-center text-sm font-semibold leading-snug text-emerald-900 dark:text-emerald-100">
                      Siguiente sprint
                    </span>
                  </Button>
                ) : closeActiveSprintAvailable &&
                  typeof onCloseActiveSprint === 'function' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-21 w-full max-w-44 flex-col gap-1.5 rounded-2xl border-2 border-surface-200 bg-surface-100/90 px-3 py-3 shadow-sm hover:border-surface-300 hover:bg-surface-200/60 dark:border-surface-600 dark:bg-surface-800/80 dark:hover:border-surface-500 dark:hover:bg-surface-700/70 lg:max-w-none"
                    onClick={() => onCloseActiveSprint()}
                    aria-label="Archivar el sprint activo"
                  >
                    <Archive
                      className="size-9 shrink-0 text-surface-600 dark:text-surface-400"
                      aria-hidden
                    />
                    <span className="text-center text-sm font-semibold leading-snug text-surface-800 dark:text-surface-200">
                      Archivar
                    </span>
                  </Button>
                ) : (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full max-w-44 justify-center lg:max-w-none">
                        <Button
                          type="button"
                          variant="outline"
                          disabled
                          className="h-auto min-h-21 w-full flex-col gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 opacity-70"
                          aria-label="No puedes iniciar un sprint ahora"
                        >
                          <Plus
                            className="size-10 shrink-0 stroke-[2.25]"
                            aria-hidden
                          />
                          <span className="text-center text-sm font-semibold leading-snug">
                            Siguiente sprint
                          </span>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      {nextSprintTooltip}
                    </TooltipContent>
                  </Tooltip>
                )
              ) : newerTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-21 w-full max-w-40 flex-col gap-1 rounded-2xl border-2 border-violet-200/90 bg-surface-50/80 px-3 py-2.5 shadow-sm hover:bg-violet-50/80 dark:border-violet-800/80 dark:bg-surface-950/40 dark:hover:bg-violet-950/30 lg:max-w-none"
                  onClick={() => onSelectClosedSprint!(newerTarget.sprintId)}
                  aria-label={`Ver sprint siguiente cerrado del ${formatDateLabel(newerTarget.closedAt)}`}
                >
                  <ChevronRight
                    className="size-8 shrink-0 text-violet-700 dark:text-violet-300"
                    aria-hidden
                  />
                  <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    Siguiente
                  </span>
                  <span className="text-center text-sm font-semibold leading-tight text-surface-900 dark:text-surface-50">
                    {formatDateLabel(newerTarget.closedAt)}
                  </span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {showFlowNav && (
          <div className="mt-4 flex items-center justify-between gap-2 lg:hidden">
            {previousTarget ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 flex-1 justify-start"
                onClick={() => onSelectClosedSprint!(previousTarget.sprintId)}
              >
                <ChevronLeft className="mr-1 size-4" aria-hidden />
                Anterior
              </Button>
            ) : (
              <div className="flex-1" aria-hidden />
            )}
            {mobileRightAction}
          </div>
        )}
      </div>

      <ClosedSprintSummaryCharts record={record} basicOnly={!canSeeClosedSprintCharts} />

      <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 bg-surface-100/80 px-5 py-4 dark:border-surface-800 dark:bg-surface-950/50 sm:px-6">
          <h3 className="text-sm font-semibold tracking-tight text-surface-900 sm:text-base dark:text-surface-50">
            Tareas:{' '}
            {snapshots.length === 0
              ? '0'
              : filteredSnapshots.length === snapshots.length
                ? String(snapshots.length)
                : `${filteredSnapshots.length} de ${snapshots.length}`}
          </h3>
          <p className="text-muted-foreground mt-1.5 text-xs leading-5 sm:text-sm sm:leading-snug">
            Abre una tarea. Filtra por estado, columna o búsqueda.
          </p>
          {snapshots.length > 0 ? (
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 flex-1 sm:min-w-48 sm:max-w-md">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Buscar…"
                  className="h-9 border-surface-200 bg-surface-50 pl-9 dark:border-surface-700 dark:bg-surface-900"
                  aria-label="Buscar tareas"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 justify-between gap-2 border-surface-200 bg-surface-50 font-normal dark:border-surface-700 dark:bg-surface-900 sm:w-auto"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {completionFilter === 'completed' ? (
                        <CheckCircle2
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : completionFilter === 'incomplete' ? (
                        <Circle
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden
                        />
                      ) : (
                        <LayoutGrid
                          className="text-muted-foreground size-4 shrink-0 opacity-90"
                          aria-hidden
                        />
                      )}
                      <span className="truncate">{completionLabel}</span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Estado</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={completionFilter}
                    onValueChange={(v) =>
                      setCompletionFilter(v as CompletionFilter)
                    }
                  >
                    <DropdownMenuRadioItem value="all" className="gap-2.5">
                      <LayoutGrid
                        className="text-muted-foreground size-4 shrink-0 opacity-90"
                        aria-hidden
                      />
                      Todas
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="completed" className="gap-2.5">
                      <CheckCircle2
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                      Completadas
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="incomplete" className="gap-2.5">
                      <Circle
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden
                      />
                      Incompletas
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 justify-between gap-2 border-surface-200 bg-surface-50 font-normal dark:border-surface-700 dark:bg-surface-900 sm:w-auto"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {columnTriggerLeadingIcon === 'done' ? (
                        <CheckCircle2
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : columnTriggerLeadingIcon === 'workflow' ? (
                        <Workflow
                          className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                          aria-hidden
                        />
                      ) : (
                        <Columns3
                          className="size-4 shrink-0 opacity-80"
                          aria-hidden
                        />
                      )}
                      <span className="truncate">{columnTriggerLabel}</span>
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="max-h-72 w-64 overflow-y-auto"
                >
                  <DropdownMenuLabel>Columnas</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-2.5"
                    onSelect={(event) => {
                      event.preventDefault();
                      setSelectedColumnIds([]);
                    }}
                  >
                    <LayoutGrid
                      className="text-muted-foreground size-4 shrink-0 opacity-90"
                      aria-hidden
                    />
                    Todas
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {columnOptions.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.id}
                      className="gap-2.5"
                      checked={
                        selectedColumnIds.length === 0 ||
                        selectedColumnIds.includes(col.id)
                      }
                      onCheckedChange={(next) =>
                        handleColumnFilterCheckedChange(col.id, next === true)
                      }
                      onSelect={(event) => event.preventDefault()}
                    >
                      {col.isCompletionKind ? (
                        <CheckCircle2
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : (
                        <Workflow
                          className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 truncate" title={col.title}>
                        {col.title}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
        {snapshots.length === 0 ? (
          <p className="text-muted-foreground px-5 py-12 text-center text-sm leading-6 sm:px-6">
            No había tareas en este sprint.
          </p>
        ) : filteredSnapshots.length === 0 ? (
          <p className="text-muted-foreground px-5 py-12 text-center text-sm leading-6 sm:px-6">
            Nada coincide con filtros o búsqueda.
          </p>
        ) : (
          <ul className="divide-y divide-surface-200 dark:divide-surface-800">
            {filteredSnapshots.map((row) => {
              const pointsLabel =
                row.wasCompleted && typeof row.storyPointsWhenDone === 'number'
                  ? row.storyPointsWhenDone
                  : '—';
              let rowStatusLabel = ' · Pendiente';
              if (row.wasCompleted) {
                rowStatusLabel = ' · Hecha';
              }
              return (
                <li key={row.taskId}>
                  <button
                    type="button"
                    onClick={() => openSnapshot(row)}
                    className="flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-100/90 focus-visible:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-6 dark:hover:bg-surface-950/60 dark:focus-visible:bg-surface-950/50"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
                      {row.wasCompleted ? (
                        <CheckCircle2 className="size-5" aria-hidden />
                      ) : (
                        <Circle className="text-muted-foreground size-5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-snug text-surface-900 sm:text-base dark:text-surface-50">
                        {row.title}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs leading-snug sm:text-sm">
                        {row.columnTitleAtClose}
                        {rowStatusLabel}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Pts.
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-surface-800 dark:text-surface-100">
                        {pointsLabel}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {detailSheetProps && <TaskDetailSheet {...detailSheetProps} />}
    </div>
  );
}
