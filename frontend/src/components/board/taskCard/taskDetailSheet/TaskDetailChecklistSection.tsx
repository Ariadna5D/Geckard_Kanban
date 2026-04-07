import { useEffect, useState, type ChangeEvent } from 'react';
import { ListChecks, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ChecklistEditRow } from '../taskCardHelpers';
import { TaskDetailSection } from '../TaskDetailSection';

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
  onChecklistDraftTextChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmitChecklistDraft: () => void;
  onRemoveChecklistRow: (id: string) => void;
  onChecklistTextChange: (id: string, text: string) => void;
  onChecklistToggle: (id: string, checked: boolean) => void;
}) {
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!open) setEditingChecklistId(null);
  }, [open]);

  useEffect(() => {
    if (
      editingChecklistId &&
      !editChecklist.some((r) => r.id === editingChecklistId)
    ) {
      setEditingChecklistId(null);
    }
  }, [editChecklist, editingChecklistId]);

  return (
    <TaskDetailSection title="Checklist" icon={ListChecks} defaultOpen>
      <div className="space-y-3">
        {!readOnly && (
          <div className="flex gap-2">
            <Input
              value={checklistDraftText}
              onChange={onChecklistDraftTextChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmitChecklistDraft();
                }
              }}
              placeholder="Nuevo paso (Enter o +)"
              className="h-9 flex-1 bg-surface-50 text-sm dark:bg-surface-950"
              aria-label="Texto del nuevo ítem de checklist"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-9 shrink-0"
              onClick={onSubmitChecklistDraft}
              aria-label="Añadir ítem a la checklist"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        {editChecklist.length === 0 ? (
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {readOnly
              ? 'Sin ítems.'
              : 'Escribe un paso y pulsa + o Enter.'}
          </p>
        ) : (
          <ul
            className="divide-y divide-surface-200 rounded-md border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-900"
            aria-label="Checklist de la tarea"
          >
            {editChecklist.map((row) => {
              const isEditing = !readOnly && editingChecklistId === row.id;
              return (
                <li
                  key={row.id}
                  className="flex items-start gap-2 px-3 py-2.5 first:rounded-t-md last:rounded-b-md"
                >
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(e) =>
                      onChecklistToggle(row.id, e.target.checked)
                    }
                    disabled={readOnly}
                    className={cn(
                      'size-4 shrink-0 rounded border-surface-300 text-primary-600 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-surface-600',
                      isEditing ? 'self-center' : 'mt-0.5',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {readOnly ? (
                      <span className="mt-0.5 block text-sm leading-snug text-surface-800 dark:text-surface-200">
                        {row.text.trim() ? row.text : '—'}
                      </span>
                    ) : isEditing ? (
                      <Input
                        autoFocus
                        value={row.text}
                        onChange={(e) =>
                          onChecklistTextChange(row.id, e.target.value)
                        }
                        onBlur={() => setEditingChecklistId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingChecklistId(null);
                          }
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        placeholder="Texto del paso"
                        className="h-9 bg-surface-50 text-sm dark:bg-surface-950"
                        aria-label="Editar texto del paso"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingChecklistId(row.id)}
                        className={cn(
                          '-mx-1 -my-0.5 mt-0.5 block w-full rounded-md px-1 py-0.5 text-left text-sm leading-snug transition-colors',
                          'text-surface-800 hover:bg-surface-200/70 dark:text-surface-200 dark:hover:bg-surface-800/80',
                          !row.text.trim() &&
                            'italic text-surface-500 dark:text-surface-500',
                        )}
                      >
                        {row.text.trim() ? row.text : 'Pulsa para editar'}
                      </button>
                    )}
                  </div>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'size-8 shrink-0 text-danger hover:bg-danger/10',
                        isEditing ? 'self-center' : 'mt-0.5',
                      )}
                      onClick={() => onRemoveChecklistRow(row.id)}
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
