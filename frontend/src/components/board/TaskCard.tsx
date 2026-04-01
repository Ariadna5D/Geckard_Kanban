import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '../../types/board.types';
import { Trash2 } from 'lucide-react'; // Importamos el icono
import { useActiveBoardStore } from '@/store/useActiveBoardStore';

interface TaskCardProps {
  task: Task;
}

export const TaskCard = ({ task }: TaskCardProps) => {
  const { deleteTask } = useActiveBoardStore();
  
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

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="bg-blue-50/50 border-2 border-blue-400 border-dashed rounded-lg min-h-[60px] opacity-50"
      />
    );
  }

  // Función para borrar sin disparar el Drag & Drop
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Evita que el evento suba al contenedor arrastrable
    deleteTask(task._id, task.columnId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm hover:border-blue-400 transition-colors cursor-grab active:cursor-grabbing group select-none relative"
    >
      <p className="text-slate-700 font-medium leading-relaxed pr-6">{task.title}</p>
      
      {/* Botón de borrar: Oculto por defecto, visible en hover */}
      <button 
        onClick={handleDelete}
        // onPointerDown evita que dnd-kit intercepte el clic del ratón
        onPointerDown={(e) => e.stopPropagation()} 
        className="absolute top-3 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};