import type { ChangeEvent } from 'react';
import { Check, CheckCircle2, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DescriptionMarkdownPreview } from '../DescriptionMarkdownPreview';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TaskDetailColumnOption } from './taskDetailSheet.types';

/**
 * Muestra y edita datos generales de la tarea
 */
export function TaskDetailGeneralSection({
  readOnly,
  editTitle,
  onEditTitleChange,
  editDescription,
  onEditDescriptionChange,
  descriptionEditMode,
  onStartDescriptionEdit,
  onSaveDescriptionSection,
  onCancelDescriptionEdit,
  currentColumnId,
  columnOptions,
  onMoveToColumn,
}: {
  readOnly: boolean;
  editTitle: string;
  onEditTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  editDescription: string;
  onEditDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  descriptionEditMode: boolean;
  onStartDescriptionEdit: () => void;
  onSaveDescriptionSection: () => void;
  onCancelDescriptionEdit: () => void;
  currentColumnId: string;
  columnOptions: TaskDetailColumnOption[];
  onMoveToColumn: (columnId: string) => void | Promise<void>;
}) {
  // Buscamos la columna actual para mostrar el nombre y si es de cierre
  let selectedColumn: TaskDetailColumnOption | null = null;
  for (let index = 0; index < columnOptions.length; index++) {
    const item = columnOptions[index];
    if (item.id === currentColumnId) {
      selectedColumn = item;
      break;
    }
  }

  let descriptionBoxClassName =
    'rounded-md outline-none cursor-pointer ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring';
  if (readOnly) {
    descriptionBoxClassName = 'rounded-md outline-none';
  }

  let descriptionAriaLabel: string | undefined = 'Descripción en markdown, pulsa para editar';
  if (readOnly) {
    descriptionAriaLabel = undefined;
  }

  let descriptionEmptyLabel = 'Sin texto. Haz click o usa «Editar»';
  if (readOnly) {
    descriptionEmptyLabel = 'Sin descripción.';
  }

  return (
    <TaskDetailSection title="General" icon={FileText} defaultOpen>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-base font-semibold text-surface-800 dark:text-surface-200">
            Título de la tarea
          </label>
          <Input
            value={editTitle}
            onChange={onEditTitleChange}
            readOnly={readOnly}
            placeholder="Qué hay que hacer (breve y claro)"
            className="h-11 bg-surface-50 text-base font-medium shadow-sm focus-visible:ring-ring dark:bg-surface-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
          <span className="font-medium">Estado:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 max-w-md justify-between gap-2 border-surface-200 bg-surface-50 text-left text-sm text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300"
                disabled={readOnly}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {selectedColumn?.isDoneColumn && (
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  )}
                  <span className="truncate">
                    {selectedColumn?.title ?? 'Selecciona una columna'}
                  </span>
                </span>
                <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-50 w-(--radix-dropdown-menu-trigger-width)"
            >
              {columnOptions.map((columnOption) => (
                <DropdownMenuItem
                  key={columnOption.id}
                  onSelect={() => void onMoveToColumn(columnOption.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {columnOption.isDoneColumn && (
                      <CheckCircle2
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                    )}
                    <span className="truncate">{columnOption.title}</span>
                  </span>
                  {columnOption.id === currentColumnId && (
                    <Check className="size-4 shrink-0 opacity-70" aria-hidden />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-base font-semibold text-surface-800 dark:text-surface-200">
                Descripción
              </label>
              {!readOnly && (
                <TaskDetailInfoTip
                  label="Formato de la descripción"
                  side="right"
                  text="Puedes usar Markdown: negrita, listas, enlaces [texto](url), etc. En vista previa los enlaces se abren en pestaña nueva."
                />
              )}
            </div>
            {!readOnly && !descriptionEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-sm"
                onClick={onStartDescriptionEdit}
              >
                Editar
              </Button>
            )}
          </div>
          {readOnly || !descriptionEditMode ? (
            <div
              tabIndex={readOnly ? undefined : 0}
              onClick={(event) => {
                if (readOnly) return;
                const clickedElement = event.target as HTMLElement;
                if (clickedElement.closest('a')) return;
                // Si no es un enlace, pasamos a modo edicion de descripcion
                onStartDescriptionEdit();
              }}
              onKeyDown={
                readOnly
                  ? undefined
                  : (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onStartDescriptionEdit();
                      }
                    }
              }
              className={descriptionBoxClassName}
              aria-label={descriptionAriaLabel}
            >
              <DescriptionMarkdownPreview
                markdown={editDescription}
                variant="full"
                linksStopPropagation={!readOnly}
                emptyLabel={descriptionEmptyLabel}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={editDescription}
                onChange={onEditDescriptionChange}
                placeholder="**Negrita**, listas, [enlace](https://…)"
                className="min-h-40 resize-none bg-surface-50 text-base shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancelDescriptionEdit}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSaveDescriptionSection}
                >
                  Listo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </TaskDetailSection>
  );
}
