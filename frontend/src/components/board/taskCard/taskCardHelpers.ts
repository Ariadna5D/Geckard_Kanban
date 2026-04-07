import { TASK_LABEL_COLORS } from '@/constants/taskLabels';
import type {
  BoardMemberSummary,
  Task,
  TaskLabel,
  TaskLabelColor,
} from '@/types/board.types';
import {
  consensusFromVoteValues,
  normalizeStoryPointVotes,
} from '@/utils/storyPointConsensus';
import { PRIORITY_OPTIONS } from './taskCardConstants';

export function normalizeTaskLabelsInput(input: unknown): TaskLabel[] {
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

export function votingSummaryFromTask(task: Task) {
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

export function voteCountPhrase(n: number): string {
  if (n <= 0) return 'sin votos';
  if (n === 1) return '1 voto';
  return `${n} votos`;
}

const dueBadgeTitle: Record<'normal' | 'today' | 'overdue', string> = {
  normal: 'Fecha límite programada',
  today: 'Vence hoy',
  overdue: 'Atrasada',
};

export { dueBadgeTitle };

export function formatDueDate(raw?: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

export function dueDateState(raw?: string): 'normal' | 'today' | 'overdue' {
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

export function priorityLabel(priority: Task['priority']): string {
  return (
    PRIORITY_OPTIONS.find((opt) => opt.value === priority)?.label ?? priority
  );
}

export function memberInitials(member: BoardMemberSummary): string {
  const base = member.username?.trim() || member.email?.trim() || '?';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return base.slice(0, 2).toUpperCase();
}

export function memberByUserId(
  members: BoardMemberSummary[],
  userId: string,
): BoardMemberSummary | undefined {
  return members.find((member) => member.userId === userId);
}

/** Fila de checklist en el formulario (id estable en cliente hasta guardar). */
export type ChecklistEditRow = { id: string; text: string; checked: boolean };

export function newChecklistRowId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `ck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Título visible del enlace: título manual o, si falta, el host de la URL. */
export function linkDisplayHeading(url: string, title: string): string {
  const t = title.trim();
  if (t) return t;
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'Enlace';
  }
}

/** Comprueba si la URL es segura para usar en `href` (solo http/https). */
export function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normaliza URL de enlace (añade https:// si falta el protocolo). */
export function normalizeTaskLinkUrl(raw: string): string | null {
  let t = raw.trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) {
    t = `https://${t}`;
  }
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href.slice(0, 2048);
  } catch {
    return null;
  }
}

export function parseLinksForSave(
  rows: { url: string; title: string }[],
): { url: string; title?: string }[] {
  const out: { url: string; title?: string }[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (out.length >= 20) break;
    const normalized = normalizeTaskLinkUrl(row.url);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const title = row.title.trim();
    out.push({
      url: normalized,
      ...(title ? { title: title.slice(0, 200) } : {}),
    });
  }
  return out;
}

export function parseChecklistForSave(
  rows: { text: string; checked: boolean }[],
): { text: string; checked: boolean }[] {
  const out: { text: string; checked: boolean }[] = [];
  for (const row of rows) {
    if (out.length >= 50) break;
    const text = row.text.trim().slice(0, 500);
    if (!text) continue;
    out.push({ text, checked: row.checked === true });
  }
  return out;
}

/** Borradores del panel que cuentan como cambio sin guardar. */
export type TaskDetailDraftSlice = {
  linkDraftUrl: string;
  linkDraftTitle: string;
  checklistDraftText: string;
  newLabelName: string;
  editingLabelIndex: number | null;
};

export type TaskDetailEditSlice = {
  editTitle: string;
  editDescription: string;
  editPriority: Task['priority'];
  editDueDate: string;
  editAssigneeIds: string[];
  editLabels: TaskLabel[];
  editLinks: { url: string; title: string }[];
  editChecklist: { text: string; checked: boolean }[];
  drafts: TaskDetailDraftSlice;
};

/** Huella estable del formulario del panel para detectar cambios sin guardar. */
export function fingerprintTaskDetailForm(slice: TaskDetailEditSlice): string {
  const labelsKey = normalizeTaskLabelsInput(slice.editLabels)
    .map((l) => `${l.name.trim().toLowerCase()}\t${l.color}`)
    .sort()
    .join('|');
  const linksKey = slice.editLinks
    .map((r) => `${r.url.trim()}\t${r.title.trim()}`)
    .join('|');
  const checklistKey = slice.editChecklist
    .map((r) => `${r.text.trim()}\t${r.checked ? '1' : '0'}`)
    .join('|');
  return JSON.stringify({
    title: slice.editTitle.trim(),
    description: slice.editDescription,
    priority: slice.editPriority,
    dueDate: slice.editDueDate,
    assigneeIds: [...slice.editAssigneeIds].sort().join(','),
    labelsKey,
    linksKey,
    checklistKey,
    linkDraftUrl: slice.drafts.linkDraftUrl.trim(),
    linkDraftTitle: slice.drafts.linkDraftTitle.trim(),
    checklistDraft: slice.drafts.checklistDraftText.trim(),
    newLabelName: slice.drafts.newLabelName.trim(),
    editingLabelIndex: slice.drafts.editingLabelIndex,
  });
}

/** Huella al abrir el panel (contenido de la tarea + borradores vacíos). */
export function fingerprintTaskDetailBaseline(task: Task): string {
  return fingerprintTaskDetailForm({
    editTitle: task.title,
    editDescription: task.description || '',
    editPriority: task.priority || 'medium',
    editDueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    editAssigneeIds: [...(task.assigneeIds || [])],
    editLabels: normalizeTaskLabelsInput(task.labels),
    editLinks: (task.links ?? []).map((l) => ({
      url: typeof l.url === 'string' ? l.url : String(l.url ?? ''),
      title:
        typeof l.title === 'string'
          ? l.title
          : l.title != null
            ? String(l.title)
            : '',
    })),
    editChecklist: (task.checklist ?? []).map((c) => ({
      text: c.text || '',
      checked: Boolean(c.checked),
    })),
    drafts: {
      linkDraftUrl: '',
      linkDraftTitle: '',
      checklistDraftText: '',
      newLabelName: '',
      editingLabelIndex: null,
    },
  });
}
