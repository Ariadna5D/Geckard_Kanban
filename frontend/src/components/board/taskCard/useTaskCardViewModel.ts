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
import { useAuthStore } from '@/store/useAuthStore';
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
  disableDrag = false,
) {
  const { board, boardMembers, archiveTask, updateTask, fetchBoard } =
    useActiveBoardStore();
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

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
  /** Tag on the active sprint (only when the board has an active sprint). */
  const [editSprintInActive, setEditSprintInActive] = useState(false);
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

  const activeSprintDisplayName = useMemo(() => {
    if (!board?.activeSprintId) {
      return '';
    }
    const sprintRows = board.sprints ?? [];
    for (let index = 0; index < sprintRows.length; index++) {
      if (sprintRows[index]._id === board.activeSprintId) {
        return sprintRows[index].name;
      }
    }
    return 'Sprint activo';
  }, [board?.activeSprintId, board?.sprints]);

  const assigneePickCandidates = useMemo(() => {
    const assigneeQueryLower = assigneeSearchQuery.trim().toLowerCase();
    if (assigneeQueryLower.length < 2) return [];
    return boardMembers.filter(
      (member) =>
        !editAssigneeIds.includes(member.userId) &&
        (member.username.toLowerCase().includes(assigneeQueryLower) ||
          member.email.toLowerCase().includes(assigneeQueryLower)),
    );
  }, [assigneeSearchQuery, boardMembers, editAssigneeIds]);

  /** Columna marcada como Hecho o Archivo (misma regla que al cerrar sprint). */
  const completionColumnKind = useMemo(() => {
    if (!board?.columns?.length) return null;
    const col = board.columns.find((c) => c._id === task.columnId);
    const kind = col?.columnKind;
    if (kind === 'done' || kind === 'archived') return kind;
    return null;
  }, [board?.columns, task.columnId]);

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
    setDescriptionEditMode(false);

    const activeSprintIdFromBoard =
      board?.sprintsEnabled === true &&
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0
        ? board.activeSprintId
        : null;
    const taskIsInActiveSprint = Boolean(
      activeSprintIdFromBoard &&
        task.sprintId &&
        task.sprintId === activeSprintIdFromBoard,
    );
    setEditSprintInActive(taskIsInActiveSprint);
    setBaselineFingerprint(
      fingerprintTaskDetailBaseline(task, activeSprintIdFromBoard),
    );
  }, [
    isPanelOpen,
    task._id,
    task.updatedAt,
    task.sprintId,
    board?.activeSprintId,
    board?.sprintsEnabled,
  ]);

  const isDirty = useMemo(() => {
    if (!isPanelOpen || readOnly || baselineFingerprint === null) return false;
    const now = fingerprintTaskDetailForm({
      editTitle,
      editDescription,
      editPriority,
      editDueDate,
      editAssigneeIds,
      editLabels,
      editLinks,
      editChecklist: editChecklist.map(({ text, checked }) => ({
        text,
        checked,
      })),
      sprintInActive: editSprintInActive,
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
    editLabels,
    editLinks,
    editPriority,
    editTitle,
    editSprintInActive,
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
    const linksDraftMerged = [...editLinks];
    if (linkDraftUrl.trim()) {
      linksDraftMerged.push({ url: linkDraftUrl, title: linkDraftTitle });
    }
    const linksPayload = parseLinksForSave(linksDraftMerged);
    const checklistPayload = parseChecklistForSave(
      editChecklist.map(({ text, checked }) => ({ text, checked })),
    );
    const sprintPatch: { sprintId?: string | null } = {};
    if (
      board?.sprintsEnabled === true &&
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0
    ) {
      sprintPatch.sprintId = editSprintInActive
        ? board.activeSprintId
        : null;
    }

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
      ...sprintPatch,
    });
    closePanelCleanup();
    setIsPanelOpen(false);
  }, [
    closePanelCleanup,
    editAssigneeIds,
    editChecklist,
    editDescription,
    editDueDate,
    editLabels,
    editLinks,
    editPriority,
    editTitle,
    linkDraftTitle,
    linkDraftUrl,
    storyPointState?.average,
    task._id,
    task.columnId,
    taskVoteConsensus,
    board?.sprintsEnabled,
    board?.activeSprintId,
    editSprintInActive,
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

  function handleArchiveCardClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    archiveTask(task._id, task.columnId);
  }

  const canSelfAssignShortcut =
    !readOnly && currentUserId !== null && currentUserId.length > 0;
  const isAssignedToCurrentUser =
    currentUserId !== null &&
    currentUserId.length > 0 &&
    (task.assigneeIds ?? []).includes(currentUserId);

  const handleToggleSelfAssign = useCallback(async () => {
    if (!canSelfAssignShortcut || !currentUserId) return;
    const currentAssignees = task.assigneeIds ?? [];
    const alreadyAssigned = currentAssignees.includes(currentUserId);
    const nextAssignees = alreadyAssigned
      ? currentAssignees.filter((id) => id !== currentUserId)
      : [...currentAssignees, currentUserId];
    await updateTask(task._id, task.columnId, {
      assigneeIds: nextAssignees,
    });
  }, [
    canSelfAssignShortcut,
    currentUserId,
    task._id,
    task.assigneeIds,
    task.columnId,
    updateTask,
  ]);

  function handleSubmitLinkDraft() {
    const normalized = normalizeTaskLinkUrl(linkDraftUrl);
    if (!normalized) return;
    setEditLinks((prev) => {
      if (prev.length >= 20) return prev;
      const keys = new Set<string>();
      for (const row of prev) {
        const normalizedUrl = normalizeTaskLinkUrl(row.url);
        if (normalizedUrl) keys.add(normalizedUrl);
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
    sprintSection:
      !readOnly &&
      board?.sprintsEnabled === true &&
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0
        ? {
            activeSprintName:
              activeSprintDisplayName.length > 0
                ? activeSprintDisplayName
                : 'Sprint activo',
            inActiveSprint: editSprintInActive,
            onInActiveSprintChange: setEditSprintInActive,
          }
        : null,
  };

  return {
    priorityAccent,
    completionColumnKind,
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
    canSelfAssignShortcut,
    isAssignedToCurrentUser,
    sheetProps,
    handleOpenTaskSheet,
    handleToggleSelfAssign,
    handleArchiveCardClick,
  };
}
