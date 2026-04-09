import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getStoryPointVotingRequest,
  voteStoryPointsRequest,
} from '@/api/tasks.api';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import type {
  StoryPointVotingState,
  Task,
  TaskLabel,
  TaskLabelColor,
} from '@/types/board.types';
import {
  type ChecklistEditRow,
  newChecklistRowId,
  fingerprintTaskDetailBaseline,
  fingerprintTaskDetailForm,
  normalizeTaskLabelsInput,
  normalizeTaskLinkUrl,
  parseChecklistForSave,
  parseLinksForSave,
  votingSummaryFromTask,
} from './taskCardHelpers';
import { PRIORITY_ACCENT_BORDER } from './taskCardConstants';
import type { TaskDetailSheetProps } from './TaskDetailSheet';

async function fetchStoryPointVotingForTask(
  taskId: string,
): Promise<StoryPointVotingState | null> {
  try {
    return await getStoryPointVotingRequest(taskId);
  } catch {
    return null;
  }
}

export function useTaskCardViewModel(
  task: Task,
  readOnly: boolean,
  options?: { disableDrag?: boolean },
) {
  const disableDrag = options?.disableDrag === true;
  const { board, boardMembers, deleteTask, updateTask, fetchBoard } =
    useActiveBoardStore();

  const priorityAccent =
    PRIORITY_ACCENT_BORDER[task.priority || 'medium'];

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editPriority, setEditPriority] = useState<Task['priority']>(
    task.priority || 'medium',
  );
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : '',
  );
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(
    task.assigneeIds || [],
  );
  const [editLabels, setEditLabels] = useState<TaskLabel[]>(
    normalizeTaskLabelsInput(task.labels),
  );
  const [editLinks, setEditLinks] = useState<{ url: string; title: string }[]>(
    [],
  );
  const [editChecklist, setEditChecklist] = useState<ChecklistEditRow[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<TaskLabelColor>('blue');
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(
    null,
  );
  const [storyPointState, setStoryPointState] =
    useState<StoryPointVotingState | null>(null);
  const [votingBusy, setVotingBusy] = useState(false);
  /** Búsqueda para añadir asignados (solo entre `boardMembers`). */
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [linkDraftUrl, setLinkDraftUrl] = useState('');
  const [linkDraftTitle, setLinkDraftTitle] = useState('');
  const [checklistDraftText, setChecklistDraftText] = useState('');
  /** Sprint seleccionado en el panel; vacío = backlog. */
  const [editSprintId, setEditSprintId] = useState('');
  const [descriptionEditMode, setDescriptionEditMode] = useState(false);
  const descriptionSnapshotRef = useRef('');
  const [baselineFingerprint, setBaselineFingerprint] = useState<string | null>(
    null,
  );
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);

  const normalizedLabels = normalizeTaskLabelsInput(task.labels);
  const suggestionByKey: Record<string, TaskLabel> = {};
  if (board) {
    for (const column of board.columns) {
      for (const boardTask of column.tasks ?? []) {
        for (const label of normalizeTaskLabelsInput(boardTask.labels)) {
          const key = label.name.trim().toLowerCase();
          if (!key || suggestionByKey[key]) continue;
          suggestionByKey[key] = label;
        }
      }
    }
  }
  const boardLabelSuggestions = Object.values(suggestionByKey);
  const boardSlug = board?.slug;

  const assigneePickCandidates = useMemo(() => {
    const q = assigneeSearchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return boardMembers.filter(
      (member) =>
        !editAssigneeIds.includes(member.userId) &&
        (member.username.toLowerCase().includes(q) ||
          member.email.toLowerCase().includes(q)),
    );
  }, [assigneeSearchQuery, boardMembers, editAssigneeIds]);

  const { teamVoteCount: taskVoteSummaryCount, teamVoteConsensus: taskVoteConsensus } =
    votingSummaryFromTask(task);
  const teamVoteCount = isPanelOpen
    ? (storyPointState?.totalVotes ?? taskVoteSummaryCount)
    : taskVoteSummaryCount;
  const teamVoteConsensusLive = isPanelOpen
    ? (storyPointState?.average ?? taskVoteConsensus)
    : taskVoteConsensus;
  const panelConsensus = storyPointState?.average ?? taskVoteConsensus;
  const panelVoteCount = storyPointState?.totalVotes ?? taskVoteSummaryCount;

  useEffect(() => {
    if (!isPanelOpen) {
      setBaselineFingerprint(null);
      return;
    }
    setEditTitle(task.title);
    setEditDescription(
      typeof task.description === 'string' ? task.description : '',
    );
    setEditPriority(task.priority || 'medium');
    setEditDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setEditAssigneeIds(task.assigneeIds || []);
    setEditLabels(normalizeTaskLabelsInput(task.labels));
    setEditLinks(
      (task.links ?? []).map((l) => ({
        url: typeof l.url === 'string' ? l.url : String(l.url ?? ''),
        title:
          typeof l.title === 'string'
            ? l.title
            : l.title != null
              ? String(l.title)
              : '',
      })),
    );
    setEditChecklist(
      (task.checklist ?? []).map((c, i) => ({
        id: `sync-${task._id}-${i}`,
        text: c.text || '',
        checked: Boolean(c.checked),
      })),
    );
    setNewLabelName('');
    setNewLabelColor('blue');
    setEditingLabelIndex(null);
    setLinkDraftUrl('');
    setLinkDraftTitle('');
    setChecklistDraftText('');
    setEditSprintId(task.sprintId ?? '');
    setDescriptionEditMode(false);
    setBaselineFingerprint(fingerprintTaskDetailBaseline(task));
  }, [isPanelOpen, task._id, task.updatedAt, task.sprintId]);

  const isDirty = useMemo(() => {
    if (!isPanelOpen || readOnly || baselineFingerprint === null) return false;
    const now = fingerprintTaskDetailForm({
      editTitle,
      editDescription,
      editPriority,
      editDueDate,
      editSprintId,
      editAssigneeIds,
      editLabels,
      editLinks,
      editChecklist: editChecklist.map(({ text, checked }) => ({
        text,
        checked,
      })),
      drafts: {
        linkDraftUrl,
        linkDraftTitle,
        checklistDraftText,
        newLabelName,
        editingLabelIndex,
      },
    });
    return now !== baselineFingerprint;
  }, [
    baselineFingerprint,
    editAssigneeIds,
    editChecklist,
    editDescription,
    editDueDate,
    editSprintId,
    editLabels,
    editLinks,
    editPriority,
    editTitle,
    checklistDraftText,
    editingLabelIndex,
    isPanelOpen,
    linkDraftTitle,
    linkDraftUrl,
    newLabelName,
    readOnly,
  ]);

  const closePanelCleanup = useCallback(() => {
    setStoryPointState(null);
    setAssigneeSearchQuery('');
    setLinkDraftUrl('');
    setLinkDraftTitle('');
    setChecklistDraftText('');
    setDescriptionEditMode(false);
    setUnsavedDialogOpen(false);
  }, []);

  const handleStoryPointVoteSelect = useCallback(
    async (value: number) => {
      setVotingBusy(true);
      try {
        await voteStoryPointsRequest(task._id, value);
        const next = await fetchStoryPointVotingForTask(task._id);
        setStoryPointState(next);
        if (next?.average != null) {
          await updateTask(task._id, task.columnId, {
            storyPoints: next.average,
          });
        }
        if (boardSlug) void fetchBoard(boardSlug, { silent: true });
      } finally {
        setVotingBusy(false);
      }
    },
    [boardSlug, fetchBoard, task._id, task.columnId, updateTask],
  );

  const handleTaskSheetOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setIsPanelOpen(true);
        return;
      }
      if (readOnly) {
        closePanelCleanup();
        setIsPanelOpen(false);
        return;
      }
      if (isDirty) {
        setUnsavedDialogOpen(true);
        return;
      }
      closePanelCleanup();
      setIsPanelOpen(false);
    },
    [closePanelCleanup, isDirty, readOnly],
  );

  function handleOpenTaskSheet() {
    setIsPanelOpen(true);
  }

  const discardAndClosePanel = useCallback(() => {
    closePanelCleanup();
    setIsPanelOpen(false);
  }, [closePanelCleanup]);

  const handleSaveChanges = useCallback(async () => {
    const storyPointsFromVotes =
      storyPointState?.average ?? taskVoteConsensus;
    const linksPayload = parseLinksForSave(editLinks);
    const checklistPayload = parseChecklistForSave(
      editChecklist.map(({ text, checked }) => ({ text, checked })),
    );
    await updateTask(task._id, task.columnId, {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
      storyPoints: storyPointsFromVotes ?? undefined,
      assigneeIds: editAssigneeIds,
      labels: editLabels.slice(0, 6),
      links: linksPayload,
      checklist: checklistPayload,
      sprintId: editSprintId.trim() ? editSprintId.trim() : null,
    });
    closePanelCleanup();
    setIsPanelOpen(false);
  }, [
    closePanelCleanup,
    editAssigneeIds,
    editChecklist,
    editDescription,
    editDueDate,
    editSprintId,
    editLabels,
    editLinks,
    editPriority,
    editTitle,
    storyPointState?.average,
    task._id,
    task.columnId,
    taskVoteConsensus,
    updateTask,
  ]);

  const confirmUnsavedSave = useCallback(async () => {
    setUnsavedDialogOpen(false);
    await handleSaveChanges();
  }, [handleSaveChanges]);

  const confirmUnsavedDiscard = useCallback(() => {
    setUnsavedDialogOpen(false);
    closePanelCleanup();
    setIsPanelOpen(false);
  }, [closePanelCleanup]);

  const addOrReuseLabel = useCallback(
    (candidate: TaskLabel) => {
      const cleanName = candidate.name.trim().slice(0, 24);
      if (!cleanName) return;
      const key = cleanName.toLowerCase();
      setEditLabels((prev) => {
        if (editingLabelIndex !== null) {
          const next = [...prev];
          const duplicated = next.some(
            (label, idx) =>
              idx !== editingLabelIndex &&
              label.name.trim().toLowerCase() === key,
          );
          if (duplicated) return prev;
          next[editingLabelIndex] = { name: cleanName, color: candidate.color };
          return next;
        }
        if (prev.some((label) => label.name.trim().toLowerCase() === key))
          return prev;
        if (prev.length >= 6) return prev;
        return [...prev, { name: cleanName, color: candidate.color }];
      });
    },
    [editingLabelIndex],
  );

  const handleAddLabel = useCallback(() => {
    const key = newLabelName.trim().toLowerCase();
    if (!key) return;
    const reusable = suggestionByKey[key];
    addOrReuseLabel(reusable ?? { name: newLabelName, color: newLabelColor });
    setNewLabelName('');
    setEditingLabelIndex(null);
  }, [addOrReuseLabel, newLabelColor, newLabelName, suggestionByKey]);

  const removeLabel = useCallback((name: string) => {
    const key = name.trim().toLowerCase();
    setEditLabels((prev) =>
      prev.filter((label) => label.name.trim().toLowerCase() !== key),
    );
    setEditingLabelIndex(null);
  }, []);

  const beginEditLabel = useCallback((label: TaskLabel, idx: number) => {
    setNewLabelName(label.name);
    setNewLabelColor(label.color);
    setEditingLabelIndex(idx);
  }, []);

  const cancelEditLabel = useCallback(() => {
    setEditingLabelIndex(null);
    setNewLabelName('');
    setNewLabelColor('blue');
  }, []);

  useEffect(() => {
    if (!isPanelOpen) return;
    let cancelled = false;

    async function loadStoryPointPanel() {
      const data = await fetchStoryPointVotingForTask(task._id);
      if (!cancelled) setStoryPointState(data);
    }

    void loadStoryPointPanel();
    return () => {
      cancelled = true;
    };
  }, [isPanelOpen, task._id]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform: sortableTransform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: 'Task', task },
    disabled: readOnly || disableDrag,
  });

  const style = useMemo(
    () => ({
      transition,
      transform: CSS.Transform.toString(sortableTransform),
    }),
    [sortableTransform, transition],
  );

  function handleDeleteCardClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    deleteTask(task._id, task.columnId);
  }

  function handleSubmitLinkDraft() {
    const normalized = normalizeTaskLinkUrl(linkDraftUrl);
    if (!normalized) return;
    setEditLinks((prev) => {
      if (prev.length >= 20) return prev;
      const keys = new Set<string>();
      for (const r of prev) {
        const n = normalizeTaskLinkUrl(r.url);
        if (n) keys.add(n);
      }
      if (keys.has(normalized)) return prev;
      const title = linkDraftTitle.trim().slice(0, 200);
      return [...prev, { url: normalized, title }];
    });
    setLinkDraftUrl('');
    setLinkDraftTitle('');
  }

  function handleRemoveLinkRow(index: number) {
    setEditLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmitChecklistDraft() {
    const text = checklistDraftText.trim().slice(0, 500);
    if (!text) return;
    setEditChecklist((prev) => {
      if (prev.length >= 50) return prev;
      return [
        ...prev,
        { id: newChecklistRowId(), text, checked: false },
      ];
    });
    setChecklistDraftText('');
  }

  function handleRemoveChecklistRow(id: string) {
    setEditChecklist((prev) => prev.filter((row) => row.id !== id));
  }

  function handleChecklistTextChange(id: string, text: string) {
    setEditChecklist((prev) =>
      prev.map((row) => (row.id === id ? { ...row, text } : row)),
    );
  }

  function handleChecklistToggle(id: string, checked: boolean) {
    setEditChecklist((prev) =>
      prev.map((row) => (row.id === id ? { ...row, checked } : row)),
    );
  }

  const startDescriptionEdit = useCallback(() => {
    descriptionSnapshotRef.current = editDescription;
    setDescriptionEditMode(true);
  }, [editDescription]);

  const saveDescriptionSection = useCallback(() => {
    setDescriptionEditMode(false);
  }, []);

  const cancelDescriptionEdit = useCallback(() => {
    setEditDescription(descriptionSnapshotRef.current);
    setDescriptionEditMode(false);
  }, []);

  const handleAddAssignee = useCallback(
    (userId: string) => {
      if (readOnly) return;
      setEditAssigneeIds((prev) =>
        prev.includes(userId) ? prev : [...prev, userId],
      );
      setAssigneeSearchQuery('');
    },
    [readOnly],
  );

  const handleRemoveAssignee = useCallback(
    (userId: string) => {
      if (readOnly) return;
      setEditAssigneeIds((prev) => prev.filter((id) => id !== userId));
    },
    [readOnly],
  );

  const sheetProps: TaskDetailSheetProps = {
    readOnly,
    open: isPanelOpen,
    onOpenChange: handleTaskSheetOpenChange,
    onSave: handleSaveChanges,
    onClose: discardAndClosePanel,
    unsavedDialogOpen,
    onUnsavedDialogOpenChange: setUnsavedDialogOpen,
    onConfirmUnsavedSave: confirmUnsavedSave,
    onConfirmUnsavedDiscard: confirmUnsavedDiscard,
    editTitle,
    onEditTitleChange: (e: ChangeEvent<HTMLInputElement>) =>
      setEditTitle(e.target.value),
    editDescription,
    onEditDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) =>
      setEditDescription(e.target.value),
    descriptionEditMode,
    onStartDescriptionEdit: startDescriptionEdit,
    onSaveDescriptionSection: saveDescriptionSection,
    onCancelDescriptionEdit: cancelDescriptionEdit,
    editPriority,
    onSelectPriority: setEditPriority,
    editDueDate,
    onEditDueDateChange: (e: ChangeEvent<HTMLInputElement>) =>
      setEditDueDate(e.target.value),
    panelConsensus,
    panelVoteCount,
    storyPointState,
    votingBusy,
    onStoryPointVoteSelect: handleStoryPointVoteSelect,
    boardMembers,
    editAssigneeIds,
    assigneeSearchQuery,
    onAssigneeSearchChange: (e: ChangeEvent<HTMLInputElement>) =>
      setAssigneeSearchQuery(e.target.value),
    assigneePickCandidates,
    onAddAssignee: handleAddAssignee,
    onRemoveAssignee: handleRemoveAssignee,
    editLabels,
    boardLabelSuggestions,
    newLabelName,
    onNewLabelNameChange: (e: ChangeEvent<HTMLInputElement>) =>
      setNewLabelName(e.target.value),
    onNewLabelKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddLabel();
      }
      if (e.key === 'Escape' && editingLabelIndex !== null) {
        e.preventDefault();
        cancelEditLabel();
      }
    },
    newLabelColor,
    onSelectNewLabelColor: setNewLabelColor,
    editingLabelIndex,
    onBeginLabelEdit: beginEditLabel,
    onRemoveLabel: removeLabel,
    onAddLabel: handleAddLabel,
    onCancelEditLabel: cancelEditLabel,
    onReuseBoardLabel: addOrReuseLabel,
    editLinks,
    linkDraftUrl,
    linkDraftTitle,
    onLinkDraftUrlChange: (e: ChangeEvent<HTMLInputElement>) =>
      setLinkDraftUrl(e.target.value),
    onLinkDraftTitleChange: (e: ChangeEvent<HTMLInputElement>) =>
      setLinkDraftTitle(e.target.value),
    onSubmitLinkDraft: handleSubmitLinkDraft,
    onRemoveLinkRow: handleRemoveLinkRow,
    editChecklist,
    checklistDraftText,
    onChecklistDraftTextChange: (e: ChangeEvent<HTMLInputElement>) =>
      setChecklistDraftText(e.target.value),
    onSubmitChecklistDraft: handleSubmitChecklistDraft,
    onRemoveChecklistRow: handleRemoveChecklistRow,
    onChecklistTextChange: handleChecklistTextChange,
    onChecklistToggle: handleChecklistToggle,
    boardSprints: board?.sprints ?? [],
    editSprintId,
    onEditSprintIdChange: (e: ChangeEvent<HTMLSelectElement>) =>
      setEditSprintId(e.target.value),
  };

  return {
    priorityAccent,
    normalizedLabels,
    teamVoteConsensusLive,
    teamVoteCount,
    overlayVoting: votingSummaryFromTask(task),
    setNodeRef,
    attributes,
    listeners,
    style,
    isDragging,
    readOnly,
    task,
    boardMembers,
    sheetProps,
    handleOpenTaskSheet,
    handleDeleteCardClick,
  };
}
