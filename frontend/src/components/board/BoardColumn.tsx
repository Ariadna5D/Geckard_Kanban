import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
}

export const BoardColumn = ({ column, boardId }: BoardColumnProps) => {
  const { addTask, editColumn, deleteColumn } = useActiveBoardStore();
  
  // Estados para edición y borrado
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const taskIds = column.tasks?.map((t) => t._id) || [];

  const { setNodeRef } = useDroppable({
    id: column._id,
    data: { type: 'Column', column },
  });

  useEffect(() => {
    if (isEditingTitle && inputRef.current) inputRef.current.focus();
  }, [isEditingTitle]);

  /**
   * Ejecuta el cambio de nombre de la columna
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
   * Crea una tarea al final de la lista con Fractional Indexing
   */
  const handleCreateTask = async (title: string) => {
    const tasks = column.tasks || [];
    const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
    const newOrder = calculateNewOrder(lastTask ? lastTask.order : null, null);
    await addTask(boardId, column._id, title, newOrder);
  };

  return (
    <>
      <div className="flex-shrink-0 w-80 max-h-full flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
        
        {/* Header con Edición Inline y Menú */}
        <div className="p-4 flex items-center justify-between flex-shrink-0 group/header">
          {isEditingTitle ? (
            <Input
              ref={inputRef}
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleUpdateTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle()}
              className="h-7 text-sm font-semibold bg-white"
            />
          ) : (
            <h3 
              onClick={() => setIsEditingTitle(true)}
              className="font-semibold text-sm text-slate-700 cursor-text flex-1"
            >
              {column.title}
            </h3>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium bg-slate-200 px-2 py-0.5 rounded-full">
              {column.tasks?.length || 0}
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-slate-400 hover:text-slate-600 outline-none">
                  <MoreHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-white">
                <DropdownMenuItem onClick={() => setIsEditingTitle(true)}>
                  <Pencil size={14} className="mr-2" /> Rename
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setShowDeleteAlert(true)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 size={14} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Lista de tareas */}
        <div 
          ref={setNodeRef} 
          className="flex-1 overflow-y-auto p-3 pt-0 flex flex-col gap-3 min-h-[150px]"
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {column.tasks?.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
          </SortableContext>
        </div>

        <div className="p-3 flex-shrink-0">
          <InlineCreateForm actionText="Add task" onSubmit={handleCreateTask} />
        </div>
      </div>

      {/* Alerta de confirmación de borrado */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the column <strong>"{column.title}"</strong> and all its 
              associated tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-100">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteColumn(boardId, column._id)}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};