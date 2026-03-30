import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios.instance";
import { Board } from "../types/board.types"; // Revisa que este archivo incluya 'columns'
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BoardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        const response = await api.get<Board>(`/boards/${slug}`);
        setBoard(response.data);
      } catch (error) {
        navigate("/dashboard");
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchBoardData();
  }, [slug, navigate]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold text-slate-800">{board?.title}</h1>
        </div>
      </header>

      <div className="flex gap-6 overflow-x-auto pb-4">
        {/* Aquí es donde crujía: añadimos comprobación de seguridad */}
        {board?.columns && board.columns.length > 0 ? (
          board.columns.map((col) => (
            <div key={col._id} className="min-w-[300px] w-[300px] bg-slate-200/50 rounded-xl p-4">
              <h3 className="font-bold text-slate-700 mb-4">{col.title}</h3>
              {/* Espacio para tareas en el futuro */}
            </div>
          ))
        ) : (
          <div className="text-slate-400 italic">No hay columnas en este tablero.</div>
        )}
      </div>
    </div>
  );
};