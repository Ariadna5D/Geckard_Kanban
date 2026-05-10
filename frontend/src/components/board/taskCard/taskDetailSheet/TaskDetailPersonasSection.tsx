import type { ChangeEvent } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BoardMemberSummary } from '@/types/board.types';
import { TaskDetailSection } from '../TaskDetailSection';
import { TaskDetailInfoTip } from './TaskDetailInfoTip';

// Muestra las personas asignadas
export function TaskDetailPersonasSection({
  readOnly,
  boardMembers,
  editAssigneeIds,
  assigneeSearchQuery,
  onAssigneeSearchChange,
  assigneePickCandidates,
  onAddAssignee,
  onRemoveAssignee,
}: {
  readOnly: boolean;
  boardMembers: BoardMemberSummary[];
  editAssigneeIds: string[];
  assigneeSearchQuery: string;
  onAssigneeSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  assigneePickCandidates: BoardMemberSummary[];
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
}) {
  const searchText = assigneeSearchQuery.trim();
  let showNoResults = false;
  if (searchText.length >= 2 && assigneePickCandidates.length === 0) {
    showNoResults = true;
  }

  return (
    <TaskDetailSection title="Personas" icon={Users}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-base font-semibold text-surface-800 dark:text-surface-200">
            Personas asignadas
          </label>
          {editAssigneeIds.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Nadie asignado.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" aria-label="Asignados actuales">
              {editAssigneeIds.map((userId) => {
                // Busca el miembro para mostrar nombre o email
                let member: BoardMemberSummary | null = null;
                for (let index = 0; index < boardMembers.length; index++) {
                  const item = boardMembers[index];
                  if (item.userId === userId) {
                    member = item;
                    break;
                  }
                }

                let label = userId.slice(0, 8);
                if (member?.email) {
                  label = member.email;
                }
                if (member?.username) {
                  label = member.username;
                }
                return (
                  <li
                    key={userId}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-100 px-2.5 py-1 text-sm font-medium text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200"
                    title={member?.email ?? userId}
                  >
                    <span>{label}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="rounded px-0.5 text-indigo-700 hover:bg-indigo-200/80 dark:text-indigo-200 dark:hover:bg-indigo-800/60"
                        onClick={() => onRemoveAssignee(userId)}
                        aria-label={`Quitar a ${label}`}
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {!readOnly && (
          <div className="space-y-2 border-t border-surface-200 pt-3 dark:border-surface-700">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="task-assignee-search"
                className="text-base font-semibold text-surface-800 dark:text-surface-200"
              >
                Buscar y añadir
              </Label>
              <TaskDetailInfoTip
                label="Búsqueda de asignados"
                side="right"
                text="Escribe al menos 2 caracteres del nombre o del email. Solo aparecen miembros del tablero que aún no estén asignados a esta tarea."
              />
            </div>
            {boardMembers.length === 0 ? (
              <div className="flex items-center gap-1.5 text-sm text-surface-500 dark:text-surface-400">
                <span>Sin otros miembros en el tablero.</span>
                <TaskDetailInfoTip
                  label="Miembros del tablero"
                  side="right"
                  text="Para asignar a alguien, tiene que ser miembro del tablero. Invítalos con el botón Invitar en la cabecera del tablero."
                />
              </div>
            ) : (
              <>
                <Input
                  id="task-assignee-search"
                  autoComplete="off"
                  value={assigneeSearchQuery}
                  onChange={onAssigneeSearchChange}
                  placeholder="Nombre o parte del email…"
                  className="h-10 bg-surface-50 text-base dark:bg-surface-900"
                />
                {showNoResults && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>Sin coincidencias.</span>
                    <TaskDetailInfoTip
                      label="Por qué no hay resultados"
                      side="right"
                      text="No hay miembros del tablero que coincidan con la búsqueda, o ya están todos asignados a esta tarea."
                    />
                  </div>
                )}
                {assigneePickCandidates.length > 0 && (
                  <ul
                    className="max-h-36 overflow-y-auto rounded-lg border border-border"
                    role="listbox"
                  >
                    {assigneePickCandidates.map((item) => (
                      <li key={item.userId}>
                        <button
                          type="button"
                          role="option"
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-base transition-colors hover:bg-muted/80"
                          onClick={() => onAddAssignee(item.userId)}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <UserPlus
                              className="size-3.5 opacity-70"
                              aria-hidden
                            />
                            {item.username}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            {item.email}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </TaskDetailSection>
  );
}
