import type { ChangeEvent } from 'react';
import { CalendarRange } from 'lucide-react';
import type { BoardSprint } from '@/types/board.types';
import { TaskDetailSection } from '../TaskDetailSection';

/**
 * Asigna la tarea a un sprint o al backlog (sin sprint).
 * La lista de sprints viene del tablero cargado por slug.
 */
export function TaskDetailSprintSection({
  readOnly,
  boardSprints,
  editSprintId,
  onEditSprintIdChange,
}: {
  readOnly: boolean;
  boardSprints: BoardSprint[];
  /** Id del sprint seleccionado; cadena vacía = backlog. */
  editSprintId: string;
  onEditSprintIdChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <TaskDetailSection title="Sprint" icon={CalendarRange}>
      <div className="space-y-2">
        <label
          htmlFor="task-sprint-select"
          className="text-sm font-semibold text-surface-800 dark:text-surface-200"
        >
          Asignación
        </label>
        {readOnly ? (
          <p className="text-sm text-surface-700 dark:text-surface-300">
            {editSprintId
              ? (boardSprints.find((s) => s._id === editSprintId)?.name ??
                'Sprint')
              : 'Backlog (sin sprint)'}
          </p>
        ) : (
          <select
            id="task-sprint-select"
            value={editSprintId}
            onChange={onEditSprintIdChange}
            className="h-10 w-full max-w-md rounded-md border border-surface-200 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-100"
          >
            <option value="">Backlog (sin sprint)</option>
            {boardSprints.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
                {s.status === 'active' ? ' · activo' : ''}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-surface-500 dark:text-surface-400">
          El backlog agrupa trabajo aún no comprometido en un sprint.
        </p>
      </div>
    </TaskDetailSection>
  );
}
