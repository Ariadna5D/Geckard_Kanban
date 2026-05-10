import { useEffect, useState, type ChangeEvent } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ChecklistEditRow } from '../taskCardHelpers';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

// Muestra y edita la checklist
export function TaskDetailChecklistSection({
  readOnly,
  open,
  editChecklist,
  checklistDraftText,
  onChecklistDraftTextChange,
  onSubmitChecklistDraft,
  onRemoveChecklistRow,
  onChecklistTextChange,
  onChecklistToggle,
}: {
  readOnly: boolean;
  open: boolean;
  editChecklist: ChecklistEditRow[];
  checklistDraftText: string;
  onChecklistDraftTextChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitChecklistDraft: () => void;
  onRemoveChecklistRow: (id: string) => void;
  onChecklistTextChange: (id: string, text: string) => void;
  onChecklistToggle: (id: string, checked: boolean) => void;
}) {
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(
    null,
  );
  let emptyText = 'Sin pasos aún.';
  if (readOnly) {
    emptyText = 'Sin ítems.';
  }

  useEffect(() => {
    // Al cerrar el panel limpiamos la edicion inline activa
    if (!open) setEditingChecklistId(null);
  }, [open]);

  useEffect(() => {
    // Si se borra una fila mientras estaba en edicion, salimos de ese modo
    let exists = false;
    for (let index = 0; index < editChecklist.length; index++) {
      const item = editChecklist[index];
      if (item.id === editingChecklistId) {
        exists = true;
        break;
      }
    }
    if (editingChecklistId && !exists) {
      setEditingChecklistId(null);
    }
  }, [editChecklist, editingChecklistId]);

  return (
    <TaskDetailSection title="Checklist" icon={ListChecks}>
      <div className="space-y-3">
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              value={checklistDraftText}
              onChange={onChecklistDraftTextChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSubmitChecklistDraft();
                }
              }}
              placeholder="Escribe un nuevo paso"
              className="h-10 flex-1 bg-surface-50 text-base dark:bg-surface-950"
              aria-label="Texto del nuevo ítem de checklist"
            />
            <Button
              type="button"
              variant="default"
              size="icon"
              className="size-10 shrink-0"
              onClick={onSubmitChecklistDraft}
              aria-label="Añadir ítem a la checklist"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        {editChecklist.length === 0 ? (
          <div className="flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400">
            <span>{emptyText}</span>
            {!readOnly && (
              <TaskDetailInfoTip
                label="Cómo añadir pasos"
                side="right"
                text="Escribe el texto del paso en el campo superior y añádelo a la checklist."
              />
            )}
          </div>
        ) : (
          <ul
            className="divide-y divide-surface-200 rounded-md border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-900"
            aria-label="Checklist de la tarea"
          >
            {editChecklist.map((item) => {
              const isEditing = !readOnly && editingChecklistId === item.id;
              let checkboxClassName =
                'size-[1.125rem] shrink-0 rounded border-surface-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-surface-600';

              let rowTextButtonClassName =
                '-mx-1 -my-0.5 block w-full rounded-md px-1 py-0.5 text-left text-base leading-snug transition-colors text-surface-800 hover:bg-surface-200/70 dark:text-surface-200 dark:hover:bg-surface-800/80';
              if (!item.text.trim()) {
                rowTextButtonClassName = `${rowTextButtonClassName} italic text-surface-500 dark:text-surface-500`;
              }

              const removeButtonClassName =
                'size-8 shrink-0 text-danger hover:bg-danger/10';

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-2.5 first:rounded-t-md last:rounded-b-md"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) =>
                      onChecklistToggle(item.id, event.target.checked)
                    }
                    disabled={readOnly}
                    className={checkboxClassName}
                  />
                  <div className="min-w-0 flex-1">
                    {readOnly ? (
                      <span className="mt-0.5 block text-base leading-snug text-surface-800 dark:text-surface-200">
                        {item.text.trim() ? item.text : '—'}
                      </span>
                    ) : isEditing ? (
                      <Input
                        autoFocus
                        value={item.text}
                        onChange={(event) =>
                          onChecklistTextChange(item.id, event.target.value)
                        }
                        onBlur={() => setEditingChecklistId(null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditingChecklistId(null);
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            (event.target as HTMLInputElement).blur();
                          }
                        }}
                        placeholder="Texto del paso"
                        className="h-10 bg-surface-50 text-base dark:bg-surface-950"
                        aria-label="Editar texto del paso"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingChecklistId(item.id)}
                        className={rowTextButtonClassName}
                      >
                        {item.text.trim() ? item.text : 'Pulsa para editar'}
                      </button>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={removeButtonClassName}
                      onClick={() => onRemoveChecklistRow(item.id)}
                      aria-label="Quitar ítem"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TaskDetailSection>
  );
}
