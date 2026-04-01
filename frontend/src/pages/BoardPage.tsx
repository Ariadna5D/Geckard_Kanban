import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveBoardStore } from '../store/useActiveBoardStore';
import { BoardColumn } from '../components/board/BoardColumn';
import { InlineCreateForm } from '../components/shared/InlineCreateForm';
import { Loader2 } from 'lucide-react';
import { calculateNewOrder } from '../utils/boardMath';
import { Task, Column } from '../types/board.types';

// --- DND-KIT IMPORTS ---
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard } from '../components/board/TaskCard';

/**
 * Página principal del tablero Kanban.
 * Actúa como el gran controlador (DndContext) para el drag & drop bidimensional.
 */
export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { 
    board, 
    isLoading, 
    error, 
    fetchBoard, 
    addColumn, 
    moveTaskOptimistic, 
    moveColumnOptimistic 
  } = useActiveBoardStore();

  // Estados para los "clones fantasma" que llevamos en el ratón
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);

  useEffect(() => {
    if (slug) fetchBoard(slug);
  }, [slug, fetchBoard]);

  /**
   * Sensores de movimiento. 5px de tolerancia para diferenciar 
   * un click normal (abrir panel) de un arrastre.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnIds = board?.columns.map(c => c._id) || [];

  /**
   * Se dispara al hacer clic y empezar a mover algo.
   * Guarda qué estamos moviendo para renderizar el DragOverlay.
   */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'Task') {
      setActiveTask(active.data.current.task);
    } else if (active.data.current?.type === 'Column') {
      setActiveColumn(active.data.current.column);
    }
  };

  /**
   * El motor de cálculo. Se dispara al soltar el ratón.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    setActiveColumn(null);

    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Si lo sueltas en el mismo sitio exacto, no hacemos nada
    if (activeId === overId) return;

    const activeType = active.data.current?.type;
    const overData = over.data.current as any;

    // ==========================================
    // LÓGICA 1: MOVER COLUMNAS (HORIZONTAL)
    // ==========================================
    if (activeType === 'Column') {
      const oldIndex = board.columns.findIndex(c => c._id === activeId);
      const newIndex = board.columns.findIndex(c => c._id === overId);
      
      // Simulamos el movimiento en un array temporal para calcular los vecinos fácilmente
      const tempColumns = [...board.columns];
      const [movedColumn] = tempColumns.splice(oldIndex, 1);
      tempColumns.splice(newIndex, 0, movedColumn);

      const prevCol = newIndex > 0 ? tempColumns[newIndex - 1] : null;
      const nextCol = newIndex < tempColumns.length - 1 ? tempColumns[newIndex + 1] : null;
      
      const newOrder = calculateNewOrder(prevCol?.order || null, nextCol?.order || null);
      
      moveColumnOptimistic(board._id, activeId, newOrder);
      return;
    }

    // ==========================================
    // LÓGICA 2: MOVER TAREAS (VERTICAL / CRUZADO)
    // ==========================================
    if (activeType === 'Task') {
      const sourceColumnId = active.data.current?.task?.columnId;
      const destColumnType = overData?.type;
      const destColumnId = destColumnType === 'Column' 
        ? overData?.column?._id 
        : overData?.task?.columnId;

      if (!sourceColumnId || !destColumnId) return;

      const destCol = board.columns.find(c => c._id === destColumnId);
      if (!destCol) return;
      const destTasks = destCol.tasks || [];

      let newOrder = '';

      // CASO A: Soltamos en una columna vacía o directamente al fondo
      if (destColumnType === 'Column') {
        const lastTask = destTasks.length > 0 ? destTasks[destTasks.length - 1] : null;
        newOrder = calculateNewOrder(lastTask ? lastTask.order : null, null);
      } 
      // CASO B: Soltamos sobre otra tarea específica
      else {
        const overIndex = destTasks.findIndex(t => t._id === overId);
        
        // Detectamos si soltamos en la mitad de abajo o la mitad de arriba de la tarjeta destino
        const isBelowOverItem = 
          over && 
          active.rect.current.translated && 
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2;

        let prevTask = null;
        let nextTask = null;

        if (isBelowOverItem) {
          prevTask = destTasks[overIndex];
          nextTask = overIndex === destTasks.length - 1 ? null : destTasks[overIndex + 1];
        } else {
          prevTask = overIndex === 0 ? null : destTasks[overIndex - 1];
          nextTask = destTasks[overIndex];
        }

        // Si los vecinos calculados son la propia tarea que estamos moviendo, ajustamos
        if (prevTask?._id === activeId) prevTask = overIndex - 1 >= 0 ? destTasks[overIndex - 1] : null;
        if (nextTask?._id === activeId) nextTask = overIndex + 1 < destTasks.length ? destTasks[overIndex + 1] : null;

        newOrder = calculateNewOrder(prevTask?.order || null, nextTask?.order || null);
      }

      moveTaskOptimistic(
        activeId, 
        sourceColumnId, 
        destColumnId, 
        newOrder, 
        { newColumnId: destColumnId, newOrder }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (error || (!isLoading && !board)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex-shrink-0 flex items-center justify-between shadow-sm relative z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{board?.title}</h1>
          {board?.description && (
            <p className="text-sm text-slate-500 mt-1">{board?.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {board?.columns.length} Columns
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-8">
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 h-full items-start">
            
            {/* CONTEXTO HORIZONTAL PARA LAS COLUMNAS */}
            <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
              {board.columns.map((column) => (
                <BoardColumn key={column._id} column={column} boardId={board._id} />
              ))}
            </SortableContext>

            {/* FORMULARIO DE NUEVA COLUMNA */}
            <div className="flex-shrink-0 w-80">
              <InlineCreateForm 
                actionText="Add another column"
                placeholder="Column title..."
                onSubmit={(value) => addColumn(board._id, value)}
                triggerClassName="w-full bg-slate-200/50 hover:bg-slate-200 text-slate-600 rounded-xl p-4 text-sm font-medium transition-colors text-left flex items-center gap-2 border border-dashed border-slate-300"
                formClassName="w-full bg-slate-100 rounded-xl p-3 border border-slate-200 shadow-sm"
              />
            </div>
          </div>

          {/* LA MAGIA VISUAL: CLONES FLOTANTES */}
          <DragOverlay
            dropAnimation={{
              duration: 250,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
            {activeColumn ? (
               <div className="w-80 bg-slate-100/80 rounded-xl border-2 border-blue-400 shadow-2xl p-4 scale-[1.02] rotate-2 opacity-90 backdrop-blur-sm">
                 <h3 className="font-semibold text-sm text-slate-700">{activeColumn.title}</h3>
               </div>
            ) : null}
          </DragOverlay>

        </DndContext>
      </main>
    </div>
  );
};