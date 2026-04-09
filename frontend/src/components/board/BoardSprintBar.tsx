import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { BoardSprint } from '@/types/board.types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createSprintRequest, completeSprintRequest } from '@/api/boards.api';
import { formatSprintDateRange } from '@/utils/sprintDisplay';
import { getActiveSprints } from '@/utils/boardWorkingSprint';
import { Check, Loader2, Pin, Plus, X } from 'lucide-react';

/** Valor del desplegable: todo el tablero, solo backlog, o id de sprint. */
export type SprintFilterValue = 'all' | 'backlog' | string;

function sprintSelectOptions(sprints: BoardSprint[]) {
  const opts = [];
  for (let i = 0; i < sprints.length; i++) {
    const s = sprints[i];
    const label =
      s.name + (s.status === 'active' ? ' (activo)' : '');
    opts.push(
      <option key={s._id} value={s._id}>
        {label}
      </option>,
    );
  }
  return opts;
}

type BoardSprintBarProps = {
  boardId: string;
  sprints: BoardSprint[];
  canEdit: boolean;
  value: SprintFilterValue;
  onChange: (next: SprintFilterValue) => void;
  /** Tras crear o cerrar sprint, el padre refresca el tablero. */
  onSprintsMutated: () => void | Promise<void>;
  /** Tras cerrar un sprint y refrescar; el padre puede reajustar el filtro (p. ej. otro activo). */
  onAfterSprintCompleted?: () => void;
  /** Guarda el sprint visible como preferencia (varios activos). */
  onPinWorkingSprint?: () => void;
  /** Id del sprint fijado en localStorage, si existe. */
  storedWorkingSprintId?: string | null;
};

/**
 * Selector de vista por sprint + diálogo para crear sprint y cerrar el activo.
 * El filtrado de tarjetas lo hace la página del tablero según `value`.
 */
export function BoardSprintBar({
  boardId,
  sprints,
  canEdit,
  value,
  onChange,
  onSprintsMutated,
  onAfterSprintCompleted,
  onPinWorkingSprint,
  storedWorkingSprintId = null,
}: BoardSprintBarProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGoal, setNewGoal] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [completeBusy, setCompleteBusy] = useState(false);

  const activeSprints = getActiveSprints(sprints);
  /** Al cerrar sprint se usa el primero de la lista (API cierra por id concreto). */
  const activeSprintForClose = activeSprints[0];

  let currentIsActiveSprint = false;
  if (value !== 'all' && value !== 'backlog') {
    for (let i = 0; i < activeSprints.length; i++) {
      if (activeSprints[i]._id === value) {
        currentIsActiveSprint = true;
        break;
      }
    }
  }
  const showPinWorkingSprint =
    activeSprints.length > 1 && currentIsActiveSprint;
  const isPinnedView =
    storedWorkingSprintId != null &&
    storedWorkingSprintId === value &&
    value !== 'all' &&
    value !== 'backlog';

  let selectedSprint: BoardSprint | undefined;
  if (value !== 'all' && value !== 'backlog') {
    for (let i = 0; i < sprints.length; i++) {
      if (sprints[i]._id === value) {
        selectedSprint = sprints[i];
        break;
      }
    }
  }
  const sprintDateLabel = selectedSprint
    ? formatSprintDateRange(selectedSprint.startsAt, selectedSprint.endsAt)
    : null;

  /** Panel central de ancho fijo (el texto largo no desplaza la barra). */
  const centerPanelClass =
    'flex w-full max-w-sm flex-col justify-center sm:w-80 sm:max-w-none';

  let centerPanel: ReactNode;
  if (value === 'all') {
    centerPanel = (
      <div className={`${centerPanelClass} min-h-[3.25rem]`}>
        <p className="text-muted-foreground text-center text-xs leading-snug line-clamp-3">
          Vista global: todas las tareas, con o sin sprint asignado.
        </p>
      </div>
    );
  } else if (value === 'backlog') {
    centerPanel = (
      <div className={`${centerPanelClass} min-h-[3.25rem]`} aria-hidden />
    );
  } else if (selectedSprint) {
    const goalRaw = selectedSprint.goal?.trim();
    const hasGoal = !!goalRaw;
    const hasDate = !!sprintDateLabel;

    centerPanel = (
      <div className={`${centerPanelClass} min-h-[3.5rem] gap-1 py-0.5`}>
        <div className="flex min-w-0 flex-col items-center gap-0.5 px-0.5">
          <div className="flex max-w-full items-baseline justify-center gap-x-1.5">
            <span
              className="min-w-0 truncate text-center text-base font-semibold leading-tight tracking-tight text-surface-900 sm:text-lg dark:text-surface-50"
              title={selectedSprint.name}
            >
              {selectedSprint.name}
            </span>
            {selectedSprint.status === 'active' ? (
              <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-emerald-600 sm:text-base dark:text-emerald-400">
                · Activo
              </span>
            ) : null}
          </div>
          {(hasDate || hasGoal) && (
            <div className="mt-0.5 grid w-full grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
              <div className="min-w-0 text-left">
                {hasDate ? (
                  <p
                    className="text-muted-foreground truncate leading-4"
                    title={sprintDateLabel ?? undefined}
                  >
                    {sprintDateLabel}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 text-right">
                {hasGoal ? (
                  <p
                    className="text-muted-foreground line-clamp-2 text-right leading-snug"
                    title={goalRaw}
                  >
                    {goalRaw}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } else {
    centerPanel = (
      <div className={`${centerPanelClass} min-h-[3.25rem]`} aria-hidden />
    );
  }

  async function handleCreateSprint() {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await createSprintRequest(boardId, {
        name,
        goal: newGoal.trim() || undefined,
        startsAt: newStartsAt.trim() || undefined,
        endsAt: newEndsAt.trim() || undefined,
        closePreviousActive: true,
      });
      setNewName('');
      setNewGoal('');
      setNewStartsAt('');
      setNewEndsAt('');
      setDialogOpen(false);
      await Promise.resolve(onSprintsMutated());
      onChange(created._id);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function handleFilterChange(e: ChangeEvent<HTMLSelectElement>) {
    onChange(e.target.value as SprintFilterValue);
  }

  async function handleCompleteActive() {
    if (!activeSprintForClose || completeBusy) return;
    setCompleteBusy(true);
    try {
      await completeSprintRequest(boardId, activeSprintForClose._id);
      await Promise.resolve(onSprintsMutated());
      onAfterSprintCompleted?.();
    } catch (e) {
      console.error(e);
    } finally {
      setCompleteBusy(false);
    }
  }

  const selectCluster = (
    <div className="flex min-w-0 flex-col gap-1.5 min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:items-center min-[400px]:gap-x-2">
      <label
        htmlFor="board-sprint-filter"
        className="text-muted-foreground flex shrink-0 flex-wrap items-baseline gap-x-1 text-sm"
      >
        <span className="whitespace-nowrap">Selector de:</span>
        <span className="font-medium whitespace-nowrap text-surface-900 dark:text-surface-100">
          vista
        </span>
      </label>
      <select
        id="board-sprint-filter"
        value={value}
        onChange={handleFilterChange}
        className="h-9 w-full min-w-0 rounded-md border border-surface-200 bg-surface-50 px-2 text-sm text-surface-900 min-[400px]:w-auto min-[400px]:max-w-[220px] dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100"
      >
        <option value="all">Todo el tablero</option>
        <option value="backlog">Solo backlog</option>
        {sprintSelectOptions(sprints)}
      </select>
    </div>
  );

  const actionsCluster = (
    <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-1.5 sm:max-w-none sm:gap-2">
      {showPinWorkingSprint && onPinWorkingSprint ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1 border-surface-200 dark:border-surface-700"
          onClick={onPinWorkingSprint}
          title="Guarda este sprint como vista por defecto al abrir el tablero"
        >
          <Pin className="size-3.5" aria-hidden />
          <span className="hidden min-[480px]:inline">Fijar</span>
        </Button>
      ) : null}
      {isPinnedView ? (
        <span className="text-muted-foreground max-w-[5.5rem] truncate text-xs min-[480px]:max-w-[140px]">
          Vista guardada
        </span>
      ) : null}
      {canEdit && (
        <>
          <span
            className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium ${
              value === 'all'
                ? 'border-surface-200 bg-surface-50 text-surface-600 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-400'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
            title={
              value === 'all'
                ? 'Arrastre de tarjetas desactivado en vista global.'
                : 'Arrastre de tarjetas activado en sprint/backlog.'
            }
          >
            {value === 'all' ? (
              <>
                <X className="size-3.5" aria-hidden />
                <span className="hidden min-[380px]:inline">Mover: </span>no
              </>
            ) : (
              <>
                <Check className="size-3.5" aria-hidden />
                <span className="hidden min-[380px]:inline">Mover: </span>sí
              </>
            )}
          </span>
          {activeSprintForClose && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 px-2 sm:px-3"
              disabled={completeBusy}
              onClick={() => void handleCompleteActive()}
            >
              {completeBusy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : null}
              <span className="hidden min-[400px]:inline">Cerrar sprint</span>
              <span className="min-[400px]:hidden">Cerrar</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 gap-1 border-surface-200 px-2 dark:border-surface-700 sm:px-3"
            onClick={() => {
              setNewStartsAt('');
              setNewEndsAt('');
              setDialogOpen(true);
            }}
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="hidden min-[400px]:inline">Nuevo sprint</span>
            <span className="min-[400px]:hidden">Nuevo</span>
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="border-b border-surface-200 bg-surface-50/90 dark:border-surface-800 dark:bg-surface-900/80">
      <div className="w-full px-4 py-2.5 sm:px-6 sm:py-2 lg:px-8">
        {/* Una sola cuadrícula (un solo select). Móvil: extremos arriba, panel abajo. sm+: tres columnas a ancho completo. */}
        <div className="grid w-full min-h-[3.5rem] grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-start gap-x-2 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1 sm:items-center sm:gap-x-3 sm:gap-y-0 md:gap-x-6">
          <div className="min-w-0 justify-self-start sm:col-start-1 sm:row-start-1">
            {selectCluster}
          </div>
          <div className="flex justify-end justify-self-end sm:col-start-3 sm:row-start-1 sm:justify-self-end">
            {actionsCluster}
          </div>
          <div className="col-span-2 flex min-w-0 justify-center border-t border-surface-200/80 pt-3 dark:border-surface-800 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:border-t-0 sm:pt-0">
            {centerPanel}
          </div>
        </div>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-sprint-name">Nombre</Label>
              <Input
                id="new-sprint-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej. Sprint 2 — API"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-sprint-goal">Objetivo (opcional)</Label>
              <Input
                id="new-sprint-goal"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="Breve objetivo del sprint"
                maxLength={500}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-sprint-starts">Inicio (opcional)</Label>
                <Input
                  id="new-sprint-starts"
                  type="date"
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-sprint-ends">Fin (opcional)</Label>
                <Input
                  id="new-sprint-ends"
                  type="date"
                  value={newEndsAt}
                  onChange={(e) => setNewEndsAt(e.target.value)}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Los demás sprints activos de este tablero pasarán a completados.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!newName.trim() || busy}
              onClick={() => void handleCreateSprint()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
