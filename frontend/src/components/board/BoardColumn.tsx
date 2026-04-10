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
import { Column } from '../../types/board.types';
import { TaskCard } from './TaskCard';
import { InlineCreateForm } from '../shared/InlineCreateForm';
import { calculateNewOrder } from '../../utils/boardMath';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import { MoreHorizontal, Trash2, Pencil } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  boardId: string;
  /** Si es false, la columna es solo lectura (rol viewer en el tablero). */
  canEdit?: boolean;
}

export const BoardColumn = ({
  column,
  boardId,
  canEdit = true,
}: BoardColumnProps) => {
  const { addTask, editColumn, deleteColumn } = useActiveBoardStore();
  
  // Estado local para edición inline del título y confirmación de borrado.
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const taskIds = column.tasks?.map((task) => task._id) || [];

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
    disabled: !canEdit,
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
    await addTask(boardId, column._id, title, newOrder);
  };

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

  function handleOpenDeleteAlert() {
    setShowDeleteAlert(true);
  }

  function handleConfirmDeleteColumn() {
    deleteColumn(boardId, column._id);
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
        }`}
      >
        <div 
          {...(canEdit ? attributes : {})} 
          {...(canEdit ? listeners : {})}
          className={`p-4 flex items-center justify-between shrink-0 group/header ${
            canEdit ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
        >
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              value={titleValue}
              onChange={handleTitleInputChange}
              onBlur={handleUpdateTitle}
              onKeyDown={handleTitleKeyDown}
              className="h-7 bg-surface-50 text-sm font-semibold dark:bg-surface-900"
              onPointerDown={handlePointerDownStop}
            />
          ) : (
            <h3 
              onClick={handleTitleClick}
              className={`flex-1 text-sm font-semibold text-surface-800 dark:text-surface-100 ${canEdit ? 'cursor-text' : ''}`}
              onPointerDown={handlePointerDownStop}
            >
              {column.title}
            </h3>
          )}

          <div className="flex items-center gap-2" onPointerDown={handlePointerDownStop}>
            <span className="rounded-full bg-surface-200 px-2 py-0.5 text-xs font-medium text-surface-600 dark:bg-surface-700 dark:text-surface-300">
              {column.tasks?.length || 0}
            </span>
            {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-0.5 text-surface-500 outline-none hover:bg-primary-500/10 hover:text-primary-700 dark:text-surface-400 dark:hover:bg-primary-500/15 dark:hover:text-primary-300"><MoreHorizontal size={18} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleStartTitleEdit}><Pencil size={14} className="mr-2" /> Rename</DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenDeleteAlert} className="text-danger focus:bg-danger/10 focus:text-danger">
                  <Trash2 size={14} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </div>
        </div>

        <div className="mx-2 mb-1 flex min-h-kanban-col-body flex-1 flex-col gap-3 overflow-y-auto rounded-lg bg-surface-100/90 p-2 pt-2 dark:bg-surface-950/50">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {column.tasks?.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                readOnly={!canEdit}
              />
            ))}
          </SortableContext>
        </div>

        {canEdit && (
        <div className="p-3 shrink-0" onPointerDown={handlePointerDownStop}>
          <InlineCreateForm actionText="Add task" onSubmit={handleCreateTask} />
        </div>
        )}
      </div>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the column <strong>"{column.title}"</strong> and all its 
              associated tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-secondary">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteColumn} className="bg-danger text-white hover:bg-danger/90">Delete Column</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};