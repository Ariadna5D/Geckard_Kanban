import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  CircleDot,
  Eye,
  History,
  Info,
  Library,
  LayoutGrid,
  LayoutPanelLeft,
  Loader2,
  Rocket,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Board } from '@/types/board.types';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Define la vista de sprint
export type SprintViewValue = 'all' | 'active' | `closed:${string}`;
type NewSprintPayload = {
  name: string;
  startedAt?: string;
  plannedEndAt?: string;
  objective?: string;
};

// Busca el sprint activo
function getActiveSprintRow(board: Board) {
  const sprintRows = board.sprints ?? [];
  const activeId = board.activeSprintId;
  if (!activeId) {
    return null;
  }
  for (let sprintIndex = 0; sprintIndex < sprintRows.length; sprintIndex++) {
    if (sprintRows[sprintIndex]._id === activeId) {
      return sprintRows[sprintIndex];
    }
  }
  if (sprintRows.length > 0) {
    return sprintRows[0];
  }
  return null;
}

// Convierte fecha a inicio de dia
function dateInputToStartIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return new Date(`${trimmed}T08:00:00`).toISOString();
}

// Convierte fecha a fin de dia
function dateInputToEndIso(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return new Date(`${trimmed}T23:59:59`).toISOString();
}

// Devuelve la fecha de hoy
function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type BoardSprintHeaderControlsProps = {
  board: Board;
  slug: string;
  canEdit: boolean;
  sprintView: SprintViewValue;
  onSprintViewChange: (next: SprintViewValue) => void;
  placement?: 'title-row' | 'actions-row' | 'panel-row';
};

// Expone acciones del header
export type BoardSprintHeaderControlsHandle = {
  openNewSprintDialog: () => void;
  openCloseSprintDialog: () => void;
};

// Muestra los controles de sprint
export const BoardSprintHeaderControls = forwardRef<
  BoardSprintHeaderControlsHandle,
  BoardSprintHeaderControlsProps
>(function BoardSprintHeaderControls(
  {
    board,
    slug,
    canEdit,
    sprintView,
    onSprintViewChange,
    placement = 'title-row',
  },
  ref,
) {
  const startBoardSprint = useActiveBoardStore((state) => state.startBoardSprint);
  const closeBoardSprint = useActiveBoardStore((state) => state.closeBoardSprint);
  const cancelActiveSprintBoard = useActiveBoardStore(
    (state) => state.cancelActiveSprintBoard,
  );
  const fetchBoard = useActiveBoardStore((state) => state.fetchBoard);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintStartDate, setNewSprintStartDate] = useState(todayInputValue);
  const [newSprintEndDate, setNewSprintEndDate] = useState('');
  const [newSprintObjective, setNewSprintObjective] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [closeBusy, setCloseBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const activeRow = getActiveSprintRow(board);
  const activeSprintId = board.activeSprintId;
  let hasActiveSprint = false;
  if (activeSprintId && activeRow !== null) {
    hasActiveSprint = true;
  }

  const closedRecords = (board.closedSprintRecords ?? []).slice().reverse();

  function triggerLabel(): string {
    if (sprintView === 'all') {
      return 'Vista: todas las tareas';
    }
    if (sprintView === 'active') {
      return `Vista: ${activeRow?.name ?? 'Sprint activo'}`;
    }
    let historyId = '';
    if (sprintView.startsWith('closed:')) {
      historyId = sprintView.slice('closed:'.length);
    }
    const record = board.closedSprintRecords?.find(
      (entry) => entry.sprintId === historyId,
    );
    if (record) {
      return `Vista: ${record.sprintName}`;
    }
    return 'Vista: historial';
  }

  function triggerIcon() {
    if (sprintView === 'all') {
      return (
        <LayoutGrid
          className="size-4 shrink-0 opacity-80 sm:size-[1.125rem]"
          aria-hidden
        />
      );
    }
    if (sprintView === 'active') {
      return (
        <Eye
          className="size-4 shrink-0 text-emerald-600 sm:size-[1.125rem]"
          aria-hidden
        />
      );
    }
    return (
      <History
        className="size-4 shrink-0 text-violet-600 sm:size-[1.125rem]"
        aria-hidden
      />
    );
  }

  const noActiveSprintInfoClass =
    'text-amber-600 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-400/15 dark:hover:text-amber-300';

  async function handleSubmitNewSprint() {
    const trimmedName = newSprintName.trim();
    if (!trimmedName) {
      return;
    }
    setCreateBusy(true);
    try {
      // Prepara payload y lo envia al store para llamar al backend
      const startedAt = dateInputToStartIso(newSprintStartDate);
      const plannedEndAt = dateInputToEndIso(newSprintEndDate);
      const trimmedObjective = newSprintObjective.trim();
      const newSprintPayload: NewSprintPayload = { name: trimmedName };
      if (startedAt) {
        newSprintPayload.startedAt = startedAt;
      }
      if (plannedEndAt) {
        newSprintPayload.plannedEndAt = plannedEndAt;
      }
      if (trimmedObjective) {
        newSprintPayload.objective = trimmedObjective;
      }
      await startBoardSprint(board._id, newSprintPayload);
      setCreateDialogOpen(false);
      setNewSprintName('');
      setNewSprintStartDate(todayInputValue());
      setNewSprintEndDate('');
      setNewSprintObjective('');
      onSprintViewChange('active');
      // Refresco silencioso para traer columnas y tareas actualizadas
      void fetchBoard(slug, { silent: true });
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleConfirmClose() {
    if (!activeSprintId) {
      setCloseConfirmOpen(false);
      return;
    }
    const closedSprintHistoryId = activeSprintId;
    setCloseBusy(true);
    try {
      // Cierra sprint activo y abre vista de historial cerrado
      await closeBoardSprint(board._id, closedSprintHistoryId);
      setCloseConfirmOpen(false);
      onSprintViewChange(`closed:${closedSprintHistoryId}`);
      void fetchBoard(slug, { silent: true });
    } catch {
    } finally {
      setCloseBusy(false);
    }
  }

  async function handleConfirmCancel() {
    if (!activeSprintId) {
      setCancelConfirmOpen(false);
      return;
    }
    setCancelBusy(true);
    try {
      // Cancela sprint sin historial y vuelve a vista general
      await cancelActiveSprintBoard(board._id, activeSprintId);
      setCancelConfirmOpen(false);
      onSprintViewChange('all');
      void fetchBoard(slug, { silent: true });
    } finally {
      setCancelBusy(false);
    }
  }

  const activeObjectiveTrimmed = activeRow?.objective?.trim() ?? '';

  const openNewSprintDialog = useCallback(() => {
    setNewSprintName('');
    setNewSprintStartDate(todayInputValue());
    setNewSprintEndDate('');
    setNewSprintObjective('');
    setCreateDialogOpen(true);
  }, []);

  const openCloseSprintDialog = useCallback(() => {
    if (!activeSprintId || !hasActiveSprint) {
      return;
    }
    setCloseConfirmOpen(true);
  }, [activeSprintId, hasActiveSprint]);

  useImperativeHandle(
    ref,
    () => ({
      openNewSprintDialog,
      openCloseSprintDialog,
    }),
    [openNewSprintDialog, openCloseSprintDialog],
  );

  const inActionsRow = placement === 'actions-row';
  const inPanelRow = placement === 'panel-row';
  let containerClassName = 'flex min-w-0 max-w-full flex-col gap-1.5 sm:max-w-xl';
  if (inActionsRow || inPanelRow) {
    containerClassName = 'flex min-w-0 max-w-full flex-col gap-0';
  }

  let triggerButtonClassName =
    'w-full shrink gap-1.5 border-surface-500 bg-surface-50 px-3 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:ring-surface-700/70 sm:w-auto sm:max-w-[min(100vw-8rem,24rem)]';
  if (inPanelRow) {
    triggerButtonClassName =
      'h-11 w-full justify-start gap-2 border-surface-500 bg-surface-50 px-3 text-lg font-semibold text-surface-800 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70';
  }
  if (inActionsRow) {
    triggerButtonClassName =
      'h-11 w-auto max-w-[min(100vw-11rem,22rem)] shrink gap-2 border-surface-500 bg-surface-50 px-3 text-lg font-semibold text-surface-800 ring-1 ring-surface-300/90 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:ring-surface-700/70 sm:max-w-[min(100vw-8rem,24rem)]';
  }

  let menuAlign: 'end' | 'start' = 'start';
  if (inActionsRow) {
    menuAlign = 'end';
  }
  let activeSprintTitle = 'Inicia un sprint nuevo arriba para poder usar esta vista.';
  if (hasActiveSprint) {
    activeSprintTitle = activeRow?.name ?? 'Sprint activo';
  }

  let triggerLabelSpanClass = 'min-w-0 flex-1 truncate text-left';
  if (inActionsRow || inPanelRow) {
    triggerLabelSpanClass =
      'min-w-0 flex-1 truncate text-left text-lg font-semibold text-surface-800 dark:text-surface-100';
  }

  return (
    <>
      <div
        className={containerClassName}
      >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="default"
            className={triggerButtonClassName}
          >
            {triggerIcon()}
            <span className={triggerLabelSpanClass}>{triggerLabel()}</span>
            {sprintView === 'all' && !hasActiveSprint && (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span
                    role="presentation"
                    className={`inline-flex shrink-0 cursor-help rounded-sm p-0.5 ${noActiveSprintInfoClass}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                      }
                    }}
                  >
                    <Info className="size-5" aria-hidden />
                    <span className="sr-only">Sin sprint activo</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  No hay sprint activo. Puedes iniciar uno en el menú de sprints.
                </TooltipContent>
              </Tooltip>
            )}
            {sprintView.startsWith('closed:') && (
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex shrink-0 rounded-sm p-0.5 text-surface-500 hover:bg-surface-200/80 hover:text-surface-700 dark:text-surface-400 dark:hover:bg-surface-700/80 dark:hover:text-surface-200"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Info className="size-5" aria-hidden />
                    <span className="sr-only">Vista de sprint cerrado</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Vista de solo lectura de un sprint ya archivado.
                </TooltipContent>
              </Tooltip>
            )}
            <ChevronDown
              className="ml-0.5 size-[1.125rem] shrink-0 opacity-70 sm:size-5"
              aria-hidden
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={menuAlign}
          className="z-90 w-72"
        >
          {canEdit && !hasActiveSprint && (
            <>
              <DropdownMenuLabel className="flex items-center justify-between gap-2 pr-1 text-sm font-normal text-muted-foreground">
                <span className="font-medium text-foreground">Sprint</span>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <span
                      role="presentation"
                      className={`inline-flex shrink-0 cursor-help rounded-sm p-0.5 ${noActiveSprintInfoClass}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                    >
                      <Info className="size-5" aria-hidden />
                      <span className="sr-only">Más información</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    No hay sprint en curso. Al iniciar uno podrás filtrar por sprint
                    activo y archivarlo al cerrar para conservar el historial.
                  </TooltipContent>
                </Tooltip>
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2 font-medium"
              >
                <Rocket className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="flex-1">Iniciar sprint nuevo…</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <LayoutPanelLeft className="size-3.5 shrink-0" aria-hidden />
            Vista del tablero
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onSprintViewChange('all')} className="gap-2">
            <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Todas las tareas</span>
            {sprintView === 'all' && <Check className="size-4 shrink-0" aria-hidden />}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasActiveSprint}
            className="gap-2"
            title={activeSprintTitle}
            onClick={() => {
              if (hasActiveSprint) {
                onSprintViewChange('active');
              }
            }}
          >
            <Eye className="size-4 shrink-0 text-emerald-600" aria-hidden />
            <span className="flex-1">Ver sprint activo</span>
            {sprintView === 'active' && <Check className="size-4 shrink-0" aria-hidden />}
          </DropdownMenuItem>
          {closedRecords.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <Library className="size-3.5 shrink-0" aria-hidden />
                Sprints cerrados
              </DropdownMenuLabel>
              {closedRecords.map((record) => (
                <DropdownMenuItem
                  key={record.sprintId}
                  className="gap-2"
                  onClick={() =>
                    onSprintViewChange(`closed:${record.sprintId}` as SprintViewValue)
                  }
                >
                  <History className="size-4 shrink-0 text-violet-600" aria-hidden />
                  <span className="flex-1 truncate">{record.sprintName}</span>
                  {sprintView === (`closed:${record.sprintId}` as SprintViewValue) && (
                    <Check className="size-4 shrink-0" aria-hidden />
                  )}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {canEdit && hasActiveSprint ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <CircleDot className="size-3.5" aria-hidden />
                Gestión del sprint activo
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setCloseConfirmOpen(true)}
                className="gap-2"
                title="Genera el historial del sprint y desvincula las tareas del sprint activo."
              >
                <Archive className="size-4 shrink-0 text-emerald-600" aria-hidden />
                Cerrar sprint
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 text-danger focus:text-danger"
                title="Borra el sprint activo sin historial; las tareas dejan de estar enlazadas a ese sprint."
                onClick={() => setCancelConfirmOpen(true)}
              >
                <XCircle className="size-4 shrink-0" aria-hidden />
                Cancelar sprint
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {!inActionsRow &&
      sprintView === 'active' &&
      activeObjectiveTrimmed.length > 0 ? (
        <p className="text-muted-foreground max-w-full text-sm leading-snug">
          <span className="font-medium text-foreground/90">Objetivo: </span>
          <span className="whitespace-pre-wrap">{activeObjectiveTrimmed}</span>
        </p>
      ) : null}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">Nombre</Label>
              <Input
                id="sprint-name"
                value={newSprintName}
                onChange={(event) => setNewSprintName(event.target.value)}
                placeholder="Ej. Sprint 3"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-start">Fecha de inicio</Label>
              <Input
                id="sprint-start"
                type="date"
                value={newSprintStartDate}
                onChange={(event) => setNewSprintStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-end">Fecha de fin planificada (opcional)</Label>
              <Input
                id="sprint-end"
                type="date"
                value={newSprintEndDate}
                onChange={(event) => setNewSprintEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-objective">Objetivo del sprint (opcional)</Label>
              <Textarea
                id="sprint-objective"
                value={newSprintObjective}
                onChange={(event) => setNewSprintObjective(event.target.value)}
                placeholder="Ej. Reducir deuda técnica en el módulo de facturación"
                maxLength={2000}
                rows={3}
                className="min-h-18 resize-y"
              />
              <p className="text-muted-foreground text-xs">
                Un texto breve que recuerde el foco del equipo en este sprint.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={createBusy}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={createBusy || !newSprintName.trim()}
              onClick={() => void handleSubmitNewSprint()}
            >
              {createBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Crear sprint'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar y archivar el sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              Se guardará el listado de tareas al momento del cierre. Las tareas
              dejarán de estar enlazadas a este sprint.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closeBusy}>Volver</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={closeBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmClose();
              }}
            >
              {closeBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Archivar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              No se guardará historial. Las tareas perderán el enlace al sprint
              activo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Volver</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-danger text-white hover:bg-danger/90"
              disabled={cancelBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmCancel();
              }}
            >
              {cancelBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                'Cancelar sprint'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

BoardSprintHeaderControls.displayName = 'BoardSprintHeaderControls';
