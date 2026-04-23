import { useCallback, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  LayoutList,
  Plus,
} from 'lucide-react';
import type { ClosedSprintRecord, ClosedSprintTaskSnapshot } from '@/types/board.types';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import { TaskDetailSheet } from '@/components/board/taskCard/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ClosedSprintSummaryCharts } from '@/components/board/closedSprint/ClosedSprintSummaryCharts';
import { buildReadOnlyClosedSprintTaskSheetProps } from '@/components/board/closedSprint/buildReadOnlyClosedSprintTaskSheetProps';
import {
  collectBoardLabelSuggestions,
  findTaskOnBoard,
} from '@/components/board/closedSprint/closedSprintBoardHelpers';

/** Índice en `closedSprintRecords` del API: del más antiguo al más reciente. */
export type ClosedSprintFlowNavState = {
  olderClosed: ClosedSprintRecord | null;
  newerClosed: ClosedSprintRecord | null;
  isNewestClosed: boolean;
  canStartNextSprint: boolean;
  /** Si no se puede iniciar sprint, texto para el tooltip del botón deshabilitado. */
  startNextSprintBlockedReason?: string | null;
};

type ClosedSprintHistoryViewProps = {
  record: ClosedSprintRecord;
  flowNav?: ClosedSprintFlowNavState | null;
  onSelectClosedSprint?: (sprintId: string) => void;
  onStartNextSprint?: () => void;
};

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

/**
 * Informe visual de un sprint cerrado: gráficos, lista clicable y detalle de tarea
 * en solo lectura (datos actuales del tablero si la tarea sigue existiendo).
 */
export function ClosedSprintHistoryView({
  record,
  flowNav,
  onSelectClosedSprint,
  onStartNextSprint,
}: ClosedSprintHistoryViewProps) {
  const board = useActiveBoardStore((state) => state.board);
  const boardMembers = useActiveBoardStore((state) => state.boardMembers);

  const snapshots = record.taskSnapshots ?? [];
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] =
    useState<ClosedSprintTaskSnapshot | null>(null);

  const liveTask = useMemo(
    () =>
      selectedSnapshot && board
        ? findTaskOnBoard(board, selectedSnapshot.taskId)
        : null,
    [board, selectedSnapshot],
  );

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
    return buildReadOnlyClosedSprintTaskSheetProps({
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

  const nextSprintTooltip =
    flowNav?.startNextSprintBlockedReason?.trim() ||
    'No puedes iniciar un sprint nuevo en este momento.';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 overflow-hidden rounded-xl border border-surface-200 bg-gradient-to-br from-surface-50 to-surface-100/90 p-4 shadow-sm sm:p-5 dark:border-surface-800 dark:from-surface-900 dark:to-surface-950/80">
        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-stretch lg:gap-5">
          {showFlowNav ? (
            <div className="flex shrink-0 justify-center lg:w-[6.5rem] lg:flex-col lg:justify-center">
              {previousTarget ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[5.25rem] w-full max-w-[10rem] flex-col gap-1 rounded-2xl border-2 border-violet-200/90 bg-surface-50/80 px-3 py-2.5 shadow-sm hover:bg-violet-50/80 dark:border-violet-800/80 dark:bg-surface-950/40 dark:hover:bg-violet-950/30 lg:max-w-none"
                  onClick={() =>
                    onSelectClosedSprint!(previousTarget.sprintId)
                  }
                  aria-label={`Ver sprint anterior cerrado del ${formatDateLabel(previousTarget.closedAt)}`}
                >
                  <ChevronLeft
                    className="size-8 shrink-0 text-violet-700 dark:text-violet-300"
                    aria-hidden
                  />
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                    Anterior
                  </span>
                  <span className="text-center text-xs font-semibold leading-tight text-surface-900 dark:text-surface-50">
                    {formatDateLabel(previousTarget.closedAt)}
                  </span>
                </Button>
              ) : (
                <div
                  className="hidden min-h-[5.25rem] w-full lg:block"
                  aria-hidden
                />
              )}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
              <LayoutList className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight text-surface-900 dark:text-surface-50">
                {record.sprintName}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Cerrado: {formatDateLabel(record.closedAt)}
                {record.startedAt ? (
                  <> · Inicio: {formatDateLabel(record.startedAt)}</>
                ) : null}
                {record.plannedEndAt ? (
                  <> · Fin planificado: {formatDateLabel(record.plannedEndAt)}</>
                ) : null}
              </p>
              {record.objective?.trim() ? (
                <p className="text-surface-800 dark:text-surface-200 mt-3 max-w-3xl text-sm leading-relaxed whitespace-pre-wrap">
                  <span className="text-muted-foreground font-medium">
                    Objetivo:{' '}
                  </span>
                  {record.objective.trim()}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-2 text-xs">
                Vista archivada. Pulsa una tarea para ver el detalle (solo lectura).
                Los datos del tablero pueden haber cambiado desde el cierre.
              </p>
            </div>
          </div>

          {showFlowNav ? (
            <div className="flex shrink-0 justify-center lg:w-[7.5rem] lg:flex-col lg:justify-center">
              {isNewestClosed ? (
                canStartNextSprint && typeof onStartNextSprint === 'function' ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-[5.25rem] w-full max-w-[11rem] flex-col gap-1.5 rounded-2xl border-2 border-emerald-200/90 bg-emerald-50/50 px-3 py-3 shadow-sm hover:bg-emerald-100/70 dark:border-emerald-800/80 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/45 lg:max-w-none"
                    onClick={() => onStartNextSprint()}
                    aria-label="Crear el siguiente sprint"
                  >
                    <Plus
                      className="size-10 shrink-0 stroke-[2.25] text-emerald-700 dark:text-emerald-300"
                      aria-hidden
                    />
                    <span className="text-center text-xs font-semibold leading-snug text-emerald-900 dark:text-emerald-100">
                      Siguiente sprint
                    </span>
                  </Button>
                ) : (
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-full max-w-[11rem] justify-center lg:max-w-none">
                        <Button
                          type="button"
                          variant="outline"
                          disabled
                          className="h-auto min-h-[5.25rem] w-full flex-col gap-1.5 rounded-2xl border-2 border-dashed px-3 py-3 opacity-70"
                          aria-label="No puedes iniciar un sprint ahora"
                        >
                          <Plus
                            className="size-10 shrink-0 stroke-[2.25]"
                            aria-hidden
                          />
                          <span className="text-center text-xs font-semibold leading-snug">
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
                  className="h-auto min-h-[5.25rem] w-full max-w-[10rem] flex-col gap-1 rounded-2xl border-2 border-violet-200/90 bg-surface-50/80 px-3 py-2.5 shadow-sm hover:bg-violet-50/80 dark:border-violet-800/80 dark:bg-surface-950/40 dark:hover:bg-violet-950/30 lg:max-w-none"
                  onClick={() => onSelectClosedSprint!(newerTarget.sprintId)}
                  aria-label={`Ver sprint siguiente cerrado del ${formatDateLabel(newerTarget.closedAt)}`}
                >
                  <ChevronRight
                    className="size-8 shrink-0 text-violet-700 dark:text-violet-300"
                    aria-hidden
                  />
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                    Siguiente
                  </span>
                  <span className="text-center text-xs font-semibold leading-tight text-surface-900 dark:text-surface-50">
                    {formatDateLabel(newerTarget.closedAt)}
                  </span>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <ClosedSprintSummaryCharts record={record} boardMembers={boardMembers} />

      <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900">
        <div className="border-b border-surface-200 bg-surface-100/80 px-4 py-3 dark:border-surface-800 dark:bg-surface-950/50">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">
            Tareas archivadas ({snapshots.length})
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Clic en una fila para abrir el panel de detalle.
          </p>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">
            No había tareas enlazadas a este sprint al cerrarlo.
          </p>
        ) : (
          <ul className="divide-y divide-surface-200 dark:divide-surface-800">
            {snapshots.map((row) => {
              const pointsLabel =
                row.wasCompleted && typeof row.storyPointsWhenDone === 'number'
                  ? row.storyPointsWhenDone
                  : '—';
              return (
                <li key={row.taskId}>
                  <button
                    type="button"
                    onClick={() => openSnapshot(row)}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-100/90 focus-visible:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:hover:bg-surface-950/60 dark:focus-visible:bg-surface-950/50"
                  >
                    <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
                      {row.wasCompleted ? (
                        <CheckCircle2 className="size-5" aria-hidden />
                      ) : (
                        <Circle className="text-muted-foreground size-5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-surface-900 dark:text-surface-50">
                        {row.title}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {row.columnTitleAtClose}
                        {row.wasCompleted ? ' · Completada' : ' · En curso al cierre'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-muted-foreground">Pts.</p>
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

      {detailSheetProps ? <TaskDetailSheet {...detailSheetProps} /> : null}
    </div>
  );
}
