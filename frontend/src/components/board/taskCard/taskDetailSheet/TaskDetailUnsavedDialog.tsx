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

// Pide confirmacion al cerrar con cambios
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
  const saveText = 'Guardar';
  const discardText = 'Descartar';
  const keepEditingText = 'Seguir editando';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Guardar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Tienes cambios sin guardar
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel type="button">{keepEditingText}</AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onConfirmUnsavedDiscard}
          >
            {discardText}
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void onConfirmUnsavedSave()}
          >
            {saveText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
