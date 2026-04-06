import { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Task,
  TaskLabel,
  TaskLabelColor,
  BoardMemberSummary,
} from '../../types/board.types';
import {
  Trash2,
  AlignLeft,
  Check,
  X,
  Plus,
  CalendarDays,
  Flag,
  Sigma,
  Users,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useActiveBoardStore } from '@/store/useActiveBoardStore';
import { TASK_LABEL_COLORS, taskLabelColorClasses } from '@/constants/taskLabels';
import { getBoardMembersRequest } from '@/api/boards.api';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  /** Solo lectura: sin arrastre, borrado ni edición (rol viewer en el tablero). */
  readOnly?: boolean;
}

export const TaskCard = ({ task, isOverlay, readOnly = false }: TaskCardProps) => {
  const { board, deleteTask, updateTask } = useActiveBoardStore();
  const PRIORITY_LABEL: Record<Task['priority'], string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  };
  const PRIORITY_CLASSES: Record<Task['priority'], string> = {
    low: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    medium:
      'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
    high: 'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300',
    urgent: 'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  };
  const formatDueDate = (raw?: string) => {
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };
  const dueDateState = (raw?: string): 'normal' | 'today' | 'overdue' => {
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
  };
  const dueBadgeClasses: Record<'normal' | 'today' | 'overdue', string> = {
    normal:
      'border-surface-300 bg-surface-100 text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300',
    today:
      'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    overdue:
      'border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  };
  const dueBadgeTitle: Record<'normal' | 'today' | 'overdue', string> = {
    normal: 'Fecha límite programada',
    today: 'Vence hoy',
    overdue: 'Atrasada',
  };
  const dueDateShort = formatDueDate(task.dueDate);
  const dueState = dueDateState(task.dueDate);

  /**
   * Normaliza etiquetas para que el componente soporte:
   * - formato antiguo: string[]
   * - formato actual: { name, color }[]
   */
  const normalizeTaskLabels = (input: unknown): TaskLabel[] => {
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
  };
  
  // Estado local del panel lateral
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || '');
  const [editPriority, setEditPriority] = useState<Task['priority']>(
    task.priority || 'medium',
  );
  const [editDueDate, setEditDueDate] = useState(
    task.dueDate ? task.dueDate.slice(0, 10) : '',
  );
  const [editStoryPoints, setEditStoryPoints] = useState<string>(
    task.storyPoints !== undefined ? String(task.storyPoints) : '',
  );
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>(
    task.assigneeIds || [],
  );
  const [editLabels, setEditLabels] = useState<TaskLabel[]>(
    normalizeTaskLabels(task.labels),
  );
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<TaskLabelColor>('blue');
  const [editingLabelIndex, setEditingLabelIndex] = useState<number | null>(null);
  const [boardMembers, setBoardMembers] = useState<BoardMemberSummary[]>([]);

  const normalizedLabels = normalizeTaskLabels(task.labels);
  const suggestionMap = new Map<string, TaskLabel>();
  board?.columns.forEach((col) => {
    col.tasks?.forEach((t) => {
      normalizeTaskLabels(t.labels).forEach((l) => {
        const key = l.name.trim().toLowerCase();
        if (!key || suggestionMap.has(key)) return;
        suggestionMap.set(key, l);
      });
    });
  });
  const boardLabelSuggestions = Array.from(suggestionMap.values());
  const assigneeCount = task.assigneeIds?.length || 0;

  useEffect(() => {
    if (!isPanelOpen) return;
    void getBoardMembersRequest(task.boardId)
      .then((data) => setBoardMembers(data.members))
      .catch(() => setBoardMembers([]));
  }, [isPanelOpen, task.boardId]);

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

  /**
   * Guarda cambios principales de la tarea.
   */
  const handleSaveChanges = async () => {
    await updateTask(task._id, task.columnId, {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
      storyPoints:
        editStoryPoints.trim() === ''
          ? undefined
          : Number(editStoryPoints),
      assigneeIds: editAssigneeIds,
      labels: editLabels.slice(0, 6),
    });
    setIsPanelOpen(false);
  };

  /**
   * Añade o reutiliza una etiqueta.
   * Si estamos editando, reemplaza la etiqueta seleccionada.
   * @param candidate Etiqueta candidata (nombre + color)
   */
  const addOrReuseLabel = (candidate: TaskLabel) => {
    const cleanName = candidate.name.trim().slice(0, 24);
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    setEditLabels((prev) => {
      if (editingLabelIndex !== null) {
        const next = [...prev];
        const duplicated = next.some(
          (l, idx) => idx !== editingLabelIndex && l.name.trim().toLowerCase() === key,
        );
        if (duplicated) return prev;
        next[editingLabelIndex] = { name: cleanName, color: candidate.color };
        return next;
      }
      if (prev.some((l) => l.name.trim().toLowerCase() === key)) return prev;
      if (prev.length >= 6) return prev;
      return [...prev, { name: cleanName, color: candidate.color }];
    });
  };

  const handleAddLabel = () => {
    const key = newLabelName.trim().toLowerCase();
    if (!key) return;
    const reusable = suggestionMap.get(key);
    addOrReuseLabel(reusable ?? { name: newLabelName, color: newLabelColor });
    setNewLabelName('');
    setEditingLabelIndex(null);
  };

  const removeLabel = (name: string) => {
    const key = name.trim().toLowerCase();
    setEditLabels((prev) => prev.filter((l) => l.name.trim().toLowerCase() !== key));
    setEditingLabelIndex(null);
  };

  /**
   * Carga una etiqueta en el formulario para editar nombre/color.
   */
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

  // Render del clon flotante durante drag & drop
  if (isOverlay) {
    return (
      <div className="relative z-50 scale-105 cursor-grabbing rotate-2 rounded-lg border border-primary-500/35 bg-surface-50 p-3 text-sm shadow-2xl ring-2 ring-primary-500/25 dark:border-primary-400/40 dark:bg-surface-800 dark:ring-primary-400/20">
        <p className="pr-6 font-medium leading-relaxed text-surface-900 dark:text-surface-50">{task.title}</p>
        {normalizedLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {normalizedLabels.map((label, idx) => (
              <span
                key={`${label.name}-${idx}`}
                className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${taskLabelColorClasses(label.color)}`}
                title={label.name}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CLASSES[task.priority || 'medium']}`}
          >
            <Flag size={12} />
            {PRIORITY_LABEL[task.priority || 'medium']}
          </span>
          {dueDateShort && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${dueBadgeClasses[dueState]}`}
              title={dueBadgeTitle[dueState]}
            >
              <CalendarDays size={12} />
              {dueDateShort}
            </span>
          )}
          {task.storyPoints !== undefined && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
              title="Story points"
            >
              <Sigma size={12} />
              {task.storyPoints}
            </span>
          )}
          {assigneeCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
              title={`${assigneeCount} asignado(s)`}
            >
              <Users size={12} />
              {assigneeCount}
            </span>
          )}
        </div>
        {task.description && (
          <div className="mt-2 flex items-center text-surface-500 dark:text-surface-400">
            <AlignLeft size={14} />
          </div>
        )}
      </div>
    );
  }

  // Render del hueco mientras arrastras la tarjeta original
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="min-h-15 rounded-lg border-2 border-dashed border-surface-300 bg-surface-100/60 opacity-40 dark:border-surface-600 dark:bg-surface-800/40"
      />
    );
  }

  // Render normal de tarjeta + panel de detalle
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...(readOnly ? {} : listeners)}
        onClick={() => setIsPanelOpen(true)}
        className={`group relative select-none rounded-lg border border-surface-200 bg-surface-50 p-3 text-sm shadow-sm transition-[border-color,box-shadow] hover:border-primary-500/50 hover:shadow-md dark:border-surface-700 dark:bg-surface-800 dark:hover:border-primary-400/45 ${
          readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
      >
        <p className="pr-6 font-medium leading-relaxed text-surface-900 dark:text-surface-50">{task.title}</p>
        {normalizedLabels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {normalizedLabels.map((label, idx) => (
              <span
                key={`${label.name}-${idx}`}
                className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${taskLabelColorClasses(label.color)}`}
                title={label.name}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${PRIORITY_CLASSES[task.priority || 'medium']}`}
          >
            <Flag size={12} />
            {PRIORITY_LABEL[task.priority || 'medium']}
          </span>
          {dueDateShort && (
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${dueBadgeClasses[dueState]}`}
              title={dueBadgeTitle[dueState]}
            >
              <CalendarDays size={12} />
              {dueDateShort}
            </span>
          )}
          {task.storyPoints !== undefined && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-violet-100 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
              title="Story points"
            >
              <Sigma size={12} />
              {task.storyPoints}
            </span>
          )}
          {assigneeCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
              title={`${assigneeCount} asignado(s)`}
            >
              <Users size={12} />
              {assigneeCount}
            </span>
          )}
        </div>
        {task.description && (
          <div className="mt-2 flex items-center text-surface-500 dark:text-surface-400">
            <AlignLeft size={14} />
          </div>
        )}
        {!readOnly && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            deleteTask(task._id, task.columnId);
          }}
          onPointerDown={(e) => e.stopPropagation()} 
          className="absolute top-3 right-2 rounded-md p-1 text-surface-500 opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 dark:text-surface-400"
        >
          <Trash2 size={16} />
        </button>
        )}
      </div>

      {/* Panel lateral de detalle/edición */}
      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent className="flex w-[90vw] flex-col gap-0 border-l border-surface-200 bg-surface-50 p-0 sm:max-w-lg dark:border-surface-800 dark:bg-surface-900">
          
          <SheetHeader className="border-b border-surface-200 p-6 dark:border-surface-800">
            <SheetTitle className="text-left text-xl text-surface-900 dark:text-surface-50">
              {readOnly ? "Detalle de la tarea" : "Task Details"}
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-surface-100 p-6 dark:bg-surface-950">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">Title</label>
              <Input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                readOnly={readOnly}
                className="h-10 bg-surface-50 text-base font-medium shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
            </div>
            
            <div className="space-y-2 flex-1 flex flex-col">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">Description</label>
              <Textarea 
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a more detailed description..."
                readOnly={readOnly}
                className="min-h-50 flex-1 resize-none bg-surface-50 shadow-sm focus-visible:ring-ring dark:bg-surface-900"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Prioridad
                </label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as Task['priority'])}
                  disabled={readOnly}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Fecha límite
                </label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  readOnly={readOnly}
                  className="h-10 bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                  Story points
                </label>
                <select
                  value={editStoryPoints}
                  onChange={(e) => setEditStoryPoints(e.target.value)}
                  disabled={readOnly}
                  className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="">Sin estimar</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="8">8</option>
                  <option value="13">13</option>
                </select>
              </div>
            </div>
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
                  {boardMembers.map((m) => {
                    const selected = editAssigneeIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          if (readOnly) return;
                          setEditAssigneeIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== m.userId)
                              : [...prev, m.userId],
                          );
                        }}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? 'border-indigo-400 bg-indigo-100 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                            : 'border-surface-300 bg-surface-100 text-surface-700 hover:border-indigo-300 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300'
                        }`}
                        title={m.email}
                      >
                        {m.username}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                Etiquetas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {editLabels.map((label, idx) => (
                  <div
                    key={`${label.name}-${idx}`}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${taskLabelColorClasses(label.color)}`}
                  >
                    <button
                      type="button"
                      onClick={() => !readOnly && beginEditLabel(label, idx)}
                      className={`${readOnly ? 'cursor-default' : 'cursor-pointer underline-offset-2 hover:underline'}`}
                      title={readOnly ? label.name : `Editar ${label.name}`}
                    >
                      {label.name}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeLabel(label.name)}
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
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLabel();
                        }
                        if (e.key === 'Escape' && editingLabelIndex !== null) {
                          e.preventDefault();
                          cancelEditLabel();
                        }
                      }}
                      placeholder="Nueva etiqueta o reutilizar..."
                      className="h-10 bg-surface-50 text-sm shadow-sm focus-visible:ring-ring dark:bg-surface-900"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleAddLabel}
                      className="h-10 w-10 shrink-0 bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400"
                      title={editingLabelIndex !== null ? 'Guardar etiqueta' : 'Añadir etiqueta'}
                      aria-label={editingLabelIndex !== null ? 'Guardar etiqueta' : 'Añadir etiqueta'}
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
                        onClick={() => setNewLabelColor(color)}
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
                            onClick={() => addOrReuseLabel(label)}
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
          </div>

          <SheetFooter className="border-t border-surface-200 bg-surface-50 p-6 dark:border-surface-800 dark:bg-surface-900">
            {readOnly ? (
              <Button variant="outline" onClick={() => setIsPanelOpen(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsPanelOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges}>
                  Save changes
                </Button>
              </>
            )}
          </SheetFooter>

        </SheetContent>
      </Sheet>
    </>
  );
};