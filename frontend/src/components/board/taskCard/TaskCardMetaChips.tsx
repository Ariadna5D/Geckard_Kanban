import {
  AlignLeft,
  CalendarDays,
  Check,
  Link2,
  ListChecks,
  DraftingCompass as Sigma,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';
import { taskLabelColorClasses } from '@/constants/taskLabels';
import type {
  BoardColumnKind,
  BoardMemberSummary,
  Task,
  TaskLabel,
} from '@/types/board.types';
import {
  dueBadgeTitle,
  dueDateState,
  formatDueDate,
  memberByUserId,
  memberInitials,
  priorityLabel,
} from './taskCardHelpers';
import {
  MAX_ASSIGNEE_AVATARS_ON_CARD,
  PRIORITY_ROW_STYLE,
} from './taskCardConstants';
import { TaskPriorityIcon } from './taskPriorityVisual';

export function TaskCardMetaChips({
  task,
  normalizedLabels,
  teamVoteConsensus,
  teamVoteCount,
  boardMembers,
  completionColumnKind,
}: {
  task: Task;
  normalizedLabels: TaskLabel[];
  teamVoteConsensus: number | null;
  teamVoteCount: number;
  boardMembers: BoardMemberSummary[];
  /** Columna Hecho o Archivo: icono discreto en la tarjeta. */
  completionColumnKind?: BoardColumnKind | null;
}) {
  const dueDateShort = formatDueDate(task.dueDate);
  const dueState = dueDateState(task.dueDate);
  const assigneeIds = task.assigneeIds ?? [];
  const priority = task.priority || 'medium';
  const priorityRowStyle = PRIORITY_ROW_STYLE[priority];
  const isCompletedColumn = Boolean(completionColumnKind);
  const storyPointsShown =
    teamVoteCount > 0 && teamVoteConsensus != null
      ? teamVoteConsensus
      : task.storyPoints;
  const storyPointsTitle =
    teamVoteCount === 0
      ? 'Story points (estimación)'
      : teamVoteCount === 1
        ? 'Story points (1 voto, consenso por media)'
        : `Story points (${teamVoteCount} votos, consenso por media)`;

  const visibleAssignees = assigneeIds.slice(0, MAX_ASSIGNEE_AVATARS_ON_CARD);
  const assigneeOverflow = assigneeIds.length - visibleAssignees.length;
  const hasSp = storyPointsShown !== undefined && storyPointsShown !== null;
  const linkCount = task.links?.length ?? 0;
  const checklistCount = task.checklist?.length ?? 0;
  const hasMetaIcons =
    hasSp ||
    Boolean(task.description?.trim()) ||
    Boolean(dueDateShort) ||
    linkCount > 0 ||
    checklistCount > 0;
  const showAssigneeRow = assigneeIds.length > 0;

  const completionTitle =
    completionColumnKind === 'archived'
      ? 'En columna Archivo (completada)'
      : completionColumnKind === 'done'
        ? 'En columna Hecho'
        : undefined;

  return (
    <>
      <div className="pr-7">
        <div className="flex items-start gap-1.5">
          {completionColumnKind ? (
            <span
              className="mt-[2px] shrink-0 text-surface-400 dark:text-surface-500"
              title={completionTitle}
              aria-label={completionTitle}
            >
              <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
            </span>
          ) : null}
          <p
            className={`min-w-0 flex-1 text-[15px] font-medium leading-relaxed ${
              isCompletedColumn
                ? 'text-surface-600 dark:text-surface-400'
                : 'text-surface-900 dark:text-surface-50'
            }`}
          >
            {task.title}
          </p>
        </div>
        <p
          className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-tight ${priorityRowStyle.bg} ${priorityRowStyle.text}`}
        >
          <TaskPriorityIcon priority={priority} />
          <span className="min-w-0">
            <span className="font-semibold opacity-80">Prioridad</span>
            <span className="mx-0.5 font-light opacity-60">·</span>
            <span className="font-semibold">{priorityLabel(priority)}</span>
          </span>
        </p>
      </div>

      {normalizedLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1" role="list" aria-label="Etiquetas">
          {normalizedLabels.map((label, idx) => (
            <span
              key={`${label.name}-${idx}`}
              role="listitem"
              className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {hasMetaIcons && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500 dark:text-surface-400"
          aria-label="Detalles de la tarea"
        >
          {hasSp ? (
            <span
              className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300"
              title={storyPointsTitle}
            >
              <Sigma className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{storyPointsShown}</span>
            </span>
          ) : null}
          {task.description?.trim() ? (
            <span
              className="inline-flex items-center gap-1"
              title="Tiene descripción"
            >
              <AlignLeft className="size-4 shrink-0" aria-hidden />
            </span>
          ) : null}
          {linkCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 font-medium"
              title={`${linkCount} enlace(s)`}
            >
              <Link2 className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{linkCount}</span>
            </span>
          ) : null}
          {checklistCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 font-medium"
              title={`Checklist: ${checklistCount} ítem(s)`}
            >
              <ListChecks className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{checklistCount}</span>
            </span>
          ) : null}
          {dueDateShort ? (
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                dueState === 'overdue'
                  ? 'text-red-600 dark:text-red-400'
                  : dueState === 'today'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-surface-600 dark:text-surface-400'
              }`}
              title={dueBadgeTitle[dueState]}
            >
              <CalendarDays className="size-4 shrink-0 opacity-90" aria-hidden />
              {dueDateShort}
            </span>
          ) : null}
        </div>
      )}

      {showAssigneeRow && (
        <div className="mt-3 flex justify-end border-t border-surface-200/90 pt-2 dark:border-surface-600/90">
          <AvatarGroup className="justify-end">
            {visibleAssignees.map((userId) => {
              const member = memberByUserId(boardMembers, userId);
              const label = member?.username ?? member?.email ?? userId;
              return (
                <Avatar key={userId} size="sm" title={label}>
                  {member?.avatarUrl ? (
                    <AvatarImage src={member.avatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="bg-indigo-200 text-[10px] font-semibold text-indigo-900 dark:bg-indigo-900/80 dark:text-indigo-100">
                    {member ? memberInitials(member) : '?'}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {assigneeOverflow > 0 && (
              <AvatarGroupCount className="text-[10px] font-semibold">
                +{assigneeOverflow}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        </div>
      )}
    </>
  );
}
