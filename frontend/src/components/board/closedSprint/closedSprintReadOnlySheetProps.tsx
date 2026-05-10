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

const doNothing = () => {};
const doNothingAsync = async () => {};

// Handlers vacios para props obligatorias cuando el panel va en solo lectura
const ignoreInputChange = (_event: ChangeEvent<HTMLInputElement>) => {};
const ignoreTextareaChange = (_event: ChangeEvent<HTMLTextAreaElement>) => {};
const ignoreInputKeyDown = (_event: KeyboardEvent<HTMLInputElement>) => {};
const ignorePrioritySelect = (_priority: Task['priority']) => {};
const ignoreNumberValue = (_value: number) => {};
const ignoreChecklistToggle = (_id: string, _checked: boolean) => {};
const ignoreChecklistTextUpdate = (_id: string, _text: string) => {};
const ignoreIndexValue = (_index: number) => {};
const ignoreStringValue = (_value: string) => {};
const ignoreLabelColorSelect = (_color: TaskLabelColor) => {};
const ignoreLabelValue = (_label: TaskLabel) => {};
const ignoreLabelWithIndex = (_label: TaskLabel, _index: number) => {};

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
        Al cierre
      </p>
      <p>
        <span className="text-muted-foreground">Columna · </span>
        {snapshot.columnTitleAtClose}
      </p>
      <p>
        <span className="text-muted-foreground">Hecha · </span>
        {snapshot.wasCompleted ? 'Sí' : 'No'}
        {snapshot.wasCompleted &&
        typeof snapshot.storyPointsWhenDone === 'number' ? (
          <>
            {' '}
            · <span className="text-muted-foreground">Pts. · </span>
            {snapshot.storyPointsWhenDone}
          </>
        ) : null}
      </p>
      {!hasLiveTask ? (
        <p className="text-muted-foreground text-xs">
          Ya no está en el tablero. Solo resumen del cierre.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          La parte inferior muestra el estado actual de la tarea en solo lectura.
        </p>
      )}
    </div>
  );
}

// Arma la vista de tarea para sprint cerrado
export function createClosedSprintReadOnlySheetProps(options: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: () => void;
  snapshot: ClosedSprintTaskSnapshot;
  liveTask: Task | null;
  boardMembers: BoardMemberSummary[];
  boardLabelSuggestions: TaskLabel[];
}): TaskDetailSheetProps {
  const {
    open,
    onOpenChange,
    onClose,
    snapshot,
    liveTask,
    boardMembers,
    boardLabelSuggestions,
  } = options;
  const task = liveTask;
  // Priorizamos datos actuales si existe tarea viva, si no usamos snapshot
  const editTitle = task?.title ?? snapshot.title;
  const editDescription =
    typeof task?.description === 'string' ? task.description : '';
  const editPriority = task?.priority ?? 'medium';
  const editDueDate = task?.dueDate ? task.dueDate.slice(0, 10) : '';
  const editAssigneeIds = task?.assigneeIds ?? [];
  const editLabels = normalizeTaskLabelsInput(task?.labels);
  const editLinks = (task?.links ?? []).map((link) => ({
    url: typeof link.url === 'string' ? link.url : String(link.url ?? ''),
    title:
      typeof link.title === 'string'
        ? link.title
        : link.title != null
          ? String(link.title)
          : '',
  }));
  const editChecklist = (task?.checklist ?? []).map((checklistItem, index) => ({
    id: `arch-${snapshot.taskId}-${index}`,
    text: checklistItem.text || '',
    checked: Boolean(checklistItem.checked),
  }));

  const { teamVoteCount, teamVoteConsensus } = task
    ? votingSummaryFromTask(task)
    : { teamVoteCount: 0, teamVoteConsensus: null as number | null };
  const panelConsensus =
    teamVoteConsensus ??
    (typeof snapshot.storyPointsWhenDone === 'number'
      ? snapshot.storyPointsWhenDone
      : null);

  // Devolvemos el contrato completo del sheet con readOnly activado
  return {
    sheetTitle: 'Tarea en sprint cerrado',
    readOnlyContextSlot: (
      <SnapshotReadOnlyBanner snapshot={snapshot} hasLiveTask={Boolean(task)} />
    ),
    readOnly: true,
    open,
    onOpenChange,
    onSave: doNothingAsync,
    onClose,
    unsavedDialogOpen: false,
    onUnsavedDialogOpenChange: doNothing,
    onConfirmUnsavedSave: doNothingAsync,
    onConfirmUnsavedDiscard: doNothing,
    editTitle,
    onEditTitleChange: ignoreInputChange,
    editDescription,
    onEditDescriptionChange: ignoreTextareaChange,
    descriptionEditMode: false,
    onStartDescriptionEdit: doNothing,
    onSaveDescriptionSection: doNothing,
    onCancelDescriptionEdit: doNothing,
    editPriority,
    onSelectPriority: ignorePrioritySelect,
    editDueDate,
    onEditDueDateChange: ignoreInputChange,
    currentColumnId: task?.columnId ?? '',
    columnOptions: [
      {
        id: task?.columnId ?? '',
        title: snapshot.columnTitleAtClose,
        isDoneColumn: snapshot.wasCompleted,
      },
    ],
    onMoveToColumn: doNothing,
    panelConsensus,
    panelVoteCount: teamVoteCount,
    storyPointState: null,
    votingBusy: false,
    onStoryPointVoteSelect: ignoreNumberValue,
    boardMembers,
    editAssigneeIds,
    assigneeSearchQuery: '',
    onAssigneeSearchChange: ignoreInputChange,
    assigneePickCandidates: [],
    onAddAssignee: ignoreStringValue,
    onRemoveAssignee: ignoreStringValue,
    editLabels,
    boardLabelSuggestions,
    newLabelName: '',
    onNewLabelNameChange: ignoreInputChange,
    onNewLabelKeyDown: ignoreInputKeyDown,
    newLabelColor: 'blue',
    onSelectNewLabelColor: ignoreLabelColorSelect,
    editingLabelIndex: null,
    onBeginLabelEdit: ignoreLabelWithIndex,
    onRemoveLabel: ignoreStringValue,
    onAddLabel: doNothing,
    onCancelEditLabel: doNothing,
    onReuseBoardLabel: ignoreLabelValue,
    editLinks,
    linkDraftUrl: '',
    linkDraftTitle: '',
    linkDraftError: null,
    onLinkDraftUrlChange: ignoreInputChange,
    onLinkDraftTitleChange: ignoreInputChange,
    onSubmitLinkDraft: doNothing,
    onRemoveLinkRow: ignoreIndexValue,
    editChecklist,
    checklistDraftText: '',
    onChecklistDraftTextChange: ignoreInputChange,
    onSubmitChecklistDraft: doNothing,
    onRemoveChecklistRow: ignoreStringValue,
    onChecklistTextChange: ignoreChecklistTextUpdate,
    onChecklistToggle: ignoreChecklistToggle,
    sprintSection: null,
  };
}
