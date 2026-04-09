import type { ChangeEvent, KeyboardEvent } from 'react';
import type {
  BoardMemberSummary,
  BoardSprint,
  StoryPointVotingState,
  Task,
  TaskLabel,
  TaskLabelColor,
} from '@/types/board.types';
import type { ChecklistEditRow } from '../taskCardHelpers';

export interface TaskDetailSheetProps {
  readOnly: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void | Promise<void>;
  onClose: () => void;
  unsavedDialogOpen: boolean;
  onUnsavedDialogOpenChange: (open: boolean) => void;
  onConfirmUnsavedSave: () => void | Promise<void>;
  onConfirmUnsavedDiscard: () => void;
  editTitle: string;
  onEditTitleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  editDescription: string;
  onEditDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  descriptionEditMode: boolean;
  onStartDescriptionEdit: () => void;
  onSaveDescriptionSection: () => void;
  onCancelDescriptionEdit: () => void;
  editPriority: Task['priority'];
  onSelectPriority: (p: Task['priority']) => void;
  editDueDate: string;
  onEditDueDateChange: (e: ChangeEvent<HTMLInputElement>) => void;
  panelConsensus: number | null;
  panelVoteCount: number;
  storyPointState: StoryPointVotingState | null;
  votingBusy: boolean;
  onStoryPointVoteSelect: (n: number) => void;
  boardMembers: BoardMemberSummary[];
  editAssigneeIds: string[];
  assigneeSearchQuery: string;
  onAssigneeSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
  assigneePickCandidates: BoardMemberSummary[];
  onAddAssignee: (userId: string) => void;
  onRemoveAssignee: (userId: string) => void;
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
  editLinks: { url: string; title: string }[];
  linkDraftUrl: string;
  linkDraftTitle: string;
  onLinkDraftUrlChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onLinkDraftTitleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmitLinkDraft: () => void;
  onRemoveLinkRow: (index: number) => void;
  editChecklist: ChecklistEditRow[];
  checklistDraftText: string;
  onChecklistDraftTextChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmitChecklistDraft: () => void;
  onRemoveChecklistRow: (id: string) => void;
  onChecklistTextChange: (id: string, text: string) => void;
  onChecklistToggle: (id: string, checked: boolean) => void;
  boardSprints: BoardSprint[];
  editSprintId: string;
  onEditSprintIdChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}
