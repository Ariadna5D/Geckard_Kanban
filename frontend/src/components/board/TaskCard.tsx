import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../../types/board.types';
import { Trash2, AlignLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export const TaskCard = ({ task, isOverlay }: TaskCardProps) => {
  const { deleteTask, updateTask } = useActiveBoardStore();
  
  // AQUÍ ESTÁN LOS ESTADOS QUE FALTABAN
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: 'Task', task },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const handleSaveChanges = async () => {
    await updateTask(task._id, task.columnId, {
      title: editTitle,
      description: editDescription,
    });
    setIsPanelOpen(false);
  };

  // --- 1. EL CLON FLOTANTE (Lo que llevas en el ratón) ---
  if (isOverlay) {
    return (
      <div className="relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 bg-surface-50 p-3 text-sm shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20">
        <p className="pr-6 font-medium leading-relaxed text-surface-900 dark:text-surface-50">{task.title}</p>
        {task.description && (
          <div className="mt-2 flex items-center text-surface-500 dark:text-surface-400">
            <AlignLeft size={14} />
          </div>
        )}
      </div>
    );
  }

  // --- 2. EL HUECO (Lo que se queda en la lista original) ---
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  // --- 3. LA TARJETA NORMAL Y EL PANEL LATERAL ---
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setIsPanelOpen(true)}
        className="group relative cursor-grab select-none rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md active:cursor-grabbing dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45"
      >
        <p className="pr-6 font-medium leading-relaxed text-surface-900 dark:text-surface-50">{task.title}</p>
        {task.description && (
          <div className="mt-2 flex items-center text-surface-500 dark:text-surface-400">
            <AlignLeft size={14} />
          </div>
        )}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task._id, task.columnId);
          }}
          onPointerDown={(e) => e.stopPropagation()} 
          className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* EL PANEL LATERAL (SHEET) */}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent className="flex w-[90vw] flex-col gap-0 border-l border-surface-200 bg-surface-50 p-0 sm:max-w-lg dark:border-surface-800 dark:bg-surface-900">
          
          <SheetHeader className="border-b border-surface-200 p-6 dark:border-surface-800">
            <SheetTitle className="text-left text-xl text-surface-900 dark:text-surface-50">Task Details</SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-surface-100 p-6 dark:bg-surface-950">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">Title</label>
              <Input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-10 bg-surface-50 text-base font-medium shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
            </div>
            
            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">Description</label>
              <Textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                className="min-h-50 flex-1 resize-none bg-surface-50 shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
            </div>
          </div>

          <SheetFooter className="border-t border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-900">
            <Button variant="outline" onClick={() => setIsPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges}>
              Save changes
            </Button>
          </SheetFooter>

        </SheetContent>
      </Sheet>
    </>
  );
};