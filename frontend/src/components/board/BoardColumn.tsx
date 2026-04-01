import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Column } from '../../types/board.types';
import { TaskCard } from './TaskCard';
import { InlineCreateForm } from '../shared/InlineCreateForm';
import { calculateNewOrder } from '../../utils/boardMath';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';

interface BoardColumnProps {
  column: Column;
  boardId: string;
}

export const BoardColumn = ({ column, boardId }: BoardColumnProps) => {
  const { addTask } = useActiveBoardStore();
  const taskIds = column.tasks?.map((t) => t._id) || [];

  const { setNodeRef } = useDroppable({
    id: column._id,
    data: {
      type: 'Column',
      column,
    },
  });

  /**
   * Calcula el Fractional Index para colocar la tarea al final y llama al store.
   */
  const handleCreateTask = async (title: string) => {
    const tasks = column.tasks || [];
    const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null;
    
    // Si no hay tareas, el primer parámetro será null.
    const newOrder = calculateNewOrder(lastTask ? lastTask.order : null, null);
    
    await addTask(boardId, column._id, title, newOrder);
  };

  return (
    <div className="flex-shrink-0 w-80 max-h-full flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
      
      <div className="p-4 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm text-slate-700">{column.title}</h3>
        <span className="text-xs text-slate-400 font-medium bg-slate-200 px-2 py-0.5 rounded-full">
          {column.tasks?.length || 0}
        </span>
      </div>

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
        <InlineCreateForm 
          actionText="Add task"
          onSubmit={handleCreateTask}
        />
      </div>
    </div>
  );
};