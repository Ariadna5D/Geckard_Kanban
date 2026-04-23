import type { ChangeEvent } from 'react';
import { Check, CheckCircle2, ChevronDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
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
  onEditTitleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  editDescription: string;
  onEditDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  descriptionEditMode: boolean;
  onStartDescriptionEdit: () => void;
  onSaveDescriptionSection: () => void;
  onCancelDescriptionEdit: () => void;
  currentColumnId: string;
  columnOptions: TaskDetailColumnOption[];
  onMoveToColumn: (columnId: string) => void | Promise<void>;
}) {
  const selectedColumn =
    columnOptions.find((column) => column.id === currentColumnId) ?? null;

  return (
    <TaskDetailSection title="General" icon={FileText} defaultOpen>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Título de la tarea
          </label>
          <Input
            value={editTitle}
            onChange={onEditTitleChange}
            readOnly={readOnly}
            placeholder="Qué hay que hacer (breve y claro)"
            className="h-10 bg-surface-50 text-base font-medium shadow-sm focus-visible:ring-ring dark:bg-surface-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
          <span className="font-medium">Estado:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 max-w-[14rem] justify-between gap-2 border-surface-200 bg-surface-50 text-left text-xs text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300"
                disabled={readOnly}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {selectedColumn?.isDoneColumn ? (
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate">
                    {selectedColumn?.title ?? 'Selecciona una columna'}
                  </span>
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="z-[80] w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {columnOptions.map((columnOption) => (
                <DropdownMenuItem
                  key={columnOption.id}
                  onSelect={() => void onMoveToColumn(columnOption.id)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {columnOption.isDoneColumn ? (
                      <CheckCircle2
                        className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate">{columnOption.title}</span>
                  </span>
                  {columnOption.id === currentColumnId ? (
                    <Check className="size-4 shrink-0 opacity-70" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                Descripción
              </label>
              {!readOnly ? (
                <TaskDetailInfoTip
                  label="Formato de la descripción"
                  side="right"
                  text="Puedes usar Markdown: negrita, listas, enlaces [texto](url), etc. En vista previa los enlaces se abren en pestaña nueva."
                />
              ) : null}
            </div>
            {!readOnly && !descriptionEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={onStartDescriptionEdit}
              >
                Editar
              </Button>
            )}
          </div>
          {readOnly || !descriptionEditMode ? (
            <div
              tabIndex={readOnly ? undefined : 0}
              onClick={(e) => {
                if (readOnly) return;
                if ((e.target as HTMLElement).closest('a')) return;
                onStartDescriptionEdit();
              }}
              onKeyDown={
                readOnly
                  ? undefined
                  : (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStartDescriptionEdit();
                      }
                    }
              }
              className={cn(
                'rounded-md outline-none',
                !readOnly &&
                  'cursor-pointer ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring',
              )}
              aria-label={
                readOnly
                  ? undefined
                  : 'Descripción en markdown, pulsa para editar'
              }
            >
              <DescriptionMarkdownPreview
                markdown={editDescription}
                variant="full"
                linksStopPropagation={!readOnly}
                emptyLabel={
                  readOnly
                    ? 'Sin descripción.'
                    : 'Sin texto. Haz click o usa «Editar»'
                }
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea
                value={editDescription}
                onChange={onEditDescriptionChange}
                placeholder="**Negrita**, listas, [enlace](https://…)"
                className="min-h-40 resize-none bg-surface-50 shadow-sm focus-visible:ring-ring dark:bg-surface-900"
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
