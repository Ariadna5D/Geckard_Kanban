import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  clearStoryPointsVoteRequest,
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
import { calculateNewOrder } from '@/utils/boardMath';
import { apiErrorMessage } from '@/utils/apiErrorMessage';

/**
 * Centraliza estado y acciones de la tarjeta y su panel de detalle
 */
export function useTaskCardViewModel(
  task: Task,
  readOnly: boolean,
  disableDrag = false,
) {
  const {
    board,
    boardMembers,
    archiveTask,
    updateTask,
    fetchBoard,
    moveTaskOptimistic,
  } =
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
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [linkDraftUrl, setLinkDraftUrl] = useState('');
  const [linkDraftTitle, setLinkDraftTitle] = useState('');
  const [checklistDraftText, setChecklistDraftText] = useState('');
  const [editSprintInActive, setEditSprintInActive] = useState(false);
  const [descriptionEditMode, setDescriptionEditMode] = useState(false);
  const descriptionSnapshotRef = useRef('');
  const [baselineFingerprint, setBaselineFingerprint] = useState<string | null>(
    null,
  );
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [linkDraftError, setLinkDraftError] = useState<string | null>(null);

  const normalizedLabels = normalizeTaskLabelsInput(task.labels);
  const suggestionByKey: Record<string, TaskLabel> = {};
  if (board) {
    // Recolecta etiquetas vistas en tablero para sugerencias rapdias
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

  let activeSprintDisplayName = '';
  if (board?.activeSprintId) {
    const sprintRows = board.sprints ?? [];
    for (let sprintIndex = 0; sprintIndex < sprintRows.length; sprintIndex++) {
      if (sprintRows[sprintIndex]._id === board.activeSprintId) {
        activeSprintDisplayName = sprintRows[sprintIndex].name;
        break;
      }
    }
    if (activeSprintDisplayName === '') {
      activeSprintDisplayName = 'Sprint activo';
    }
  }

  let columnOptions: {
    id: string;
    title: string;
    isDoneColumn: boolean;
  }[] = [];
  if (board?.columns?.length) {
    columnOptions = board.columns.map((item) => ({
      id: item._id,
      title: item.title,
      isDoneColumn: item.columnKind === 'done' || item.columnKind === 'archived',
    }));
  }

  let assigneePickCandidates = [];
  const assigneeQueryLower = assigneeSearchQuery.trim().toLowerCase();
  if (assigneeQueryLower.length >= 2) {
    assigneePickCandidates = boardMembers.filter(
      (item) =>
        !editAssigneeIds.includes(item.userId) &&
        (item.username.toLowerCase().includes(assigneeQueryLower) ||
          item.email.toLowerCase().includes(assigneeQueryLower)),
    );
  }

  let completionColumnKind: 'done' | 'archived' | null = null;
  if (board?.columns?.length) {
    const taskColumn = board.columns.find((item) => item._id === task.columnId);
    const kind = taskColumn?.columnKind;
    if (kind === 'done' || kind === 'archived') {
      completionColumnKind = kind;
    }
  }

  const { teamVoteCount: taskVoteSummaryCount, teamVoteConsensus: taskVoteConsensus } =
    votingSummaryFromTask(task);
  let teamVoteCount = taskVoteSummaryCount;
  if (isPanelOpen) {
    teamVoteCount = storyPointState?.totalVotes ?? taskVoteSummaryCount;
  }
  let teamVoteConsensusLive = taskVoteConsensus;
  if (isPanelOpen) {
    teamVoteConsensusLive = storyPointState?.average ?? taskVoteConsensus;
  }
  const panelConsensus = storyPointState?.average ?? taskVoteConsensus;
  const panelVoteCount = storyPointState?.totalVotes ?? taskVoteSummaryCount;

  useEffect(() => {
    if (!isPanelOpen) return;

    let cancelled = false;
    async function run() {
      try {
        // Lee votos al abrir panel para mostrar consenso actualizado
        const result = await getStoryPointVotingRequest(task._id);
        if (!cancelled) {
          setStoryPointState(result);
        }
      } catch {
        if (!cancelled) {
          setStoryPointState(null);
        }
      }
    }
    void run();

    return () => {
      cancelled = true;
    };
  }, [isPanelOpen, task._id]);

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
      (task.links ?? []).map((link) => ({
        url: typeof link.url === 'string' ? link.url : String(link.url ?? ''),
        title:
          typeof link.title === 'string'
            ? link.title
            : link.title != null
              ? String(link.title)
              : '',
      })),
    );
    setEditChecklist(
      (task.checklist ?? []).map((checklistItem, index) => ({
        id: `sync-${task._id}-${index}`,
        text: checklistItem.text || '',
        checked: Boolean(checklistItem.checked),
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

  let isDirty = false;
  if (isPanelOpen && !readOnly && baselineFingerprint !== null) {
    const currentFingerprint = fingerprintTaskDetailForm({
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
    isDirty = currentFingerprint !== baselineFingerprint;
  }

  const closePanelCleanup = useCallback(() => {
    setStoryPointState(null);
    setAssigneeSearchQuery('');
    setLinkDraftUrl('');
    setLinkDraftTitle('');
    setLinkDraftError(null);
    setChecklistDraftText('');
    setDescriptionEditMode(false);
    setUnsavedDialogOpen(false);
  }, []);

  const handleStoryPointVoteSelect = useCallback(
    async (value: number) => {
      setVotingBusy(true);
      try {
        // Envia voto del usuario y luego refresca estado de votacion
        await voteStoryPointsRequest(task._id, value);
        let latestVotingState: StoryPointVotingState | null = null;
        try {
          latestVotingState = await getStoryPointVotingRequest(task._id);
        } catch {
          latestVotingState = null;
        }
        setStoryPointState(latestVotingState);
        if (latestVotingState?.average != null) {
          try {
            // Guarda promedio como story points para dejarlo persistido
            await updateTask(task._id, task.columnId, {
              storyPoints: latestVotingState.average,
            });
          } catch {}
        }
        // Refetch silencioso para traer cambios de otros usuarios tambien
        if (boardSlug) void fetchBoard(boardSlug, { silent: true });
      } finally {
        setVotingBusy(false);
      }
    },
    [boardSlug, fetchBoard, task._id, task.columnId, updateTask],
  );

  const handleStoryPointVoteClear = useCallback(async () => {
    setVotingBusy(true);
    try {
      // Quita voto del usuario y refresca estado de votacion del panel
      await clearStoryPointsVoteRequest(task._id);
      let latestVotingState: StoryPointVotingState | null = null;
      try {
        latestVotingState = await getStoryPointVotingRequest(task._id);
      } catch {
        latestVotingState = null;
      }
      setStoryPointState(latestVotingState);
      if (latestVotingState?.average != null) {
        try {
          await updateTask(task._id, task.columnId, {
            storyPoints: latestVotingState.average,
          });
        } catch {}
      }
      if (boardSlug) void fetchBoard(boardSlug, { silent: true });
    } finally {
      setVotingBusy(false);
    }
  }, [boardSlug, fetchBoard, task._id, task.columnId, updateTask]);

  const handleTaskSheetOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setSaveError(null);
        setLinkDraftError(null);
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
    setSaveError(null);
    setLinkDraftError(null);
    setIsPanelOpen(true);
  }

  const discardAndClosePanel = useCallback(() => {
    closePanelCleanup();
    setIsPanelOpen(false);
  }, [closePanelCleanup]);

  const handleLinkDraftUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setLinkDraftError(null);
      setLinkDraftUrl(event.target.value);
    },
    [],
  );

  const handleSaveChanges = useCallback(async () => {
    setSaveError(null);
    setLinkDraftError(null);
    const storyPointsFromVotes =
      storyPointState?.average ?? taskVoteConsensus;
    const linksDraftMerged = [...editLinks];
    if (linkDraftUrl.trim()) {
      if (!normalizeTaskLinkUrl(linkDraftUrl)) {
        setLinkDraftError('Error: URL invalida');
        return;
      }
      linksDraftMerged.push({ url: linkDraftUrl, title: linkDraftTitle });
    }
    const linksPayload = parseLinksForSave(linksDraftMerged);
    const checklistPayload = parseChecklistForSave(
      editChecklist.map(({ text, checked }) => ({ text, checked })),
    );
    // Prepara patch de sprint para meter o sacar tarea del sprint activo
    const sprintPatch: { sprintId?: string | null } = {};
    const hasActiveSprint =
      board?.sprintsEnabled === true &&
      typeof board.activeSprintId === 'string' &&
      board.activeSprintId.length > 0;
    if (hasActiveSprint) {
      if (editSprintInActive) {
        sprintPatch.sprintId = board.activeSprintId;
      } else {
        sprintPatch.sprintId = null;
      }
    }

    try {
      // Envia patch completo al backend con los cambios del formulario
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
    } catch (error) {
      setSaveError(
        apiErrorMessage(error, 'Error al guardar cambios'),
      );
    }
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

  const moveTaskToColumn = useCallback(
    async (newColumnId: string) => {
      if (!board || readOnly) {
        return;
      }
      if (newColumnId === task.columnId) {
        return;
      }

      const targetColumn = board.columns.find(
        (column) => column._id === newColumnId,
      );
      if (!targetColumn) {
        return;
      }

      const targetTasks = targetColumn.tasks ?? [];
      const lastTask = targetTasks.length
        ? targetTasks[targetTasks.length - 1]
        : null;
      const newOrder = calculateNewOrder(lastTask?.order ?? null, null);

      // Reubica tarea con update optimista y patch de posicion
      await moveTaskOptimistic(
        task._id,
        task.columnId,
        newColumnId,
        newOrder,
        { newColumnId, newOrder },
      );
      closePanelCleanup();
      setIsPanelOpen(false);
    },
    [board, closePanelCleanup, moveTaskOptimistic, readOnly, task._id, task.columnId],
  );

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

  const style = {
    transition,
    transform: CSS.Transform.toString(sortableTransform),
  };

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
    let currentAssignees = task.assigneeIds ?? [];
    if (board?.columns) {
      let foundTask = false;
      for (let columnIndex = 0; columnIndex < board.columns.length; columnIndex++) {
        const column = board.columns[columnIndex];
        const tasksInColumn = column.tasks ?? [];
        for (let taskIndex = 0; taskIndex < tasksInColumn.length; taskIndex++) {
          const boardTask = tasksInColumn[taskIndex];
          if (boardTask._id === task._id) {
            currentAssignees = boardTask.assigneeIds ?? [];
            foundTask = true;
            break;
          }
        }
        if (foundTask) break;
      }
    }
    const alreadyAssigned = currentAssignees.includes(currentUserId);
    const nextAssignees = alreadyAssigned
      ? currentAssignees.filter((id) => id !== currentUserId)
      : [...currentAssignees, currentUserId];
    try {
      await updateTask(task._id, task.columnId, {
        assigneeIds: nextAssignees,
      });
    } catch {}
  }, [
    canSelfAssignShortcut,
    currentUserId,
    board,
    task._id,
    task.assigneeIds,
    task.columnId,
    updateTask,
  ]);

  function handleSubmitLinkDraft() {
    const typedUrl = linkDraftUrl.trim();
    if (!typedUrl) {
      setLinkDraftError(null);
      return;
    }
    const readyUrl = normalizeTaskLinkUrl(linkDraftUrl);
    if (!readyUrl) {
      setLinkDraftError('Error: URL invalida');
      return;
    }
    setLinkDraftError(null);
    setEditLinks((linksNow) => {
      if (linksNow.length >= 20) return linksNow;
      const urlsAlreadyListed = new Set<string>();
      for (const link of linksNow) {
        const normalized = normalizeTaskLinkUrl(link.url);
        if (normalized) urlsAlreadyListed.add(normalized);
      }
      if (urlsAlreadyListed.has(readyUrl)) return linksNow;
      const titleSlice = linkDraftTitle.trim().slice(0, 200);
      return [...linksNow, { url: readyUrl, title: titleSlice }];
    });
    setLinkDraftUrl('');
    setLinkDraftTitle('');
  }

  function handleRemoveLinkRow(linkRowIndex: number) {
    setEditLinks((linksNow) => [
      ...linksNow.slice(0, linkRowIndex),
      ...linksNow.slice(linkRowIndex + 1),
    ]);
  }

  function handleSubmitChecklistDraft() {
    const trimmedLine = checklistDraftText.trim().slice(0, 500);
    if (!trimmedLine) return;
    setEditChecklist((rowsNow) => {
      if (rowsNow.length >= 50) return rowsNow;
      return [
        ...rowsNow,
        {
          id: newChecklistRowId(),
          text: trimmedLine,
          checked: false,
        },
      ];
    });
    setChecklistDraftText('');
  }

  function handleRemoveChecklistRow(entryId: string) {
    setEditChecklist((rowsNow) =>
      rowsNow.filter((row) => row.id !== entryId),
    );
  }

  function handleChecklistTextChange(entryId: string, nextText: string) {
    setEditChecklist((rowsNow) =>
      rowsNow.map((row) =>
        row.id === entryId ? { ...row, text: nextText } : row,
      ),
    );
  }

  function handleChecklistToggle(entryId: string, checked: boolean) {
    setEditChecklist((rowsNow) =>
      rowsNow.map((row) =>
        row.id === entryId ? { ...row, checked } : row,
      ),
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
      setEditAssigneeIds((idsNow) =>
        idsNow.includes(userId) ? idsNow : [...idsNow, userId],
      );
      setAssigneeSearchQuery('');
    },
    [readOnly],
  );

  const handleRemoveAssignee = useCallback(
    (userId: string) => {
      if (readOnly) return;
      setEditAssigneeIds((idsNow) =>
        idsNow.filter((memberId) => memberId !== userId),
      );
    },
    [readOnly],
  );

  const sheetProps: TaskDetailSheetProps = {
    readOnly,
    open: isPanelOpen,
    onOpenChange: handleTaskSheetOpenChange,
    onSave: handleSaveChanges,
    saveError,
    onClose: discardAndClosePanel,
    unsavedDialogOpen,
    onUnsavedDialogOpenChange: setUnsavedDialogOpen,
    onConfirmUnsavedSave: confirmUnsavedSave,
    onConfirmUnsavedDiscard: confirmUnsavedDiscard,
    editTitle,
    onEditTitleChange: (event: ChangeEvent<HTMLInputElement>) =>
      setEditTitle(event.target.value),
    editDescription,
    onEditDescriptionChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
      setEditDescription(event.target.value),
    descriptionEditMode,
    onStartDescriptionEdit: startDescriptionEdit,
    onSaveDescriptionSection: saveDescriptionSection,
    onCancelDescriptionEdit: cancelDescriptionEdit,
    editPriority,
    onSelectPriority: setEditPriority,
    editDueDate,
    onEditDueDateChange: (event: ChangeEvent<HTMLInputElement>) =>
      setEditDueDate(event.target.value),
    currentColumnId: task.columnId,
    columnOptions,
    onMoveToColumn: moveTaskToColumn,
    panelConsensus,
    panelVoteCount,
    storyPointState,
    votingBusy,
    onStoryPointVoteSelect: handleStoryPointVoteSelect,
    onStoryPointVoteClear: handleStoryPointVoteClear,
    boardMembers,
    editAssigneeIds,
    assigneeSearchQuery,
    onAssigneeSearchChange: (event: ChangeEvent<HTMLInputElement>) =>
      setAssigneeSearchQuery(event.target.value),
    assigneePickCandidates,
    onAddAssignee: handleAddAssignee,
    onRemoveAssignee: handleRemoveAssignee,
    editLabels,
    boardLabelSuggestions,
    newLabelName,
    onNewLabelNameChange: (event: ChangeEvent<HTMLInputElement>) =>
      setNewLabelName(event.target.value),
    onNewLabelKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleAddLabel();
      }
      if (event.key === 'Escape' && editingLabelIndex !== null) {
        event.preventDefault();
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
    linkDraftError,
    onLinkDraftUrlChange: handleLinkDraftUrlChange,
    onLinkDraftTitleChange: (event: ChangeEvent<HTMLInputElement>) =>
      setLinkDraftTitle(event.target.value),
    onSubmitLinkDraft: handleSubmitLinkDraft,
    onRemoveLinkRow: handleRemoveLinkRow,
    editChecklist,
    checklistDraftText,
    onChecklistDraftTextChange: (event: ChangeEvent<HTMLInputElement>) =>
      setChecklistDraftText(event.target.value),
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
