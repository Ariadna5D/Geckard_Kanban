import type { ChangeEvent, KeyboardEvent } from 'react';
import { Check, Plus, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TASK_LABEL_COLORS, taskLabelColorClasses } from '@/constants/taskLabels';
import type { TaskLabel, TaskLabelColor } from '@/types/board.types';
import { TaskDetailSection } from '../TaskDetailSection';

export function TaskDetailLabelsSection({
  readOnly,
  editLabels,
  boardLabelSuggestions,
  newLabelName,
  onNewLabelNameChange,
  onNewLabelKeyDown,
  newLabelColor,
  onSelectNewLabelColor,
  editingLabelIndex,
  onBeginLabelEdit,
  onRemoveLabel,
  onAddLabel,
  onCancelEditLabel,
  onReuseBoardLabel,
}: {
  readOnly: boolean;
  editLabels: TaskLabel[];
  boardLabelSuggestions: TaskLabel[];
  newLabelName: string;
  onNewLabelNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onNewLabelKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  newLabelColor: TaskLabelColor;
  onSelectNewLabelColor: (c: TaskLabelColor) => void;
  editingLabelIndex: number | null;
  onBeginLabelEdit: (label: TaskLabel, index: number) => void;
  onRemoveLabel: (name: string) => void;
  onAddLabel: () => void;
  onCancelEditLabel: () => void;
  onReuseBoardLabel: (label: TaskLabel) => void;
}) {
  return (
    <TaskDetailSection title="Etiquetas" icon={Tag}>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {editLabels.map((label, idx) => (
            <div
              key={`${label.name}-${idx}`}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
            >
                <button
                  type="button"
                  onClick={() => onBeginLabelEdit(label, idx)}
                  className={`${readOnly ? 'cursor-default' : 'cursor-pointer underline-offset-2 hover:underline'}`}
                  title={readOnly ? label.name : `Editar ${label.name}`}
                >
                  {label.name}
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveLabel(label.name)}
                  className="cursor-pointer opacity-80 hover:opacity-100"
                  title={`Quitar ${label.name}`}
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>
        {!readOnly && (
          <>
            <div className="flex gap-2">
              <Input
                value={newLabelName}
                onChange={onNewLabelNameChange}
                onKeyDown={onNewLabelKeyDown}
                placeholder="Etiqueta (máx. 6, Enter)"
                className="h-10 bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
              <Button
                type="button"
                size="icon"
                onClick={onAddLabel}
                className="h-10 w-10 shrink-0 bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400"
                title={
                  editingLabelIndex !== null
                    ? 'Guardar etiqueta'
                    : 'Añadir etiqueta'
                }
                aria-label={
                  editingLabelIndex !== null
                    ? 'Guardar etiqueta'
                    : 'Añadir etiqueta'
                }
              >
                {editingLabelIndex !== null ? (
                  <Check size={16} />
                ) : (
                  <Plus size={16} />
                )}
              </Button>
              {editingLabelIndex !== null && (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-10 w-10 shrink-0"
                  onClick={onCancelEditLabel}
                  title="Cancelar edición"
                  aria-label="Cancelar edición"
                >
                  <X size={16} />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {TASK_LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={onSelectNewLabelColor.bind(null, color)}
                  className={`h-6 w-6 rounded-md border ${taskLabelColorClasses(color)} ${newLabelColor === color ? 'ring-2 ring-primary-500' : ''}`}
                  title={`Color ${color}`}
                />
              ))}
            </div>
            {boardLabelSuggestions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Del tablero:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {boardLabelSuggestions.map((label, idx) => (
                    <button
                      key={`${label.name}-${idx}`}
                      type="button"
                      onClick={() => onReuseBoardLabel(label)}
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </TaskDetailSection>
  );
}
