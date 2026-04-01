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
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const { deleteTask, updateTask } = useActiveBoardStore();
  
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

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-blue-50/50 border-2 border-blue-400 border-dashed rounded-lg min-h-[60px] opacity-50"
      />
    );
  }

  return (
    <>
      {/* LA TARJETA */}
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setIsPanelOpen(true)}
        className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm hover:border-blue-400 transition-colors cursor-grab active:cursor-grabbing group select-none relative"
      >
        <p className="text-slate-700 font-medium leading-relaxed pr-6">{task.title}</p>
        
        {task.description && (
          <div className="mt-2 flex items-center text-slate-400">
            <AlignLeft size={14} />
          </div>
        )}
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task._id, task.columnId);
          }}
          onPointerDown={(e) => e.stopPropagation()} 
          className="absolute top-3 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* EL PANEL LATERAL (SHEET) */}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent className="bg-white sm:max-w-[500px] w-[90vw] flex flex-col gap-0 p-0 border-l border-slate-200">
          
          <SheetHeader className="p-6 border-b border-slate-100">
            <SheetTitle className="text-xl text-slate-800 text-left">Task Details</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-slate-50/50">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Title</label>
              <Input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-white focus-visible:ring-blue-500 font-medium text-base h-10 shadow-sm"
              />
            </div>
            
            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-sm font-semibold text-slate-700">Description</label>
              <Textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                className="bg-white focus-visible:ring-blue-500 flex-1 min-h-[200px] resize-none shadow-sm"
              />
            </div>
          </div>

          <SheetFooter className="p-6 border-t border-slate-100 bg-white">
            <Button variant="outline" onClick={() => setIsPanelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveChanges} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save changes
            </Button>
          </SheetFooter>

        </SheetContent>
      </Sheet>
    </>
  );
};