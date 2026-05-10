import {
  AlignLeft,
  CalendarDays,
  Check,
  Link2,
  ListChecks,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  userAvatarFallbackClass,
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
import { useAuthStore } from '@/store/useAuthStore';
import {
  MAX_ASSIGNEE_AVATARS_ON_CARD,
  PRIORITY_ROW_STYLE,
} from './taskCardConstants';
import { TaskPriorityIcon } from './taskPriorityVisual';
import { StoryPointsIcon } from './StoryPointsIcon';

// Muestra los datos clave de la tarjeta
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
  completionColumnKind?: BoardColumnKind | null;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id ?? '';
  // Fecha y prioridad se calculan antes para no repetir logica en el jsx
  const dueDateShort = formatDueDate(task.dueDate);
  const dueState = dueDateState(task.dueDate);
  const assigneeIds = task.assigneeIds ?? [];
  const priority = task.priority || 'medium';
  const priorityRowStyle = PRIORITY_ROW_STYLE[priority];
  const isCompletedColumn = Boolean(completionColumnKind);
  let storyPointsShown = task.storyPoints;
  if (teamVoteCount > 0 && teamVoteConsensus != null) {
    storyPointsShown = teamVoteConsensus;
  }

  let storyPointsTitle = 'Story points (estimación)';
  if (teamVoteCount === 1) {
    storyPointsTitle = 'Story points (1 voto, consenso por media)';
  }
  if (teamVoteCount > 1) {
    storyPointsTitle = `Story points (${teamVoteCount} votos, consenso por media)`;
  }

  const visibleAssignees = assigneeIds.slice(0, MAX_ASSIGNEE_AVATARS_ON_CARD);
  const assigneeOverflow = assigneeIds.length - visibleAssignees.length;
  const hasSp = storyPointsShown !== undefined && storyPointsShown !== null;
  const linkCount = task.links?.length ?? 0;
  const checklistCount = task.checklist?.length ?? 0;
  let hasMetaIcons = false;
  if (hasSp) {
    hasMetaIcons = true;
  }
  if (task.description?.trim()) {
    hasMetaIcons = true;
  }
  if (dueDateShort) {
    hasMetaIcons = true;
  }
  if (linkCount > 0) {
    hasMetaIcons = true;
  }
  if (checklistCount > 0) {
    hasMetaIcons = true;
  }
  const showAssigneeRow = assigneeIds.length > 0;

  let completionTitle: string | undefined;
  if (completionColumnKind === 'archived') {
    completionTitle = 'En columna Archivo (completada)';
  }
  if (completionColumnKind === 'done') {
    completionTitle = 'En columna Hecho';
  }

  let titleClassName = 'min-w-0 flex-1 text-lg font-medium leading-relaxed';
  if (isCompletedColumn) {
    titleClassName = `${titleClassName} text-surface-600 dark:text-surface-400`;
  } else {
    titleClassName = `${titleClassName} text-surface-900 dark:text-surface-50`;
  }

  let dueDateClassName = 'inline-flex items-center gap-1 font-medium';
  if (dueState === 'overdue') {
    dueDateClassName = `${dueDateClassName} text-red-600 dark:text-red-400`;
  }
  if (dueState === 'today') {
    dueDateClassName = `${dueDateClassName} text-amber-700 dark:text-amber-400`;
  }
  if (dueState === 'normal') {
    dueDateClassName = `${dueDateClassName} text-surface-600 dark:text-surface-400`;
  }

  return (
    <>
      <div className="pr-7">
        <div className="flex items-start gap-1.5">
          {completionColumnKind && (
            <span
              className="mt-0.5 shrink-0 text-surface-400 dark:text-surface-500"
              title={completionTitle}
              aria-label={completionTitle}
            >
              <Check className="size-3.5" strokeWidth={2.25} aria-hidden />
            </span>
          )}
          <p className={titleClassName}>
            {task.title}
          </p>
        </div>
        <p
          className={[
            'mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-medium leading-tight',
            priorityRowStyle.bg,
            priorityRowStyle.text,
          ].join(' ')}
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
          {normalizedLabels.map((label, labelIndex) => (
            <span
              key={`${label.name}-${labelIndex}`}
              role="listitem"
              className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-sm font-medium ${taskLabelColorClasses(label.color)}`}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {hasMetaIcons && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm text-surface-500 dark:text-surface-400"
          aria-label="Detalles de la tarea"
        >
          {hasSp && (
            <span
              className="inline-flex items-center gap-1.5 font-semibold text-violet-700 dark:text-violet-300"
              title={storyPointsTitle}
            >
              <StoryPointsIcon className="opacity-90" />
              <span className="tabular-nums text-[1rem]">{storyPointsShown}</span>
            </span>
          )}
          {task.description?.trim() && (
            <span
              className="inline-flex items-center gap-1.5"
              title="Tiene descripción"
            >
              <AlignLeft className="size-4 shrink-0" aria-hidden />
            </span>
          )}
          {linkCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 font-medium"
              title={`${linkCount} enlace(s)`}
            >
              <Link2 className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{linkCount}</span>
            </span>
          )}
          {checklistCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 font-medium"
              title={`Checklist: ${checklistCount} ítem(s)`}
            >
              <ListChecks className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{checklistCount}</span>
            </span>
          )}
          {dueDateShort && (
            <span className={dueDateClassName} title={dueBadgeTitle[dueState]}>
              <CalendarDays className="size-4 shrink-0 opacity-90" aria-hidden />
              {dueDateShort}
            </span>
          )}
        </div>
      )}

      {showAssigneeRow && (
        <div className="mt-3 flex justify-end border-t border-surface-200/90 pt-2 dark:border-surface-600/90">
          <AvatarGroup className="justify-end">
            {visibleAssignees.map((userId) => {
              // Resolvemos cada id contra miembros del tablero para avatar y nombre
              let data = memberByUserId(boardMembers, userId);
              if (!data && currentUserId !== '' && userId === currentUserId) {
                data = {
                  userId: currentUserId,
                  username: currentUser?.username ?? '',
                  email: currentUser?.email ?? '',
                  avatarUrl: currentUser?.avatarUrl,
                  role: 'owner',
                };
              }
              const label = data?.username ?? data?.email ?? userId;
              return (
                <Avatar key={userId} size="sm" title={label}>
                  {data?.avatarUrl && (
                    <AvatarImage src={data.avatarUrl} alt="" />
                  )}
                  <AvatarFallback
                    className={`${userAvatarFallbackClass} text-xs`}
                  >
                    {data && memberInitials(data)}
                    {!data && 'U'}
                  </AvatarFallback>
                </Avatar>
              );
            })}
            {assigneeOverflow > 0 && (
              <AvatarGroupCount className="text-xs font-semibold">
                +{assigneeOverflow}
              </AvatarGroupCount>
            )}
          </AvatarGroup>
        </div>
      )}
    </>
  );
}
