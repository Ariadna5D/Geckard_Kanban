import { Column } from '../../types/board.types';
import { Plus } from 'lucide-react';

interface BoardColumnProps {
  column: Column;
  boardId: string;
}

export const BoardColumn = ({ column, boardId }: BoardColumnProps) => {
  return (
    // 'flex-shrink-0' evita que las columnas se aplasten cuando hay muchas
    <div className="flex-shrink-0 w-80 max-h-full flex flex-col bg-slate-100/50 rounded-xl border border-slate-200">
      
      {/* 1. Header de la Columna */}
      <div className="p-4 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-sm text-slate-700">{column.title}</h3>
        {/* Contador estilo Linear */}
        <span className="text-xs text-slate-400 font-medium bg-slate-200 px-2 py-0.5 rounded-full">
          {column.tasks?.length || 0}
        </span>
      </div>

      {/* 2. Zona de Tareas (Scroll Vertical) */}
      <div className="flex-1 overflow-y-auto p-3 pt-0 space-y-3">
        {column.tasks?.map((task) => (
          // Un placeholder temporal hasta que hagamos el componente TaskCard
          <div 
            key={task._id} 
            className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 text-sm hover:border-blue-400 transition-colors cursor-grab"
          >
            {task.title}
          </div>
        ))}
      </div>

      {/* 3. Botón de añadir tarea (Keyboard-first en el futuro) */}
      <div className="p-3 flex-shrink-0">
        <button className="w-full text-left text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 p-2 rounded-md transition-colors flex items-center gap-1">
          <Plus size={16} />
          <span>Add task</span>
        </button>
      </div>
    </div>
  );
};