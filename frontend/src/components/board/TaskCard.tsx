import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Task,
  TaskLabel,
  TaskLabelColor,
  BoardMemberSummary,
  StoryPointVotingState,
} from '../../types/board.types';
import {
  Trash2,
  AlignLeft,
  Check,
  X,
  Plus,
  CalendarDays,
  Sigma,
  Vote,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  AlertTriangle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import { TASK_LABEL_COLORS, taskLabelColorClasses } from '@/constants/taskLabels';
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  getStoryPointVotingRequest,
  voteStoryPointsRequest,
} from '@/api/tasks.api';
import {
  consensusFromVoteValues,
  normalizeStoryPointVotes,
} from '@/utils/storyPointConsensus';

function normalizeTaskLabelsInput(input: unknown): TaskLabel[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set<TaskLabelColor>(TASK_LABEL_COLORS);
  const dedupe = new Set<string>();
  const out: TaskLabel[] = [];
  for (const raw of input) {
    let label: TaskLabel | null = null;
    if (typeof raw === 'string') {
      const name = raw.trim();
      if (name) label = { name: name.slice(0, 24), color: 'blue' };
    } else if (raw && typeof raw === 'object') {
      const nameRaw = (raw as { name?: unknown }).name;
      const colorRaw = (raw as { color?: unknown }).color;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      if (name) {
        const color =
          typeof colorRaw === 'string' && allowed.has(colorRaw as TaskLabelColor)
            ? (colorRaw as TaskLabelColor)
            : 'blue';
        label = { name: name.slice(0, 24), color };
      }
    }
    if (!label) continue;
    const key = label.name.toLowerCase();
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push(label);
    if (out.length >= 6) break;
  }
  return out;
}

async function fetchStoryPointVotingForTask(
  taskId: string,
): Promise<StoryPointVotingState | null> {
  try {
    return await getStoryPointVotingRequest(taskId);
  } catch {
    return null;
  }
}

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  /** Solo lectura: sin arrastrar ni editar (rol viewer). */
  readOnly?: boolean;
}

const STORY_POINT_OPTIONS = [1, 2, 3, 5, 8, 13] as const;

/** Cuántos avatares de asignados se ven en la tarjeta antes del +N. */
const MAX_ASSIGNEE_AVATARS_ON_CARD = 3;

const PRIORITY_OPTIONS: { value: Task['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

/** Color de la barra lateral según prioridad. */
const PRIORITY_ACCENT_BORDER: Record<Task['priority'], string> = {
  low: 'border-l-emerald-500 dark:border-l-emerald-400',
  medium: 'border-l-sky-500 dark:border-l-sky-400',
  high: 'border-l-orange-500 dark:border-l-orange-400',
  urgent: 'border-l-red-500 dark:border-l-red-400',
};

const PRIORITY_ROW_STYLE: Record<
  Task['priority'],
  { bg: string; text: string }
> = {
  low: {
    bg: 'bg-emerald-500/[0.12] dark:bg-emerald-400/[0.14]',
    text: 'text-emerald-900 dark:text-emerald-200',
  },
  medium: {
    bg: 'bg-sky-500/[0.12] dark:bg-sky-400/[0.14]',
    text: 'text-sky-900 dark:text-sky-200',
  },
  high: {
    bg: 'bg-orange-500/[0.12] dark:bg-orange-400/[0.14]',
    text: 'text-orange-950 dark:text-orange-200',
  },
  urgent: {
    bg: 'bg-red-500/[0.12] dark:bg-red-400/[0.14]',
    text: 'text-red-900 dark:text-red-200',
  },
};

function PriorityGlyph({ priority }: { priority: Task['priority'] }) {
  const iconClass = 'size-3.5 shrink-0 opacity-90';
  switch (priority) {
    case 'low':
      return <ArrowDown className={iconClass} aria-hidden />;
    case 'medium':
      return <ArrowUp className={iconClass} aria-hidden />;
    case 'high':
      return <ChevronsUp className={iconClass} aria-hidden />;
    default:
      return <AlertTriangle className={iconClass} aria-hidden />;
  }
}

function votingSummaryFromTask(task: Task) {
  const votes = normalizeStoryPointVotes(task.storyPointVotes);
  const values: number[] = [];
  for (const vote of votes) {
    values.push(vote.value);
  }
  return {
    teamVoteCount: votes.length,
    teamVoteConsensus: consensusFromVoteValues(values),
  };
}

function voteCountPhrase(n: number): string {
  if (n <= 0) return 'sin votos';
  if (n === 1) return '1 voto';
  return `${n} votos`;
}

const dueBadgeTitle: Record<'normal' | 'today' | 'overdue', string> = {
  normal: 'Fecha límite programada',
  today: 'Vence hoy',
  overdue: 'Atrasada',
};

function formatDueDate(raw?: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

function dueDateState(raw?: string): 'normal' | 'today' | 'overdue' {
  if (!raw) return 'normal';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'normal';
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return 'normal';
}

function priorityLabel(priority: Task['priority']): string {
  return (
    PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.label ?? priority
  );
}

function memberInitials(member: BoardMemberSummary): string {
  const base = member.username?.trim() || member.email?.trim() || '?';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return base.slice(0, 2).toUpperCase();
}

function memberByUserId(
  members: BoardMemberSummary[],
  userId: string,
): BoardMemberSummary | undefined {
  return members.find((member) => member.userId === userId);
}

function TaskDetailSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="group rounded-lg border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
    >
      <CollapsibleTrigger
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-surface-800 outline-none hover:bg-surface-100/80 dark:text-surface-200 dark:hover:bg-surface-800/80"
      >
        {title}
        <ChevronDown
          className="size-4 shrink-0 text-surface-500 transition-transform duration-200 group-data-[state=open]:rotate-180 dark:text-surface-400"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-surface-200 px-4 py-3 dark:border-surface-700">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TaskCardMetaChips({
  task,
  normalizedLabels,
  teamVoteConsensus,
  teamVoteCount,
  boardMembers,
}: {
  task: Task;
  normalizedLabels: TaskLabel[];
  teamVoteConsensus: number | null;
  teamVoteCount: number;
  boardMembers: BoardMemberSummary[];
}) {
  const dueDateShort = formatDueDate(task.dueDate);
  const dueState = dueDateState(task.dueDate);
  const assigneeIds = task.assigneeIds ?? [];
  const priority = task.priority || 'medium';
  const priorityRowStyle = PRIORITY_ROW_STYLE[priority];
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
  const hasSp =
    storyPointsShown !== undefined && storyPointsShown !== null;
  const hasMetaIcons =
    hasSp || Boolean(task.description?.trim()) || Boolean(dueDateShort);
  const showAssigneeRow = assigneeIds.length > 0;

  return (
    <>
      <div className="pr-7">
        <p className="font-medium leading-relaxed text-surface-900 dark:text-surface-50">
          {task.title}
        </p>
        <p
          className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium leading-tight ${priorityRowStyle.bg} ${priorityRowStyle.text}`}
        >
          <PriorityGlyph priority={priority} />
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
              className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${taskLabelColorClasses(label.color)}`}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {hasMetaIcons && (
        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-surface-500 dark:text-surface-400"
          aria-label="Detalles de la tarea"
        >
          {hasSp ? (
            <span
              className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300"
              title={storyPointsTitle}
            >
              <Sigma className="size-3.5 shrink-0 opacity-90" aria-hidden />
              <span className="tabular-nums">{storyPointsShown}</span>
            </span>
          ) : null}
          {task.description?.trim() ? (
            <span
              className="inline-flex items-center gap-1"
              title="Tiene descripción"
            >
              <AlignLeft className="size-3.5 shrink-0" aria-hidden />
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
              <CalendarDays className="size-3.5 shrink-0 opacity-90" aria-hidden />
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

function FibonacciButtonRow({
  selected,
  onSelect,
  disabled,
  showNone,
  onSelectNone,
  selectedFilledClass,
}: {
  selected: number | null;
  onSelect: (n: number) => void;
  disabled?: boolean;
  showNone: boolean;
  onSelectNone?: () => void;
  selectedFilledClass?: string;
}) {
  function handleClearSelection() {
    onSelectNone?.();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showNone && (
        <Button
          type="button"
          size="sm"
          variant={selected === null ? 'default' : 'outline'}
          disabled={disabled}
          onClick={handleClearSelection}
        >
          Sin estimar
        </Button>
      )}
      {STORY_POINT_OPTIONS.map((value) => {
        const isSelected = selected === value;
        return (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            disabled={disabled}
            className={
              isSelected && selectedFilledClass ? selectedFilledClass : ''
            }
            onClick={onSelect.bind(null, value)}
          >
            {value}
          </Button>
        );
      })}
    </div>
  );
}

export const TaskCard = ({ task, isOverlay, readOnly = false }: TaskCardProps) => {
  const { board, boardMembers, deleteTask, updateTask, fetchBoard } = useActiveBoardStore();
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
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<TaskLabelColor>('blue');
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(null);
  const [storyPointState, setStoryPointState] = useState<StoryPointVotingState | null>(
    null,
  );
  const [votingBusy, setVotingBusy] = useState(false);

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

  async function handleRefreshStoryPointVoting() {
    const next = await fetchStoryPointVotingForTask(task._id);
    setStoryPointState(next);
  }

  async function handleStoryPointVoteSelect(value: number) {
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
  }

  function handleTaskSheetOpenChange(open: boolean) {
    setIsPanelOpen(open);
    if (!open) setStoryPointState(null);
  }

  function handleOpenTaskSheet() {
    setIsPanelOpen(true);
  }

  function handleCloseTaskSheet() {
    setIsPanelOpen(false);
  }

  function handleRefreshStoryPointVotingClick() {
    void handleRefreshStoryPointVoting();
  }

  function handleSelectPriority(priority: Task['priority']) {
    setEditPriority(priority);
  }

  function handleEditTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setEditTitle(event.target.value);
  }

  function handleEditDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setEditDescription(event.target.value);
  }

  function handleDueDateChange(event: ChangeEvent<HTMLInputElement>) {
    setEditDueDate(event.target.value);
  }

  function handleToggleAssignee(memberUserId: string, currentlySelected: boolean) {
    if (readOnly) return;
    setEditAssigneeIds((prev) =>
      currentlySelected
        ? prev.filter((id) => id !== memberUserId)
        : [...prev, memberUserId],
    );
  }

  function handleBeginLabelEdit(label: TaskLabel, index: number) {
    if (readOnly) return;
    beginEditLabel(label, index);
  }

  function handleRemoveLabelClick(labelName: string) {
    removeLabel(labelName);
  }

  function handleNewLabelNameChange(event: ChangeEvent<HTMLInputElement>) {
    setNewLabelName(event.target.value);
  }

  function handleNewLabelInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddLabel();
    }
    if (event.key === 'Escape' && editingLabelIndex !== null) {
      event.preventDefault();
      cancelEditLabel();
    }
  }

  function handleSelectNewLabelColor(color: TaskLabelColor) {
    setNewLabelColor(color);
  }

  function handleReuseBoardLabel(label: TaskLabel) {
    addOrReuseLabel(label);
  }

  function handleDeleteCardClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    deleteTask(task._id, task.columnId);
  }

  useEffect(() => {
    if (!isPanelOpen) return;
    let cancelled = false;

    async function refreshStoryPointPanel() {
      const data = await fetchStoryPointVotingForTask(task._id);
      if (!cancelled) setStoryPointState(data);
    }

    void refreshStoryPointPanel();
    const timer = window.setInterval(() => {
      void refreshStoryPointPanel();
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isPanelOpen, task._id]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: 'Task', task },
    disabled: readOnly,
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  const handleSaveChanges = async () => {
    const storyPointsFromVotes =
      storyPointState?.average ?? taskVoteConsensus;
    await updateTask(task._id, task.columnId, {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
      storyPoints: storyPointsFromVotes ?? undefined,
      assigneeIds: editAssigneeIds,
      labels: editLabels.slice(0, 6),
    });
    setIsPanelOpen(false);
  };

  const addOrReuseLabel = (candidate: TaskLabel) => {
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
  };

  const handleAddLabel = () => {
    const key = newLabelName.trim().toLowerCase();
    if (!key) return;
    const reusable = suggestionByKey[key];
    addOrReuseLabel(reusable ?? { name: newLabelName, color: newLabelColor });
    setNewLabelName('');
    setEditingLabelIndex(null);
  };

  const removeLabel = (name: string) => {
    const key = name.trim().toLowerCase();
    setEditLabels((prev) =>
      prev.filter((label) => label.name.trim().toLowerCase() !== key),
    );
    setEditingLabelIndex(null);
  };

  const beginEditLabel = (label: TaskLabel, idx: number) => {
    setNewLabelName(label.name);
    setNewLabelColor(label.color);
    setEditingLabelIndex(idx);
  };

  const cancelEditLabel = () => {
    setEditingLabelIndex(null);
    setNewLabelName('');
    setNewLabelColor('blue');
  };

  if (isOverlay) {
    const overlayVoting = votingSummaryFromTask(task);
    return (
      <div
        className={`relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 border-l-4 bg-surface-50 p-3 text-sm shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20 ${priorityAccent}`}
      >
        <TaskCardMetaChips
          task={task}
          normalizedLabels={normalizedLabels}
          teamVoteConsensus={overlayVoting.teamVoteConsensus}
          teamVoteCount={overlayVoting.teamVoteCount}
          boardMembers={boardMembers}
        />
      </div>
    );
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(readOnly ? {} : listeners)}
        onClick={handleOpenTaskSheet}
        className={`group relative select-none rounded-lg border border-surface-200 border-l-4 bg-surface-50 p-3 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45 ${priorityAccent} ${
          readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        <TaskCardMetaChips
          task={task}
          normalizedLabels={normalizedLabels}
          teamVoteConsensus={teamVoteConsensusLive}
          teamVoteCount={teamVoteCount}
          boardMembers={boardMembers}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={handleDeleteCardClick}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <Sheet
        open={isPanelOpen}
        onOpenChange={handleTaskSheetOpenChange}
        modal={false}
      >
        <SheetContent className="z-60 flex w-[90vw] flex-col gap-0 border-l border-surface-200 bg-surface-50 p-0 sm:max-w-lg dark:border-surface-800 dark:bg-surface-900">
          <SheetHeader className="border-b border-surface-200 p-6 dark:border-surface-800">
            <SheetTitle className="text-left text-xl text-surface-900 dark:text-surface-50">
              Detalle de la tarea
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-surface-100 p-6 dark:bg-surface-950">
            <TaskDetailSection title="General" defaultOpen>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    Título
                  </label>
                  <Input
                    value={editTitle}
                    onChange={handleEditTitleChange}
                    readOnly={readOnly}
                    className="h-10 bg-surface-50 text-base font-medium shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    Descripción
                  </label>
                  <Textarea
                    value={editDescription}
                    onChange={handleEditDescriptionChange}
                    placeholder="Añade una descripción…"
                    readOnly={readOnly}
                    className="min-h-40 resize-none bg-surface-50 shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                  />
                </div>
              </div>
            </TaskDetailSection>

            <TaskDetailSection title="Planificación">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    Prioridad
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITY_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={editPriority === opt.value ? 'default' : 'outline'}
                        disabled={readOnly}
                        onClick={handleSelectPriority.bind(null, opt.value)}
                        className={
                          editPriority === opt.value
                            ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
                            : ''
                        }
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    Fecha límite
                  </label>
                  <Input
                    type="date"
                    value={editDueDate}
                    onChange={handleDueDateChange}
                    readOnly={readOnly}
                    className="h-10 bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-md border border-surface-200 bg-surface-50/80 p-3 dark:border-surface-600 dark:bg-surface-900/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                    Story points
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshStoryPointVotingClick}
                  >
                    Actualizar
                  </Button>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Vota en la escala; el número guardado es el Fibonacci más cercano a la media (vale
                  para una sola persona).
                </p>
                <div className="inline-flex items-center gap-2 rounded-md border border-indigo-300 bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Vote size={12} />
                  {panelConsensus != null ? panelConsensus : '—'}
                  <span className="font-normal opacity-85">· {voteCountPhrase(panelVoteCount)}</span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {storyPointState === null && <>Cargando…</>}
                  {storyPointState != null && storyPointState.totalVotes === 0 && (
                    <>Sin votos todavía.</>
                  )}
                  {storyPointState?.myVote != null && ` Tu voto: ${storyPointState.myVote}.`}
                </p>
                <div>
                  <FibonacciButtonRow
                    selected={storyPointState?.myVote ?? null}
                    showNone={false}
                    disabled={votingBusy || readOnly}
                    onSelect={handleStoryPointVoteSelect}
                    selectedFilledClass="bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
                  />
                  {!readOnly && (
                    <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
                      Puedes cambiar tu voto en cualquier momento eligiendo otro número.
                    </p>
                  )}
                </div>
              </div>
            </TaskDetailSection>

            <TaskDetailSection title="Personas">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Asignados
                </label>
                {boardMembers.length === 0 ? (
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    No hay miembros disponibles para asignar.
                  </p>
                ) : (
                  <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-surface-200 bg-surface-50 p-2 dark:border-surface-700 dark:bg-surface-900">
                    {boardMembers.map((member) => {
                      const selected = editAssigneeIds.includes(member.userId);
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          disabled={readOnly}
                          onClick={handleToggleAssignee.bind(null, member.userId, selected)}
                          className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? 'border-indigo-400 bg-indigo-100 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                              : 'border-surface-300 bg-surface-100 text-surface-700 hover:border-indigo-300 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300'
                          }`}
                          title={member.email}
                        >
                          {member.username}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </TaskDetailSection>

            <TaskDetailSection title="Etiquetas">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {editLabels.map((label, idx) => (
                    <div
                      key={`${label.name}-${idx}`}
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
                    >
                      <button
                        type="button"
                        onClick={handleBeginLabelEdit.bind(null, label, idx)}
                        className={`${readOnly ? 'cursor-default' : 'cursor-pointer underline-offset-2 hover:underline'}`}
                        title={readOnly ? label.name : `Editar ${label.name}`}
                      >
                        {label.name}
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleRemoveLabelClick.bind(null, label.name)}
                          className="cursor-pointer opacity-80 hover:opacity-100"
                          title={`Quitar ${label.name}`}
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={newLabelName}
                        onChange={handleNewLabelNameChange}
                        onKeyDown={handleNewLabelInputKeyDown}
                        placeholder="Nueva etiqueta o reutilizar…"
                        className="h-10 bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={handleAddLabel}
                        className="h-10 w-10 shrink-0 bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400"
                        title={
                          editingLabelIndex !== null ? 'Guardar etiqueta' : 'Añadir etiqueta'
                        }
                        aria-label={
                          editingLabelIndex !== null ? 'Guardar etiqueta' : 'Añadir etiqueta'
                        }
                      >
                        {editingLabelIndex !== null ? <Check size={16} /> : <Plus size={16} />}
                      </Button>
                      {editingLabelIndex !== null && (
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="h-10 w-10 shrink-0"
                          onClick={cancelEditLabel}
                          title="Cancelar edición"
                          aria-label="Cancelar edición"
                        >
                          <X size={16} />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {TASK_LABEL_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={handleSelectNewLabelColor.bind(null, color)}
                          className={`h-6 w-6 rounded-md border ${taskLabelColorClasses(color)} ${newLabelColor === color ? 'ring-2 ring-primary-500' : ''}`}
                          title={`Color ${color}`}
                        />
                      ))}
                    </div>
                    {boardLabelSuggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          Reutilizar del tablero:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {boardLabelSuggestions.map((label, idx) => (
                            <button
                              key={`${label.name}-${idx}`}
                              type="button"
                              onClick={handleReuseBoardLabel.bind(null, label)}
                              className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
                            >
                              {label.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Máximo 6 etiquetas por tarea.
                    </p>
                  </>
                )}
              </div>
            </TaskDetailSection>
          </div>

          <SheetFooter className="border-t border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-900">
            {readOnly ? (
              <Button variant="outline" onClick={handleCloseTaskSheet}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseTaskSheet}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveChanges}>Guardar cambios</Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};
