import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useBoardStore } from "../store/useBoardStore";
import {
  type Board,
  boardOwnerUserId,
  getBoardDocumentId,
} from "../types/board.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Plus, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

function canManageBoard(
  board: Board,
  userId: string | undefined,
  role: string | undefined,
): boolean {
  if (role === "admin") return true;
  if (!userId) return false;
  return boardOwnerUserId(board) === userId;
}

/**
 * Dashboard de usuario. Lista los tableros; crear, editar (título/descripción) y eliminar.
 * El slug permanece fijo (URL estable); es el patrón habitual en Notion, Trello, Linear, etc.
 */
export const DashboardPage = () => {
  const {
    boards,
    isLoading,
    fetchBoards,
    addBoard,
    updateBoard,
    removeBoard,
  } = useBoardStore();
  const { user, isAuthenticated } = useAuthStore();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");

  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchBoards();
    }
  }, [isAuthenticated, fetchBoards]);

  useEffect(() => {
    if (editingBoard) {
      setEditTitle(editingBoard.title);
      setEditDescription(editingBoard.description ?? "");
    }
  }, [editingBoard]);

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addBoard({
        title: newBoardTitle,
        description: newBoardDescription,
      });
      setNewBoardTitle("");
      setNewBoardDescription("");
      setIsCreateOpen(false);
    } catch (err) {
      console.error("Error creating board", err);
    }
  };

  const handleUpdateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoard || !editTitle.trim()) return;
    const docId = getBoardDocumentId(editingBoard);
    if (!docId) return;
    setIsSavingEdit(true);
    try {
      await updateBoard(docId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditingBoard(null);
    } catch (err) {
      console.error("Error updating board", err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const docId = getBoardDocumentId(deleteTarget);
    if (!docId) return;
    setIsDeleting(true);
    try {
      await removeBoard(docId);
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting board", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-8">
      <section className="mb-10 rounded-2xl border border-surface-200 bg-surface-50 p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900 md:p-8">
        <div className="min-w-0">
          <h2 className="text-3xl font-bold tracking-tight text-surface-950 dark:text-surface-50 md:text-4xl">
            ¡Hola de nuevo,{" "}
            <span className="text-primary-600 dark:text-primary-400">
              {user?.username || "Usuario"}
            </span>
            !
          </h2>
          <p className="mt-2 max-w-xl text-base text-surface-700 dark:text-surface-400">
            Bienvenido a tu sistema de gestión.
          </p>
        </div>
      </section>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border border-surface-200 bg-surface-50 text-surface-900 shadow-lg dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
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
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : "Crear Tablero"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingBoard !== null}
        onOpenChange={(open) => {
          if (!open) setEditingBoard(null);
        }}
      >
        <DialogContent className="border border-surface-200 bg-surface-50 text-surface-900 shadow-lg dark:border-surface-800 dark:bg-surface-900 dark:text-surface-50">
          <DialogHeader>
            <DialogTitle>Editar tablero</DialogTitle>
            <DialogDescription>
              Actualiza el nombre y la descripción. El enlace del tablero no cambia.
            </DialogDescription>
          </DialogHeader>
          {editingBoard && (
            <form onSubmit={handleUpdateBoard} className="grid gap-4 py-4">
              <div className="rounded-lg border border-surface-200 bg-surface-100/80 px-3 py-2 text-xs text-surface-600 dark:border-surface-700 dark:bg-surface-950/50 dark:text-surface-400">
                <span className="font-medium text-surface-700 dark:text-surface-300">
                  URL del tablero
                </span>
                <p className="mt-1 font-mono text-[0.8rem] text-surface-800 dark:text-surface-200">
                  /boards/{editingBoard.slug}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-board-title">Título</Label>
                <Input
                  id="edit-board-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-board-desc">Descripción (opcional)</Label>
                <Input
                  id="edit-board-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={500}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingBoard(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSavingEdit}>
                  {isSavingEdit ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este tablero?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará <strong>{deleteTarget?.title}</strong> y todas sus columnas y tareas.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Eliminar tablero"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-4 flex items-end justify-between gap-4">
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
          Tus tableros
        </h3>
        {boards.length > 0 && (
          <p className="hidden text-sm text-surface-500 sm:block dark:text-surface-500">
            {boards.length} {boards.length === 1 ? "tablero" : "tableros"}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => {
          const canManage = canManageBoard(board, user?.id, user?.role);
          return (
            <div
              key={board._id}
              className="group relative h-full min-h-[220px] transition-transform duration-200 ease-out will-change-transform hover:-translate-y-0.5"
            >
              <Link
                to={`/boards/${board.slug}`}
                className="block h-full min-h-[220px] rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-950"
              >
                <article
                  className={cn(
                    "flex h-full min-h-[220px] flex-col rounded-xl border border-surface-200 bg-surface-50 p-6 shadow-sm transition-[border-color,box-shadow] duration-200 group-hover:border-primary-500/40 group-hover:shadow-md dark:border-surface-800 dark:bg-surface-900 dark:group-hover:border-primary-400/35 dark:group-hover:shadow-lg",
                    canManage && "pr-11",
                  )}
                >
                  <h3 className="mb-2 text-lg font-semibold text-surface-900 transition-colors group-hover:text-primary-600 dark:text-surface-100 dark:group-hover:text-primary-400">
                    {board.title}
                  </h3>
                  <p className="line-clamp-2 flex-1 text-sm text-surface-600 dark:text-surface-400">
                    {board.description || "Sin descripción"}
                  </p>
                  <div className="mt-4 flex justify-between border-t border-surface-200 pt-4 text-xs text-surface-500 dark:border-surface-800 dark:text-surface-500">
                    <span className="truncate pr-2" title={board.slug}>
                      {board.slug}
                    </span>
                    <span className="shrink-0">
                      {new Date(board.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </article>
              </Link>
              {canManage && (
                <div
                  className="absolute top-3 right-3 z-10"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Acciones: ${board.title}`}
                        className="rounded-md p-0.5 text-surface-500 outline-none hover:bg-primary-500/10 hover:text-primary-700 dark:text-surface-400 dark:hover:bg-primary-500/15 dark:hover:text-primary-300"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => setEditingBoard(board)}
                      >
                        <Pencil size={14} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer text-danger focus:bg-danger/10 focus:text-danger"
                        onClick={() => setDeleteTarget(board)}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Crear nuevo tablero"
          onClick={() => setIsCreateOpen(true)}
          className="group flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-surface-300 bg-surface-50/50 p-6 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-500/55 hover:bg-primary-500/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-100 dark:border-surface-600 dark:bg-surface-900/40 dark:hover:border-primary-400/50 dark:hover:bg-primary-500/10 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-surface-950"
        >
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-200/90 text-surface-600 transition-colors group-hover:bg-primary-500/15 group-hover:text-primary-600 dark:bg-surface-800 dark:text-surface-400 dark:group-hover:bg-primary-500/20 dark:group-hover:text-primary-400">
            <Plus className="size-6 stroke-[2]" aria-hidden />
          </span>
          <span className="text-base font-semibold text-surface-800 transition-colors group-hover:text-primary-700 dark:text-surface-200 dark:group-hover:text-primary-300">
            Crear tablero
          </span>
          <span className="max-w-[14rem] text-xs leading-relaxed text-surface-500 dark:text-surface-500">
            Añade un tablero nuevo a tu espacio de trabajo
          </span>
        </button>
      </div>
    </main>
  );
};
