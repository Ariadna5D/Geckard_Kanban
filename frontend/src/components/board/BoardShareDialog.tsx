import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { BoardInviteBlock } from "./BoardInviteBlock";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  boardId: string;
};

/**
 * Modal simple para compartir tablero.
 * Delega búsqueda/invitación real en `BoardInviteBlock`.
 */
export function BoardShareDialog({
  open,
  onOpenChange,
  slug,
  boardId,
}: Props) {
  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4 opacity-80" />
            Compartir tablero
          </DialogTitle>
          <DialogDescription>
            Busca por nombre de usuario o email, elige un rol e invita.
          </DialogDescription>
        </DialogHeader>

        <BoardInviteBlock
          slug={slug}
          boardId={boardId}
          enabled={open}
          onSuccess={handleClose}
          onCancel={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}
