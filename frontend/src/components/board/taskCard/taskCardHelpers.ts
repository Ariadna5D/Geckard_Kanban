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

// Deja las etiquetas listas para guardar
export function normalizeTaskLabelsInput(input: unknown): TaskLabel[] {
  if (!Array.isArray(input)) return [];
  // Recorre etiquetas y deja solo datos validos
  const result: TaskLabel[] = [];
  for (const item of input) {
    let data: TaskLabel | null = null;
    if (typeof item === 'string') {
      const name = item.trim();
      if (name) data = { name: name.slice(0, 24), color: 'blue' };
    } else if (item && typeof item === 'object') {
      const nameRaw = (item as { name?: unknown }).name;
      const colorRaw = (item as { color?: unknown }).color;
      const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
      if (name) {
        let color: TaskLabelColor = 'blue';
        if (typeof colorRaw === 'string') {
          for (let index = 0; index < TASK_LABEL_COLORS.length; index++) {
            if (TASK_LABEL_COLORS[index] === colorRaw) {
              color = colorRaw as TaskLabelColor;
              break;
            }
          }
        }
        data = { name: name.slice(0, 24), color };
      }
    }
    if (!data) continue;

    let duplicated = false;
    for (let index = 0; index < result.length; index++) {
      if (result[index].name.toLowerCase() === data.name.toLowerCase()) {
        duplicated = true;
        break;
      }
    }
    if (duplicated) continue;

    result.push(data);
    if (result.length >= 6) break;
  }
  return result;
}

// Calcula el resumen de votos
export function votingSummaryFromTask(task: Task) {
  // Tomamos votos crudos del back y los normalizamos antes del calculo
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

// Crea un texto corto para votos
export function voteCountPhrase(voteCount: number): string {
  if (voteCount <= 0) return 'sin votos';
  if (voteCount === 1) return '1 voto';
  return `${voteCount} votos`;
}

const dueBadgeTitle: Record<'normal' | 'today' | 'overdue', string> = {
  normal: 'Fecha límite programada',
  today: 'Vence hoy',
  overdue: 'Atrasada',
};

export { dueBadgeTitle };

// Formatea la fecha para mostrarla
export function formatDueDate(raw?: string): string | null {
  if (!raw) return null;
  const parsedDue = new Date(raw);
  if (Number.isNaN(parsedDue.getTime())) return null;
  // Mostramos formato corto para ahorrar espacio en tarjeta
  return parsedDue.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

// Marca el estado de la fecha
export function dueDateState(raw?: string): 'normal' | 'today' | 'overdue' {
  if (!raw) return 'normal';
  const parsedDue = new Date(raw);
  if (Number.isNaN(parsedDue.getTime())) return 'normal';
  const due = new Date(
    parsedDue.getFullYear(),
    parsedDue.getMonth(),
    parsedDue.getDate(),
  ).getTime();
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

// Traduce la prioridad a texto visible
export function priorityLabel(priority: Task['priority']): string {
  for (let priorityIndex = 0; priorityIndex < PRIORITY_OPTIONS.length; priorityIndex++) {
    const priorityOption = PRIORITY_OPTIONS[priorityIndex];
    if (priorityOption.value === priority) {
      return priorityOption.label;
    }
  }
  return priority;
}

// Saca una inicial para el avatar
export function memberInitials(member: BoardMemberSummary): string {
  const base = member.username?.trim() || member.email?.trim() || 'U';
  return base.charAt(0).toUpperCase() || 'U';
}

// Busca una persona por su id
export function memberByUserId(
  members: BoardMemberSummary[],
  userId: string,
): BoardMemberSummary | undefined {
  const normalizedUserId = String(userId).trim();
  for (let index = 0; index < members.length; index++) {
    const item = members[index];
    if (String(item.userId).trim() === normalizedUserId) {
      return item;
    }
  }
  return undefined;
}

// Guarda una fila editable del checklist
export type ChecklistEditRow = { id: string; text: string; checked: boolean };

// Crea un id local para checklist
export function newChecklistRowId(): string {
  // Id local para edicion optimista antes de guardar en servidor
  const generatedId = globalThis.crypto?.randomUUID?.();
  if (generatedId) {
    return generatedId;
  }
  return `ck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Decide el titulo visible del enlace
export function linkDisplayHeading(url: string, title: string): string {
  const titleText = title.trim();
  if (titleText) return titleText;
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'Enlace';
  }
}

// Valida si la url se puede abrir
export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url.trim());
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

// Limpia una url pegada en el campo
export function normalizeTaskLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  try {
    const parsedUrl = new URL(trimmed);
    if (parsedUrl.protocol !== 'https:') return null;
    return parsedUrl.href.slice(0, 2048);
  } catch {
    return null;
  }
}

// Prepara los enlaces antes de guardar
export function parseLinksForSave(
  rows: { url: string; title: string }[],
): { url: string; title?: string }[] {
  const parsedLinks: { url: string; title?: string }[] = [];
  const seenUrls = new Set<string>();
  for (const row of rows) {
    if (parsedLinks.length >= 20) break;
    const normalizedUrl = normalizeTaskLinkUrl(row.url);
    if (!normalizedUrl) continue;
    // Evitamos enviar enlaces duplicados en la misma tarea
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    const title = row.title.trim();
    const data: { url: string; title?: string } = { url: normalizedUrl };
    if (title) {
      data.title = title.slice(0, 200);
    }
    parsedLinks.push(data);
  }
  return parsedLinks;
}

// Prepara el checklist antes de guardar
export function parseChecklistForSave(
  rows: { text: string; checked: boolean }[],
): { text: string; checked: boolean }[] {
  // Dejamos solo filas utiles para reducir ruido que llega a la api
  const parsedChecklist: { text: string; checked: boolean }[] = [];
  for (const row of rows) {
    if (parsedChecklist.length >= 50) break;
    const text = row.text.trim().slice(0, 500);
    if (!text) continue;
    parsedChecklist.push({ text, checked: row.checked === true });
  }
  return parsedChecklist;
}

// Guarda los borradores del panel
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
  sprintInActive: boolean;
  drafts: TaskDetailDraftSlice;
};

// Crea una firma para detectar cambios
export function fingerprintTaskDetailForm(slice: TaskDetailEditSlice): string {
  // Firma simple para detectar cambios y decidir si hay dialogo de guardado
  const labelsKey = normalizeTaskLabelsInput(slice.editLabels)
    .map((taskLabel) => `${taskLabel.name.trim().toLowerCase()}\t${taskLabel.color}`)
    .sort()
    .join('|');
  const linksKey = slice.editLinks
    .map((linkRow) => `${linkRow.url.trim()}\t${linkRow.title.trim()}`)
    .join('|');
  const checklistKey = slice.editChecklist
    .map((checklistRow) => `${checklistRow.text.trim()}\t${checklistRow.checked ? '1' : '0'}`)
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
    sprintInActive: slice.sprintInActive,
    linkDraftUrl: slice.drafts.linkDraftUrl.trim(),
    linkDraftTitle: slice.drafts.linkDraftTitle.trim(),
    checklistDraft: slice.drafts.checklistDraftText.trim(),
    newLabelName: slice.drafts.newLabelName.trim(),
    editingLabelIndex: slice.drafts.editingLabelIndex,
  });
}

// Crea la firma inicial del panel
export function fingerprintTaskDetailBaseline(
  task: Task,
  activeSprintId?: string | null,
): string {
  // Armamos la firma base con datos originales que vienen del back
  const activeId =
    typeof activeSprintId === 'string' && activeSprintId.length > 0
      ? activeSprintId
      : null;
  const sprintInActive = Boolean(
    activeId && task.sprintId && task.sprintId === activeId,
  );
  return fingerprintTaskDetailForm({
    editTitle: task.title,
    editDescription: task.description || '',
    editPriority: task.priority || 'medium',
    editDueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    editAssigneeIds: [...(task.assigneeIds || [])],
    editLabels: normalizeTaskLabelsInput(task.labels),
    editLinks: (task.links ?? []).map((link) => ({
      url: typeof link.url === 'string' ? link.url : String(link.url ?? ''),
      title:
        typeof link.title === 'string'
          ? link.title
          : link.title != null
            ? String(link.title)
            : '',
    })),
    editChecklist: (task.checklist ?? []).map((checklistItem) => ({
      text: checklistItem.text || '',
      checked: Boolean(checklistItem.checked),
    })),
    sprintInActive,
    drafts: {
      linkDraftUrl: '',
      linkDraftTitle: '',
      checklistDraftText: '',
      newLabelName: '',
      editingLabelIndex: null,
    },
  });
}
