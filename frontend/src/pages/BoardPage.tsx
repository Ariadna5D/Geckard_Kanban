import { useEffect, useState, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useActiveBoardStore } from '../store/useActiveBoardStore';
import { BoardColumn } from '../components/board/BoardColumn';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  // 1. Añadimos addColumn desde nuestro store
  const { board, isLoading, error, fetchBoard, addColumn } = useActiveBoardStore();

  // 2. Estados locales para controlar el formulario "Inline"
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  
  // 3. Referencia para que el cursor se ponga automáticamente a escribir
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (slug) {
      fetchBoard(slug);
    }
  }, [slug, fetchBoard]);

  // Efecto: Cuando abrimos el formulario, hacemos "focus" en el input
  useEffect(() => {
    if (isAddingColumn && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingColumn]);

  // 4. Función que se ejecuta al darle a "Save" o pulsar Enter
  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue
    if (!newColumnTitle.trim() || !board) return;

    await addColumn(board?._id, newColumnTitle.trim());
    
    // Reseteamos el formulario
    setNewColumnTitle('');
    setIsAddingColumn(false); 
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
      
      {/* Header del Tablero */}
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

      {/* Área del Kanban */}
      <main className="flex-1 overflow-x-auto overflow-y-hidden p-8">
        <div className="flex gap-6 h-full items-start">
          
          {/* Columnas existentes */}
          {board?.columns.map((column) => (
            <BoardColumn key={column._id} column={column} boardId={board?._id} />
          ))}

          {/* 5. LÓGICA DEL FORMULARIO INLINE */}
          {!isAddingColumn ? (
            // ESTADO A: Botón Fantasma
            <button 
              onClick={() => setIsAddingColumn(true)}
              className="flex-shrink-0 w-80 bg-slate-200/50 hover:bg-slate-200 text-slate-600 rounded-xl p-4 text-sm font-medium transition-colors text-left flex items-center gap-2 border border-dashed border-slate-300"
            >
              <Plus size={18} />
              Add another column
            </button>
          ) : (
            // ESTADO B: Formulario activo
            <form 
              onSubmit={handleAddColumn}
              className="flex-shrink-0 w-80 bg-slate-100 rounded-xl p-3 border border-slate-200 shadow-sm"
            >
              <Input
                ref={inputRef}
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Column title..."
                className="mb-3 bg-white"
              />
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Save
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setIsAddingColumn(false);
                    setNewColumnTitle('');
                  }}
                  className="text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                >
                  <X size={18} />
                </Button>
              </div>
            </form>
          )}
          
        </div>
      </main>
    </div>
  );
};