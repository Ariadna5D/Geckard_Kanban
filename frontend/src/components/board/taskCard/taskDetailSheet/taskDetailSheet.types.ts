import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import type {
  BoardMemberSummary,
  StoryPointVotingState,
  Task,
  TaskLabel,
  TaskLabelColor,
} from '@/types/board.types';
import type { ChecklistEditRow } from '../taskCardHelpers';

// Opcion de columna para mover la tarea desde el panel
export interface TaskDetailColumnOption {
  id: string;
  title: string;
  isDoneColumn: boolean;
}

// Contrato completo que usa el panel para editar la tarea
export interface TaskDetailSheetProps {
  sheetTitle?: string;
  readOnlyContextSlot?: ReactNode;
  readOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void | Promise<void>;
  saveError?: string | null;
  onClose: () => void;
  unsavedDialogOpen: boolean;
  onUnsavedDialogOpenChange: (open: boolean) => void;
  onConfirmUnsavedSave: () => void | Promise<void>;
  onConfirmUnsavedDiscard: () => void;
  editTitle: string;
  onEditTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  editDescription: string;
  onEditDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  descriptionEditMode: boolean;
  onStartDescriptionEdit: () => void;
  onSaveDescriptionSection: () => void;
  onCancelDescriptionEdit: () => void;
  editPriority: Task['priority'];
  onSelectPriority: (value: Task['priority']) => void;
  editDueDate: string;
  onEditDueDateChange: (event: ChangeEvent<HTMLInputElement>) => void;
  currentColumnId: string;
  columnOptions: TaskDetailColumnOption[];
  onMoveToColumn: (columnId: string) => void | Promise<void>;
  panelConsensus: number | null;
  panelVoteCount: number;
  storyPointState: StoryPointVotingState | null;
  votingBusy: boolean;
  onStoryPointVoteSelect: (value: number) => void;
  onStoryPointVoteClear: () => void;
  boardMembers: BoardMemberSummary[];
  editAssigneeIds: string[];
  assigneeSearchQuery: string;
  onAssigneeSearchChange: (event: ChangeEvent<HTMLInputElement>) => void;
  assigneePickCandidates: BoardMemberSummary[];
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
  editLabels: TaskLabel[];
  boardLabelSuggestions: TaskLabel[];
  newLabelName: string;
  onNewLabelNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onNewLabelKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  newLabelColor: TaskLabelColor;
  onSelectNewLabelColor: (value: TaskLabelColor) => void;
  editingLabelIndex: number | null;
  onBeginLabelEdit: (label: TaskLabel, index: number) => void;
  onRemoveLabel: (name: string) => void;
  onAddLabel: () => void;
  onCancelEditLabel: () => void;
  onReuseBoardLabel: (label: TaskLabel) => void;
  editLinks: { url: string; title: string }[];
  linkDraftUrl: string;
  linkDraftTitle: string;
  linkDraftError?: string | null;
  onLinkDraftUrlChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLinkDraftTitleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitLinkDraft: () => void;
  onRemoveLinkRow: (index: number) => void;
  editChecklist: ChecklistEditRow[];
  checklistDraftText: string;
  onChecklistDraftTextChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmitChecklistDraft: () => void;
  onRemoveChecklistRow: (id: string) => void;
  onChecklistTextChange: (id: string, text: string) => void;
  onChecklistToggle: (id: string, checked: boolean) => void;
  sprintSection?: {
    activeSprintName: string;
    inActiveSprint: boolean;
    onInActiveSprintChange: (next: boolean) => void;
  } | null;
}
