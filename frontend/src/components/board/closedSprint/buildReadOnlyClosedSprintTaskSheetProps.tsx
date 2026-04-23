import type { ChangeEvent, KeyboardEvent } from 'react';
import type {
  BoardMemberSummary,
  ClosedSprintTaskSnapshot,
  Task,
  TaskLabel,
  TaskLabelColor,
} from '@/types/board.types';
import type { TaskDetailSheetProps } from '../taskCard/TaskDetailSheet';
import {
  normalizeTaskLabelsInput,
  votingSummaryFromTask,
} from '../taskCard/taskCardHelpers';
function noop() {}
async function noopAsync() {
  return;
}

function SnapshotReadOnlyBanner({
  snapshot,
  hasLiveTask,
}: {
  snapshot: ClosedSprintTaskSnapshot;
  hasLiveTask: boolean;
}) {
  return (
    <div className="space-y-1.5 text-surface-800 dark:text-surface-100">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Al cerrar el sprint
      </p>
      <p>
        <span className="text-muted-foreground">Columna: </span>
        {snapshot.columnTitleAtClose}
      </p>
      <p>
        <span className="text-muted-foreground">Completada: </span>
        {snapshot.wasCompleted ? 'Sí' : 'No'}
        {snapshot.wasCompleted &&
        typeof snapshot.storyPointsWhenDone === 'number' ? (
          <>
            {' '}
            · <span className="text-muted-foreground">Puntos contados: </span>
            {snapshot.storyPointsWhenDone}
          </>
        ) : null}
      </p>
      {!hasLiveTask ? (
        <p className="text-muted-foreground text-xs">
          La tarea no está en el tablero ahora (eliminada o movida). Solo ves el
          resumen archivado.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Los datos de abajo son el estado actual de la tarea en el tablero (solo
          lectura).
        </p>
      )}
    </div>
  );
}

export function buildReadOnlyClosedSprintTaskSheetProps(options: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  snapshot: ClosedSprintTaskSnapshot;
  liveTask: Task | null;
  boardMembers: BoardMemberSummary[];
  boardLabelSuggestions: TaskLabel[];
}): TaskDetailSheetProps {
  const { open, onOpenChange, onClose, snapshot, liveTask, boardMembers, boardLabelSuggestions } =
    options;
  const task = liveTask;
  const editTitle = task?.title ?? snapshot.title;
  const editDescription =
    typeof task?.description === 'string' ? task.description : '';
  const editPriority = task?.priority ?? 'medium';
  const editDueDate = task?.dueDate ? task.dueDate.slice(0, 10) : '';
  const editAssigneeIds = task?.assigneeIds ?? [];
  const editLabels = normalizeTaskLabelsInput(task?.labels);
  const editLinks = (task?.links ?? []).map((l) => ({
    url: typeof l.url === 'string' ? l.url : String(l.url ?? ''),
    title:
      typeof l.title === 'string'
        ? l.title
        : l.title != null
          ? String(l.title)
          : '',
  }));
  const editChecklist = (task?.checklist ?? []).map((c, i) => ({
    id: `arch-${snapshot.taskId}-${i}`,
    text: c.text || '',
    checked: Boolean(c.checked),
  }));

  const { teamVoteCount, teamVoteConsensus } = task
    ? votingSummaryFromTask(task)
    : { teamVoteCount: 0, teamVoteConsensus: null as number | null };
  const panelConsensus =
    teamVoteConsensus ??
    (typeof snapshot.storyPointsWhenDone === 'number'
      ? snapshot.storyPointsWhenDone
      : null);

  return {
    sheetTitle: 'Tarea en sprint archivado',
    readOnlyContextSlot: (
      <SnapshotReadOnlyBanner snapshot={snapshot} hasLiveTask={Boolean(task)} />
    ),
    readOnly: true,
    open,
    onOpenChange,
    onSave: noopAsync,
    onClose,
    unsavedDialogOpen: false,
    onUnsavedDialogOpenChange: noop,
    onConfirmUnsavedSave: noopAsync,
    onConfirmUnsavedDiscard: noop,
    editTitle,
    onEditTitleChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    editDescription,
    onEditDescriptionChange: noop as (e: ChangeEvent<HTMLTextAreaElement>) => void,
    descriptionEditMode: false,
    onStartDescriptionEdit: noop,
    onSaveDescriptionSection: noop,
    onCancelDescriptionEdit: noop,
    editPriority,
    onSelectPriority: noop as (p: Task['priority']) => void,
    editDueDate,
    onEditDueDateChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    currentColumnId: task?.columnId ?? '',
    columnOptions: [
      {
        id: task?.columnId ?? '',
        title: snapshot.columnTitleAtClose,
        isDoneColumn: snapshot.wasCompleted,
      },
    ],
    onMoveToColumn: noop,
    panelConsensus,
    panelVoteCount: teamVoteCount,
    storyPointState: null,
    votingBusy: false,
    onStoryPointVoteSelect: noop as (n: number) => void,
    boardMembers,
    editAssigneeIds,
    assigneeSearchQuery: '',
    onAssigneeSearchChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    assigneePickCandidates: [],
    onAddAssignee: noop as (userId: string) => void,
    onRemoveAssignee: noop as (userId: string) => void,
    editLabels,
    boardLabelSuggestions,
    newLabelName: '',
    onNewLabelNameChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    onNewLabelKeyDown: noop as (e: KeyboardEvent<HTMLInputElement>) => void,
    newLabelColor: 'blue',
    onSelectNewLabelColor: noop as (c: TaskLabelColor) => void,
    editingLabelIndex: null,
    onBeginLabelEdit: noop as (label: TaskLabel, index: number) => void,
    onRemoveLabel: noop as (name: string) => void,
    onAddLabel: noop,
    onCancelEditLabel: noop,
    onReuseBoardLabel: noop as (label: TaskLabel) => void,
    editLinks,
    linkDraftUrl: '',
    linkDraftTitle: '',
    onLinkDraftUrlChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    onLinkDraftTitleChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    onSubmitLinkDraft: noop,
    onRemoveLinkRow: noop as (index: number) => void,
    editChecklist,
    checklistDraftText: '',
    onChecklistDraftTextChange: noop as (e: ChangeEvent<HTMLInputElement>) => void,
    onSubmitChecklistDraft: noop,
    onRemoveChecklistRow: noop as (id: string) => void,
    onChecklistTextChange: noop as (id: string, text: string) => void,
    onChecklistToggle: noop as (id: string, checked: boolean) => void,
    sprintSection: null,
  };
}
