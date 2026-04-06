import type { ChangeEvent } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BoardMemberSummary } from '@/types/board.types';
import { cn } from '@/lib/utils';
import { TaskDetailSection } from '../TaskDetailSection';

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
  onAssigneeSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
  assigneePickCandidates: BoardMemberSummary[];
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
}) {
  return (
    <TaskDetailSection title="Personas" icon={Users}>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            Personas asignadas
          </label>
          {editAssigneeIds.length === 0 ? (
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Nadie asignado.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5" aria-label="Asignados actuales">
              {editAssigneeIds.map((userId) => {
                const member = boardMembers.find((m) => m.userId === userId);
                const label =
                  member?.username ?? member?.email ?? userId.slice(0, 8);
                return (
                  <li
                    key={userId}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200"
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
            <Label
              htmlFor="task-assignee-search"
              className="text-sm font-semibold text-surface-800 dark:text-surface-200"
            >
              Buscar y añadir
            </Label>
            {boardMembers.length === 0 ? (
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Este tablero aún no tiene otros miembros.
              </p>
            ) : (
              <>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Mín. 2 caracteres; solo miembros del tablero.
                </p>
                <Input
                  id="task-assignee-search"
                  autoComplete="off"
                  value={assigneeSearchQuery}
                  onChange={onAssigneeSearchChange}
                  placeholder="Nombre o parte del email…"
                  className="h-9 bg-surface-50 text-sm dark:bg-surface-900"
                />
                {assigneeSearchQuery.trim().length >= 2 &&
                  assigneePickCandidates.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No quedan miembros con ese criterio (o ya están
                      asignados).
                    </p>
                  )}
                {assigneePickCandidates.length > 0 && (
                  <ul
                    className="max-h-36 overflow-y-auto rounded-lg border border-border"
                    role="listbox"
                  >
                    {assigneePickCandidates.map((member) => (
                      <li key={member.userId}>
                        <button
                          type="button"
                          role="option"
                          className={cn(
                            'hover:bg-muted/80 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors',
                          )}
                          onClick={() => onAddAssignee(member.userId)}
                        >
                          <span className="flex items-center gap-1.5 font-medium">
                            <UserPlus
                              className="size-3.5 opacity-70"
                              aria-hidden
                            />
                            {member.username}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            {member.email}
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
