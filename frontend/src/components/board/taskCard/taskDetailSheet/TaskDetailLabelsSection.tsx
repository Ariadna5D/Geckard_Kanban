import type { ChangeEvent, KeyboardEvent } from 'react';
import { Check, Plus, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TASK_LABEL_COLORS, taskLabelColorClasses } from '@/constants/taskLabels';
import type { TaskLabel, TaskLabelColor } from '@/types/board.types';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

// Muestra y edita las etiquetas
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
  onNewLabelNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNewLabelKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  newLabelColor: TaskLabelColor;
  onSelectNewLabelColor: (labelColor: TaskLabelColor) => void;
  editingLabelIndex: number | null;
  onBeginLabelEdit: (label: TaskLabel, index: number) => void;
  onRemoveLabel: (name: string) => void;
  onAddLabel: () => void;
  onCancelEditLabel: () => void;
  onReuseBoardLabel: (label: TaskLabel) => void;
}) {
  let submitLabelText = 'Añadir etiqueta';
  if (editingLabelIndex !== null) {
    submitLabelText = 'Guardar etiqueta';
  }

  return (
    <TaskDetailSection title="Etiquetas" icon={Tag} defaultOpen>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {editLabels.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm font-medium ${taskLabelColorClasses(item.color)}`}
            >
              {/** Este boton muestra la etiqueta y permite editarla */}
              <button
                type="button"
                onClick={() => onBeginLabelEdit(item, index)}
                className={
                  readOnly
                    ? 'cursor-default'
                    : 'cursor-pointer underline-offset-2 hover:underline'
                }
                title={readOnly ? item.name : `Editar ${item.name}`}
              >
                {item.name}
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onRemoveLabel(item.name)}
                  className="cursor-pointer opacity-80 hover:opacity-100"
                  title={`Quitar ${item.name}`}
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
                placeholder="Nueva etiqueta"
                className="h-11 min-w-0 flex-1 bg-surface-50 text-base shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
              <Button
                type="button"
                size="icon"
                onClick={onAddLabel}
                className="h-11 w-11 shrink-0 bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400"
                title={submitLabelText}
                aria-label={submitLabelText}
              >
                {editingLabelIndex !== null && <Check size={16} />}
                {editingLabelIndex === null && <Plus size={16} />}
              </Button>
              {editingLabelIndex !== null && (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-11 w-11 shrink-0"
                  onClick={onCancelEditLabel}
                  title="Cancelar edición"
                  aria-label="Cancelar edición"
                >
                  <X size={16} />
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {TASK_LABEL_COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onSelectNewLabelColor(item)}
                  className={`h-6 w-6 rounded-md border ${taskLabelColorClasses(item)} ${newLabelColor === item ? 'ring-2 ring-primary-500' : ''}`}
                  title={`Color ${item}`}
                />
              ))}
            </div>
            {boardLabelSuggestions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm font-medium text-surface-600 dark:text-surface-400">
                  <span>Sugerencias del tablero</span>
                  <TaskDetailInfoTip
                    label="Sugerencias de etiquetas"
                    side="right"
                    text="Etiquetas que ya aparecen en otras tareas de este tablero. Un clic reutiliza nombre y color."
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {boardLabelSuggestions.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      type="button"
                      onClick={() => onReuseBoardLabel(item)}
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium ${taskLabelColorClasses(item.color)}`}
                    >
                      {item.name}
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
