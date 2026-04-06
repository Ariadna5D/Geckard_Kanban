import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function TaskDetailUnsavedDialog({
  open,
  onOpenChange,
  onConfirmUnsavedDiscard,
  onConfirmUnsavedSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmUnsavedDiscard: () => void;
  onConfirmUnsavedSave: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Guardar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Cambios sin guardar. ¿Guardar antes de cerrar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button">Seguir editando</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onConfirmUnsavedDiscard}
          >
            Descartar
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void onConfirmUnsavedSave()}
          >
            Guardar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
