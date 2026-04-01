import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveBoardStore } from '../store/useActiveBoardStore';
import { BoardColumn } from '../components/board/BoardColumn';
import { InlineCreateForm } from '../components/shared/InlineCreateForm'; // Importamos el compartido
import { Loader2 } from 'lucide-react';

/**
 * Página principal del tablero (Canvas). 
 * Renderiza las columnas y el formulario para añadir nuevas.
 */
export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { board, isLoading, error, fetchBoard, addColumn } = useActiveBoardStore();

  useEffect(() => {
    if (slug) {
      fetchBoard(slug);
    }
  }, [slug, fetchBoard]);

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
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{board?.title}</h1>
          {board?.description && (
            <p className="text-sm text-slate-500 mt-1">{board?.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
            {board?.columns.length} Columns
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-8">
        <div className="flex gap-6 h-full items-start">
          {board?.columns.map((column) => (
            <BoardColumn key={column._id} column={column} boardId={board._id} />
          ))}

          {/* Formulario Inline reutilizable para Columnas */}
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
      </main>
    </div>
  );
};