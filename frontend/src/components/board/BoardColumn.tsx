import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Column,
  type BoardColumnKind,
  type Task,
} from '../../types/board.types';
import { TaskCard } from './TaskCard';
import { InlineCreateForm } from '../shared/InlineCreateForm';
import { calculateNewOrder } from '../../utils/boardMath';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import {
  Archive,
  Check,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Workflow,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

interface BoardColumnProps {
  column: Column;
  /** Tareas mostradas en la columna (p. ej. filtradas por búsqueda); el store sigue teniendo la lista completa en `column.tasks`. */
  visibleTasks: Task[];
  /** Con filtro activo se desactiva el arrastre para no desincronizar el orden con el backend. */
  taskDragDisabled?: boolean;
  /** Vista distinta de “todas las tareas”: no reordenar columnas (sprint activo/cerrado). */
  columnDragDisabled?: boolean;
  boardId: string;
  /** Si es false, la columna es solo lectura (rol viewer en el tablero). */
  canEdit?: boolean;
}

function columnKindLabel(kind: BoardColumnKind | undefined): string | null {
  if (kind === 'done' || kind === 'archived') {
    return 'Hecho';
  }
  return null;
}

export const BoardColumn = ({
  column,
  visibleTasks,
  taskDragDisabled = false,
  columnDragDisabled = false,
  boardId,
  canEdit = true,
}: BoardColumnProps) => {
  const board = useActiveBoardStore((state) => state.board);
  const { addTask, editColumn, archiveColumn, patchColumn } =
    useActiveBoardStore();

  // Estado local para edición inline del título y confirmación de borrado.
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [showArchiveAlert, setShowArchiveAlert] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const taskIds = visibleTasks.map((task) => task._id);

  /** Hecho y Archivo en backend cuentan igual al cerrar sprint; en UI solo «Hecho». */
  const isCompletionColumn =
    column.columnKind === 'done' || column.columnKind === 'archived';

  const columnKindBadgeLabel = columnKindLabel(column.columnKind);

  /** Sin listeners en el DOM si no se puede arrastrar la columna (vista sprint, etc.). */
  const columnDragAllowed = canEdit && !columnDragDisabled;

  const { 
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column._id,
    data: { type: 'Column', column },
    disabled: !columnDragAllowed,
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  useEffect(() => {
    if (isEditingTitle && inputRef.current) inputRef.current.focus();
  }, [isEditingTitle]);

  /**
   * Guarda el nuevo título de columna si cambió y no está vacío.
   */
  const handleUpdateTitle = async () => {
    if (!titleValue.trim() || titleValue === column.title) {
      setIsEditingTitle(false);
      return;
    }
    await editColumn(boardId, column._id, titleValue.trim());
    setIsEditingTitle(false);
  };

  /**
   * Crea tarea al final de la columna usando order calculado.
   * @param title título de la nueva tarea
   */
  const handleCreateTask = async (title: string) => {
    const tasks = column.tasks || [];
    const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
    const newOrder = calculateNewOrder(lastTask ? lastTask.order : null, null);
    const activeSprintId = board?.activeSprintId;
    const shouldTagSprint =
      board?.sprintsEnabled === true &&
      typeof activeSprintId === 'string' &&
      activeSprintId.length > 0;
    await addTask(
      boardId,
      column._id,
      title,
      newOrder,
      shouldTagSprint ? { sprintId: activeSprintId } : undefined,
    );
  };

  async function handleSetWorkflowOrDone(target: 'workflow' | 'done') {
    if (target === 'workflow') {
      if (!column.columnKind || column.columnKind === 'workflow') return;
      await patchColumn(boardId, column._id, { columnKind: 'workflow' });
      return;
    }
    if (column.columnKind === 'done') return;
    await patchColumn(boardId, column._id, { columnKind: 'done' });
  }

  function handleStartTitleEdit() {
    if (!canEdit) return;
    setIsEditingTitle(true);
  }

  function handleTitleClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    handleStartTitleEdit();
  }

  function handlePointerDownStop(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function handleTitleInputChange(event: ChangeEvent<HTMLInputElement>) {
    setTitleValue(event.target.value);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') void handleUpdateTitle();
  }

  function handleOpenArchiveAlert() {
    setShowArchiveAlert(true);
  }

  async function handleConfirmArchiveColumn() {
    await archiveColumn(boardId, column._id);
    setShowArchiveAlert(false);
  }

  return (
    <>
      <div
        ref={setNodeRef} 
        style={style}
        // Feedback visual de "columna en arrastre".
        className={`kanban-column-width flex max-h-full flex-col rounded-xl border shadow-sm transition-colors ${
          isDragging
            ? 'border-dashed border-surface-400 bg-surface-200/60 opacity-60 dark:border-surface-600 dark:bg-surface-800/40'
            : 'border-surface-200 bg-surface-50 hover:border-primary-500/45 dark:border-surface-800 dark:bg-surface-900 dark:hover:border-primary-400/40'
        } snap-start`}
      >
        <div 
          {...(columnDragAllowed ? attributes : {})} 
          {...(columnDragAllowed ? listeners : {})}
          className={`p-4 flex items-center justify-between shrink-0 group/header ${
            columnDragAllowed ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              value={titleValue}
              onChange={handleTitleInputChange}
              onBlur={handleUpdateTitle}
              onKeyDown={handleTitleKeyDown}
              className="h-7 bg-surface-50 text-base font-semibold dark:bg-surface-900"
              onPointerDown={handlePointerDownStop}
            />
          ) : (
            <h3 
              onClick={handleTitleClick}
              className={`flex-1 text-base font-semibold text-surface-800 dark:text-surface-100 ${canEdit ? 'cursor-text' : ''}`}
              onPointerDown={handlePointerDownStop}
            >
              {column.title}
            </h3>
          )}

          <div className="flex items-center gap-2" onPointerDown={handlePointerDownStop}>
            <span
              className="rounded-full bg-surface-200 px-2 py-0.5 text-xs font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300"
              title="Tareas visibles en esta columna"
            >
              {visibleTasks.length}
            </span>
            {columnKindBadgeLabel ? (
              <span
                className="hidden max-w-[5.5rem] truncate rounded-md border border-surface-200 bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-surface-500 sm:inline dark:border-surface-700 dark:bg-surface-800 dark:text-surface-400"
                title="Tipo de columna para el cierre de sprint"
              >
                {columnKindBadgeLabel}
              </span>
            ) : null}
            {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-0.5 text-surface-500 outline-none hover:bg-primary-500/10 hover:text-primary-700 dark:text-surface-400 dark:hover:bg-primary-500/15 dark:hover:text-primary-300"><MoreHorizontal size={18} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={handleStartTitleEdit}><Pencil size={14} className="mr-2" /> Renombrar</DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">
                    <SlidersHorizontal
                      className="size-4 shrink-0 opacity-80"
                      aria-hidden
                    />
                    Tipo
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[11rem]">
                    <DropdownMenuItem
                      onClick={() => void handleSetWorkflowOrDone('workflow')}
                      title="Tareas no cuentan como completadas al cerrar un sprint."
                      className="flex cursor-pointer items-center justify-between gap-2 pr-2"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Workflow
                          className="size-4 shrink-0 text-sky-600 dark:text-sky-400"
                          aria-hidden
                        />
                        <span>Flujo</span>
                      </span>
                      {!isCompletionColumn ? (
                        <Check className="size-4 shrink-0 opacity-70" aria-hidden />
                      ) : (
                        <span className="inline-block size-4 shrink-0" aria-hidden />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void handleSetWorkflowOrDone('done')}
                      title="Las tareas aquí cuentan como hechas al cerrar el sprint (mismo criterio que columnas «Hecho» antiguas o «Archivo»)."
                      className="flex cursor-pointer items-center justify-between gap-2 pr-2"
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <CheckCircle2
                          className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                        <span>Hecho</span>
                      </span>
                      {isCompletionColumn ? (
                        <Check className="size-4 shrink-0 opacity-70" aria-hidden />
                      ) : (
                        <span className="inline-block size-4 shrink-0" aria-hidden />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenArchiveAlert}>
                  <Archive size={14} className="mr-2 opacity-80" /> Archivar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mx-2 mb-1 flex min-h-kanban-col-body flex-1 flex-col gap-3 overflow-y-auto rounded-lg bg-surface-100/90 p-2 pt-2 [touch-action:pan-y] dark:bg-surface-950/50">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {visibleTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                readOnly={!canEdit}
                disableDrag={taskDragDisabled}
              />
            ))}
          </SortableContext>
        </div>

        {canEdit && (
        <div className="p-3 shrink-0" onPointerDown={handlePointerDownStop}>
          <InlineCreateForm
            actionText="Añadir tarea"
            onSubmit={handleCreateTask}
          />
        </div>
        )}
      </div>

      <AlertDialog open={showArchiveAlert} onOpenChange={setShowArchiveAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar esta columna?</AlertDialogTitle>
            <AlertDialogDescription>
              La columna <strong>&quot;{column.title}&quot;</strong> dejará de mostrarse en el
              tablero. Las tareas que sigan en ella pasarán al panel de{" "}
              <strong>tareas archivadas</strong> (mismo flujo que si archivas una tarjeta).
              Podrás restaurar la columna desde la configuración del tablero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmArchiveColumn()}
              className="bg-surface-800 text-white hover:bg-surface-900 dark:bg-surface-200 dark:text-surface-900 dark:hover:bg-surface-100"
            >
              Archivar columna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};