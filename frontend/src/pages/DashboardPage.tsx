import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useBoardStore } from "../store/useBoardStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react"; 

/**
 * Dashboard de usuario. Lista los tableros y permite crear nuevos.
 */
export const DashboardPage = () => {
  const { boards, isLoading, fetchBoards, addBoard } = useBoardStore();
  const { user, isAuthenticated } = useAuthStore();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");

  useEffect(() => {
    if (isAuthenticated && boards.length === 0) {
      fetchBoards();
    }
  }, [fetchBoards, boards.length, isAuthenticated]);

  /**
   * Maneja la creación de un nuevo tablero desde el modal
   */
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault(); 
    try {
      await addBoard({
        title: newBoardTitle,
        description: newBoardDescription,
      });
      setNewBoardTitle("");
      setNewBoardDescription("");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Error creating board", err);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            ¡Hola de nuevo, {user?.username || 'Usuario'}!
          </h2>
          <p className="text-slate-500 mt-2">Bienvenido a tu sistema de gestión.</p>
        </div>

        <Button 
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-md transition-colors"
        >
          <Plus size={20} />
          Nuevo Tablero
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Crear nuevo tablero</DialogTitle>
              <DialogDescription>Dale un nombre a tu proyecto para empezar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateBoard} className="grid gap-4 py-4">
              <Input
                placeholder="Ej: Proyecto MVP"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                required
              />
              <Input
                placeholder="Descripción (opcional)"
                value={newBoardDescription}
                onChange={(e) => setNewBoardDescription(e.target.value)}
              />
              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="bg-blue-600 text-white">
                  {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Crear Tablero"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boards.map((board) => (
          <Link to={`/boards/${board.slug}`} key={board._id} className="block group">
            <article className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg hover:border-blue-400 transition-all h-full">
              <h3 className="font-semibold text-lg text-slate-800 group-hover:text-blue-600 transition-colors mb-2">
                {board.title}
              </h3>
              <p className="text-slate-500 text-sm line-clamp-2">
                {board.description || "Sin descripción"}
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                <span>Slug: {board.slug}</span>
                <span>{new Date(board.createdAt).toLocaleDateString()}</span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </main>
  );
};