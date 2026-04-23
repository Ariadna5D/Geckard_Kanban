import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRightLeft,
  ClipboardList,
  Columns3,
  Check,
  CheckCircle2,
  ChevronRight,
  History,
  Info,
  Keyboard,
  LayoutGrid,
  LogOut,
  Loader2,
  LogOut as LogOutIcon,
  Pencil,
  Plus,
  Settings2,
  Search,
  UserRound,
  UserPlus,
  UserX,
  Undo2,
  Vote,
  Trash2,
  Users,
  Flag,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  type ArchivedBoardColumnSummary,
  type Board,
  type BoardInviteRole,
  type BoardMemberSummary,
  type ClosedSprintRecord,
  type Task,
  boardOwnerUserId,
  canDeleteBoard,
  canEditBoardContent,
  canEditBoardSettings,
  canManageBoardMembers,
  canMemberLeaveBoard,
  getBoardDocumentId,
} from "@/types/board.types";
import {
  deleteBoardRequest,
  getBoardMembersRequest,
  leaveBoardRequest,
  updateBoardRequest,
  type UpdateActiveSprintPayload,
} from "@/api/boards.api";
import {
  useActiveBoardStore,
  type ActiveBoardState,
} from "@/store/useActiveBoardStore";
import { BoardInviteBlock } from "./BoardInviteBlock";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Panel =
  | "menu"
  | "edit"
  | "members"
  | "activity"
  | "shortcuts"
  | "sprints"
  | "archivedTasks"
  | "archivedColumns";

const MANAGEABLE_ROLES: { value: BoardInviteRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Lector" },
];

const KEYBOARD_SHORTCUTS: { keys: string; action: string; scope: string }[] = [
  {
    keys: "Enter",
    action: "Abrir el detalle de la tarea enfocada",
    scope: "Tarjeta en tablero",
  },
  {
    keys: "Espacio",
    action: "Asignarme o quitarme como asignado",
    scope: "Tarjeta en tablero (editor/admin/owner)",
  },
  {
    keys: "Ctrl/Cmd + Enter",
    action: "Guardar cambios de la tarea",
    scope: "Panel de detalle de tarea",
  },
  {
    keys: "Enter",
    action: "Guardar edición del título",
    scope: "Edición de título de columna",
  },
  {
    keys: "Enter",
    action: "Añadir enlace",
    scope: "Campos de enlaces en detalle",
  },
  {
    keys: "Enter",
    action: "Añadir ítem de checklist",
    scope: "Input de checklist en detalle",
  },
  {
    keys: "Enter / Escape",
    action: "Confirmar / cancelar edición de ítem",
    scope: "Edición inline de checklist",
  },
  {
    keys: "Enter / Escape",
    action: "Guardar / cancelar edición de etiqueta",
    scope: "Campo de etiquetas",
  },
];

function roleLabel(role: string): string {
  if (role === "owner") return "Propietario";
  for (let i = 0; i < MANAGEABLE_ROLES.length; i++) {
    if (MANAGEABLE_ROLES[i].value === role) {
      return MANAGEABLE_ROLES[i].label;
    }
  }
  return role;
}

function activityIconForEntry(entry: {
  entityType: string;
  action: string;
}): LucideIcon {
  const action = entry.action;
  if (action === "task.moved" || action === "column.reordered") {
    return ArrowRightLeft;
  }
  if (action === "sprint.closed") {
    return CheckCircle2;
  }
  if (
    action === "task.archived" ||
    action === "column.archived" ||
    action === "sprint.history.deleted"
  ) {
    return Archive;
  }
  if (action === "task.restored" || action === "column.restored") {
    return Undo2;
  }
  if (action === "task.deleted.permanent" || action === "column.deleted") {
    return Trash2;
  }
  if (action === "member.invited") {
    return UserPlus;
  }
  if (action === "member.removed") {
    return UserX;
  }
  if (action === "member.left") {
    return LogOutIcon;
  }
  if (
    action === "task.created" ||
    action === "column.created" ||
    action === "sprint.created"
  ) {
    return Plus;
  }
  if (
    action === "task.updated" ||
    action === "column.updated" ||
    action === "board.updated" ||
    action === "sprint.updated" ||
    action === "sprint.history.renamed" ||
    action === "member.role.updated"
  ) {
    return Pencil;
  }
  if (action === "task.storypoints.voted") {
    return Vote;
  }

  if (entry.action.startsWith("sprint.")) return Flag;
  if (entry.action.startsWith("member.")) return UserRound;
  if (entry.action.startsWith("column.")) return Columns3;
  if (entry.action.startsWith("task.")) return ClipboardList;
  if (entry.action.startsWith("board.")) return Settings2;

  if (entry.entityType === "sprint") return Flag;
  if (entry.entityType === "member") return UserRound;
  if (entry.entityType === "column") return Columns3;
  if (entry.entityType === "task") return ClipboardList;
  return Settings2;
}

function activityActionLabel(action: string): string {
  switch (action) {
    case "task.moved":
    case "column.reordered":
      return "Movió";
    case "sprint.closed":
      return "Cerró";
    case "task.archived":
    case "column.archived":
      return "Archivó";
    case "task.restored":
    case "column.restored":
      return "Restauró";
    case "task.deleted.permanent":
    case "column.deleted":
    case "sprint.history.deleted":
      return "Eliminó";
    case "member.invited":
      return "Invitó";
    case "member.removed":
      return "Expulsó";
    case "member.left":
      return "Abandonó";
    case "task.created":
    case "column.created":
    case "sprint.created":
      return "Creó";
    case "task.updated":
    case "column.updated":
    case "board.updated":
    case "sprint.updated":
    case "sprint.history.renamed":
    case "member.role.updated":
      return "Editó";
    case "task.storypoints.voted":
      return "Votó";
    case "sprint.cancelled":
      return "Canceló";
    default:
      return action;
  }
}

function activityEntityLabel(entityType: string): string {
  switch (entityType) {
    case "task":
      return "Tarea";
    case "column":
      return "Columna";
    case "sprint":
      return "Sprint";
    case "member":
      return "Miembro";
    case "board":
      return "Tablero";
    default:
      return entityType;
  }
}

function activityEntityIcon(entityType: string): LucideIcon {
  if (entityType === "task") return ClipboardList;
  if (entityType === "column") return Columns3;
  if (entityType === "sprint") return Flag;
  if (entityType === "member") return UserRound;
  return Settings2;
}

function activityActionBadgeClass(action: string): string {
  if (
    action === "task.created" ||
    action === "column.created" ||
    action === "sprint.created" ||
    action === "member.invited"
  ) {
    return "border-emerald-300/80 bg-emerald-100 text-emerald-900 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (action === "task.moved" || action === "column.reordered") {
    return "border-sky-300/80 bg-sky-100 text-sky-900 dark:border-sky-700/70 dark:bg-sky-950/40 dark:text-sky-200";
  }
  if (
    action === "task.updated" ||
    action === "column.updated" ||
    action === "board.updated" ||
    action === "sprint.updated" ||
    action === "sprint.history.renamed" ||
    action === "member.role.updated" ||
    action === "task.storypoints.voted"
  ) {
    return "border-violet-300/80 bg-violet-100 text-violet-900 dark:border-violet-700/70 dark:bg-violet-950/40 dark:text-violet-200";
  }
  if (action === "sprint.closed") {
    return "border-lime-300/80 bg-lime-100 text-lime-900 dark:border-lime-700/70 dark:bg-lime-950/40 dark:text-lime-200";
  }
  if (action === "task.archived" || action === "column.archived") {
    return "border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (
    action === "task.deleted.permanent" ||
    action === "column.deleted" ||
    action === "sprint.history.deleted" ||
    action === "member.removed"
  ) {
    return "border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-700/70 dark:bg-rose-950/40 dark:text-rose-200";
  }
  if (action === "member.left" || action === "sprint.cancelled") {
    return "border-slate-300/80 bg-slate-100 text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200";
  }
  if (action === "task.restored" || action === "column.restored") {
    return "border-cyan-300/80 bg-cyan-100 text-cyan-900 dark:border-cyan-700/70 dark:bg-cyan-950/40 dark:text-cyan-200";
  }
  return "border-surface-300/80 bg-surface-50 text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200";
}

function userInitials(username: string): string {
  const usernameText = username.trim();
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < usernameText.length; i++) {
    const ch = usernameText[i];
    if (ch === " " || ch === "\t") {
      if (current.length > 0) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) {
    parts.push(current);
  }
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase() || "?";
}

function selectInviteMember(state: ActiveBoardState) {
  return state.inviteMember;
}

function selectRemoveBoardMember(state: ActiveBoardState) {
  return state.removeBoardMember;
}

function isoToDateInput(iso: string | undefined): string {
  if (!iso) {
    return "";
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToIsoStart(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return new Date(`${trimmed}T08:00:00`).toISOString();
}

function dateInputToIsoEnd(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return new Date(`${trimmed}T23:59:59`).toISOString();
}

function apiErr(e: unknown): string {
  if (isAxiosError(e)) {
    const errorBody = e.response?.data as { message?: string | string[] };
    if (Array.isArray(errorBody?.message))
      return errorBody.message.join(", ");
    if (typeof errorBody?.message === "string") return errorBody.message;
  }
  return "Algo salió mal. Inténtalo de nuevo.";
}

type Props = {
  board: Board;
  slug: string;
  user: { id: string; role: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cierra el sheet y muestra el resumen del sprint cerrado en el tablero. */
  onViewClosedSprint?: (sprintId: string) => void;
};

export function BoardSettingsSheet({
  board,
  slug,
  user,
  open,
  onOpenChange,
  onViewClosedSprint,
}: Props) {
  const navigate = useNavigate();
  const inviteMember = useActiveBoardStore(selectInviteMember);
  const removeBoardMember = useActiveBoardStore(selectRemoveBoardMember);
  const fetchBoard = useActiveBoardStore((state) => state.fetchBoard);
  const boardActivityLogs = useActiveBoardStore((state) => state.boardActivityLogs);
  const loadBoardActivity = useActiveBoardStore((state) => state.loadBoardActivity);
  const archivedTasks = useActiveBoardStore((state) => state.archivedTasks);
  const loadArchivedTasks = useActiveBoardStore((state) => state.loadArchivedTasks);
  const restoreArchivedTask = useActiveBoardStore(
    (state) => state.restoreArchivedTask,
  );
  const purgeArchivedTask = useActiveBoardStore((state) => state.purgeArchivedTask);
  const restoreArchivedColumn = useActiveBoardStore(
    (state) => state.restoreArchivedColumn,
  );
  const purgeArchivedColumn = useActiveBoardStore(
    (state) => state.purgeArchivedColumn,
  );
  const updateActiveSprintBoard = useActiveBoardStore(
    (state) => state.updateActiveSprintBoard,
  );
  const updateClosedSprintHistoryBoard = useActiveBoardStore(
    (state) => state.updateClosedSprintHistoryBoard,
  );
  const deleteClosedSprintHistoryBoard = useActiveBoardStore(
    (state) => state.deleteClosedSprintHistoryBoard,
  );

  const [panel, setPanel] = useState<Panel>("menu");
  const [editTitle, setEditTitle] = useState(board.title);
  const [editDescription, setEditDescription] = useState(
    board.description ?? "",
  );
  const [savingBoard, setSavingBoard] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [expelTarget, setExpelTarget] = useState<BoardMemberSummary | null>(
    null,
  );
  const [expelling, setExpelling] = useState(false);
  const [sheetDangerError, setSheetDangerError] = useState('');

  const [membersLoading, setMembersLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMemberSummary[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<string, BoardInviteRole>>(
    {},
  );
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [sprintsToggleBusy, setSprintsToggleBusy] = useState(false);
  const [sprintsPanelError, setSprintsPanelError] = useState<string | null>(
    null,
  );
  const [activeSprintNameDraft, setActiveSprintNameDraft] = useState("");
  const [activeSprintStartDraft, setActiveSprintStartDraft] = useState("");
  const [activeSprintEndDraft, setActiveSprintEndDraft] = useState("");
  const [activeSprintObjectiveDraft, setActiveSprintObjectiveDraft] =
    useState("");
  const [activeSprintSaveBusy, setActiveSprintSaveBusy] = useState(false);
  const [closedNameDrafts, setClosedNameDrafts] = useState<
    Record<string, string>
  >({});
  const [closedRowBusy, setClosedRowBusy] = useState<string | null>(null);
  const [deleteClosedTarget, setDeleteClosedTarget] =
    useState<ClosedSprintRecord | null>(null);
  const [deleteClosedBusy, setDeleteClosedBusy] = useState(false);
  const [editingClosedSprintId, setEditingClosedSprintId] = useState<
    string | null
  >(null);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedError, setArchivedError] = useState<string | null>(null);
  const [archivedQuery, setArchivedQuery] = useState("");
  const [archivedRowBusy, setArchivedRowBusy] = useState<string | null>(null);
  const [archivedPurgeTarget, setArchivedPurgeTarget] = useState<Task | null>(null);
  const [archivedPurgeBusy, setArchivedPurgeBusy] = useState(false);
  const [archivedColumnsError, setArchivedColumnsError] = useState<string | null>(
    null,
  );
  const [columnRowBusy, setColumnRowBusy] = useState<string | null>(null);
  const [columnPurgeTarget, setColumnPurgeTarget] =
    useState<ArchivedBoardColumnSummary | null>(null);
  const [columnPurgeBusy, setColumnPurgeBusy] = useState(false);

  const canEditContent = canEditBoardContent(board, user);
  const canSettings = canEditBoardSettings(board, user);
  const canDelete = canDeleteBoard(board, user);
  /** Invitar / roles / expulsar: propietario, admin del tablero o admin de la app — no editores ni lectores. */
  const canManageParticipantsUI = canManageBoardMembers(board, user);
  const canLeaveBoard = canMemberLeaveBoard(board, user);

  const boardDocId = getBoardDocumentId(board);

  useEffect(() => {
    if (!open) {
      setPanel("menu");
      setListError(null);
      setActivityError(null);
      setExpelTarget(null);
      setSheetDangerError('');
      setSprintsPanelError(null);
      setEditingClosedSprintId(null);
      setArchivedError(null);
      setArchivedQuery("");
      setArchivedRowBusy(null);
      setArchivedPurgeTarget(null);
      setArchivedColumnsError(null);
      setColumnRowBusy(null);
      setColumnPurgeTarget(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setEditTitle(board.title);
      setEditDescription(board.description ?? "");
    }
  }, [open, board.title, board.description]);

  useEffect(() => {
    if (!open || panel !== "sprints") {
      return;
    }
    const activeId = board.activeSprintId;
    const sprintRows = board.sprints ?? [];
    let activeRow = null;
    for (let index = 0; index < sprintRows.length; index++) {
      if (activeId && sprintRows[index]._id === activeId) {
        activeRow = sprintRows[index];
        break;
      }
    }
    if (activeRow) {
      setActiveSprintNameDraft(activeRow.name);
      setActiveSprintStartDraft(isoToDateInput(activeRow.startedAt));
      setActiveSprintEndDraft(isoToDateInput(activeRow.plannedEndAt));
      setActiveSprintObjectiveDraft(activeRow.objective ?? "");
    } else {
      setActiveSprintNameDraft("");
      setActiveSprintStartDraft("");
      setActiveSprintEndDraft("");
      setActiveSprintObjectiveDraft("");
    }
    const nextDrafts: Record<string, string> = {};
    const closedList = board.closedSprintRecords ?? [];
    for (let index = 0; index < closedList.length; index++) {
      const record = closedList[index];
      nextDrafts[record.sprintId] = record.sprintName;
    }
    setClosedNameDrafts(nextDrafts);
  }, [open, panel, board.activeSprintId, board.sprints, board.closedSprintRecords]);

  const loadMembers = useCallback(async function loadMembers(
    opts?: { showSpinner?: boolean },
  ) {
    if (!boardDocId) return;
    const spin = opts?.showSpinner !== false;
    if (spin) {
      setMembersLoading(true);
      setListError(null);
    }
    try {
      const data = await getBoardMembersRequest(boardDocId);
      setListError(null);
      setOwnerId(data.ownerId);
      setMembers(data.members);
      const drafts: Record<string, BoardInviteRole> = {};
      const list = data.members;
      for (let i = 0; i < list.length; i++) {
        const member = list[i];
        if (member.role !== "owner") {
          drafts[member.userId] = member.role as BoardInviteRole;
        }
      }
      setRoleDraft(drafts);
    } catch {
      setListError(
        spin
          ? "No se pudo cargar la lista de participantes."
          : "No se pudo actualizar la lista.",
      );
    } finally {
      if (spin) setMembersLoading(false);
    }
  }, [boardDocId]);

  useEffect(() => {
    if (!open || panel !== "members" || !boardDocId) return;
    void loadMembers({ showSpinner: true });
  }, [open, panel, boardDocId, loadMembers]);

  useEffect(() => {
    if (!open || panel !== "archivedTasks") {
      return;
    }
    if (boardDocId == null || boardDocId === "") {
      return;
    }
    const idForArchivedTasks: string = boardDocId;
    let cancelled = false;
    async function loadArchivedRows() {
      setArchivedLoading(true);
      setArchivedError(null);
      try {
        await loadArchivedTasks(idForArchivedTasks);
      } catch (errorUnknown) {
        if (!cancelled) {
          setArchivedError(apiErr(errorUnknown));
        }
      } finally {
        if (!cancelled) {
          setArchivedLoading(false);
        }
      }
    }
    void loadArchivedRows();
    return () => {
      cancelled = true;
    };
  }, [open, panel, boardDocId, loadArchivedTasks]);

  const handleSaveBoard = async () => {
    if (!boardDocId || !editTitle.trim()) return;
    setSavingBoard(true);
    try {
      await updateBoardRequest(boardDocId, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      await useActiveBoardStore.getState().fetchBoard(slug, { silent: true });
      setPanel("menu");
    } catch (e) {
      console.error(e);
    } finally {
      setSavingBoard(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!boardDocId) return;
    setSheetDangerError('');
    setDeleting(true);
    try {
      await deleteBoardRequest(boardDocId);
      onOpenChange(false);
      navigate("/dashboard");
    } catch (e) {
      setSheetDangerError(apiErr(e));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleUpdateRole = async (memberUserId: string) => {
    if (!boardDocId) return;
    const nextRole = roleDraft[memberUserId];
    let row: BoardMemberSummary | undefined;
    for (let i = 0; i < members.length; i++) {
      if (members[i].userId === memberUserId) {
        row = members[i];
        break;
      }
    }
    if (!nextRole || !row || row.role === "owner") return;
    if (nextRole === row.role) return;
    setRowBusy(memberUserId);
    try {
      await inviteMember(slug, boardDocId, {
        userId: memberUserId,
        role: nextRole,
      });
      setMembers(function replaceMemberRole(prev) {
        const out: BoardMemberSummary[] = [];
        for (let i = 0; i < prev.length; i++) {
          const member = prev[i];
          if (member.userId === memberUserId) {
            out.push({ ...member, role: nextRole });
          } else {
            out.push(member);
          }
        }
        return out;
      });
    } catch (e) {
      setListError(apiErr(e));
    } finally {
      setRowBusy(null);
    }
  };

  const handleConfirmExpel = async () => {
    if (!boardDocId || !expelTarget) return;
    const memberUserId = expelTarget.userId;
    setExpelling(true);
    setRowBusy(memberUserId);
    try {
      await removeBoardMember(slug, boardDocId, memberUserId);
      setMembers(function withoutExpelledMember(prev) {
        const out: BoardMemberSummary[] = [];
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].userId !== memberUserId) {
            out.push(prev[i]);
          }
        }
        return out;
      });
      setRoleDraft(function removeRoleDraftKey(draft) {
        const nextDraft = { ...draft };
        delete nextDraft[memberUserId];
        return nextDraft;
      });
      setExpelTarget(null);
    } catch (e) {
      setListError(apiErr(e));
    } finally {
      setExpelling(false);
      setRowBusy(null);
    }
  };

  function handleSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen) setPanel("menu");
    onOpenChange(nextOpen);
  }

  function handleBackToMenu() {
    setPanel("menu");
    setListError(null);
    setEditingClosedSprintId(null);
  }

  function handleOpenEditPanel() {
    setPanel("edit");
  }

  function handleOpenDeleteDialog() {
    setSheetDangerError('');
    setDeleteOpen(true);
  }

  function handleOpenMembersPanel() {
    setPanel("members");
  }

  async function handleOpenActivityPanel() {
    setActivityError(null);
    setPanel("activity");
    if (!boardDocId) {
      return;
    }
    setActivityLoading(true);
    try {
      await loadBoardActivity(boardDocId, 80);
    } catch (errorUnknown) {
      setActivityError(apiErr(errorUnknown));
    } finally {
      setActivityLoading(false);
    }
  }

  function handleOpenShortcutsPanel() {
    setPanel("shortcuts");
  }

  function handleOpenSprintsPanel() {
    setSprintsPanelError(null);
    setEditingClosedSprintId(null);
    setPanel("sprints");
  }

  function handleOpenArchivedTasksPanel() {
    setArchivedError(null);
    setArchivedQuery("");
    setPanel("archivedTasks");
  }

  function handleOpenArchivedColumnsPanel() {
    setArchivedColumnsError(null);
    setPanel("archivedColumns");
  }

  async function handleRestoreArchivedBoardColumn(columnId: string) {
    if (!boardDocId) return;
    setColumnRowBusy(columnId);
    setArchivedColumnsError(null);
    try {
      await restoreArchivedColumn(boardDocId, columnId);
    } catch (errorUnknown) {
      setArchivedColumnsError(apiErr(errorUnknown));
    } finally {
      setColumnRowBusy(null);
    }
  }

  async function handleConfirmPurgeArchivedColumn() {
    if (!boardDocId || !columnPurgeTarget) {
      return;
    }
    setColumnPurgeBusy(true);
    setArchivedColumnsError(null);
    try {
      await purgeArchivedColumn(boardDocId, columnPurgeTarget._id);
      setColumnPurgeTarget(null);
    } catch (errorUnknown) {
      setArchivedColumnsError(apiErr(errorUnknown));
    } finally {
      setColumnPurgeBusy(false);
    }
  }

  async function handleSprintsEnabledChange(nextEnabled: boolean) {
    if (!boardDocId) {
      return;
    }
    setSprintsToggleBusy(true);
    setSprintsPanelError(null);
    try {
      await updateBoardRequest(boardDocId, {
        sprintsEnabled: nextEnabled,
      });
      await useActiveBoardStore.getState().fetchBoard(slug, { silent: true });
    } catch (errorUnknown) {
      setSprintsPanelError(apiErr(errorUnknown));
    } finally {
      setSprintsToggleBusy(false);
    }
  }

  async function handleSaveActiveSprintSettings() {
    if (!boardDocId || !board.activeSprintId) {
      return;
    }
    const trimmedName = activeSprintNameDraft.trim();
    if (!trimmedName) {
      setSprintsPanelError("El nombre del sprint no puede estar vacío.");
      return;
    }
    setActiveSprintSaveBusy(true);
    setSprintsPanelError(null);
    try {
      const payload: UpdateActiveSprintPayload = { name: trimmedName };
      const startedIso = dateInputToIsoStart(activeSprintStartDraft);
      const endIso = dateInputToIsoEnd(activeSprintEndDraft);
      if (startedIso !== undefined) {
        payload.startedAt = startedIso;
      }
      if (endIso !== undefined) {
        payload.plannedEndAt = endIso;
      }
      payload.objective = activeSprintObjectiveDraft.trim();
      await updateActiveSprintBoard(
        boardDocId,
        board.activeSprintId,
        payload,
      );
      await fetchBoard(slug, { silent: true });
    } catch (errorUnknown) {
      setSprintsPanelError(apiErr(errorUnknown));
    } finally {
      setActiveSprintSaveBusy(false);
    }
  }

  async function handleSaveClosedSprintName(sprintId: string) {
    if (!boardDocId) {
      return;
    }
    const trimmedName = (closedNameDrafts[sprintId] ?? "").trim();
    if (!trimmedName) {
      setSprintsPanelError("El nombre no puede estar vacío.");
      return;
    }
    setClosedRowBusy(sprintId);
    setSprintsPanelError(null);
    try {
      await updateClosedSprintHistoryBoard(boardDocId, sprintId, trimmedName);
      await fetchBoard(slug, { silent: true });
      setEditingClosedSprintId((current) =>
        current === sprintId ? null : current,
      );
    } catch (errorUnknown) {
      setSprintsPanelError(apiErr(errorUnknown));
    } finally {
      setClosedRowBusy(null);
    }
  }

  function handleStartClosedSprintEdit(record: ClosedSprintRecord) {
    setEditingClosedSprintId(record.sprintId);
    setClosedNameDrafts((previous) => ({
      ...previous,
      [record.sprintId]: record.sprintName,
    }));
  }

  function handleCancelClosedSprintEdit() {
    setEditingClosedSprintId(null);
  }

  function handleViewClosedSprintSummary(sprintId: string) {
    onViewClosedSprint?.(sprintId);
    onOpenChange(false);
  }

  async function handleConfirmDeleteClosedSprint() {
    if (!boardDocId || !deleteClosedTarget) {
      return;
    }
    setDeleteClosedBusy(true);
    setSprintsPanelError(null);
    try {
      await deleteClosedSprintHistoryBoard(
        boardDocId,
        deleteClosedTarget.sprintId,
      );
      setDeleteClosedTarget(null);
      await fetchBoard(slug, { silent: true });
    } catch (errorUnknown) {
      setSprintsPanelError(apiErr(errorUnknown));
    } finally {
      setDeleteClosedBusy(false);
    }
  }

  function handleOpenLeaveDialog() {
    setSheetDangerError('');
    setLeaveOpen(true);
  }

  function handleSaveBoardClick() {
    void handleSaveBoard();
  }

  function handleInviteSuccess() {
    void loadMembers({ showSpinner: false });
  }

  function handleExpelDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen && !expelling) setExpelTarget(null);
  }

  function handleExpelActionClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    void handleConfirmExpel();
  }

  function handleDeleteActionClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    void handleConfirmDelete();
  }

  async function handleConfirmLeave() {
    if (!boardDocId) return;
    setSheetDangerError('');
    setLeaving(true);
    try {
      await leaveBoardRequest(boardDocId);
      onOpenChange(false);
      navigate("/dashboard");
    } catch (e) {
      setSheetDangerError(apiErr(e));
    } finally {
      setLeaving(false);
      setLeaveOpen(false);
    }
  }

  function handleLeaveActionClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    void handleConfirmLeave();
  }

  async function handleRestoreArchivedTask(taskId: string) {
    setArchivedRowBusy(taskId);
    setArchivedError(null);
    try {
      await restoreArchivedTask(taskId);
    } catch (errorUnknown) {
      setArchivedError(apiErr(errorUnknown));
    } finally {
      setArchivedRowBusy(null);
    }
  }

  async function handleConfirmPurgeArchivedTask() {
    if (!archivedPurgeTarget) {
      return;
    }
    setArchivedPurgeBusy(true);
    setArchivedError(null);
    try {
      await purgeArchivedTask(archivedPurgeTarget._id);
      setArchivedPurgeTarget(null);
    } catch (errorUnknown) {
      setArchivedError(apiErr(errorUnknown));
    } finally {
      setArchivedPurgeBusy(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={handleSheetOpenChange}
      >
        <SheetContent
          className="flex w-[90vw] flex-col gap-0 border-l border-surface-200 bg-surface-50 p-0 sm:max-w-md dark:border-surface-800 dark:bg-surface-900"
          showCloseButton
        >
          <SheetHeader className="shrink-0 space-y-0 border-b border-surface-200 p-0 dark:border-surface-800">
            <div className="flex items-center gap-1 pr-12 pl-2 pt-2">
              {panel !== "menu" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Volver"
                  onClick={handleBackToMenu}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <SheetTitle className="flex-1 py-2 text-left text-base">
                {panel === "menu" && "Configuración del tablero"}
                {panel === "edit" && "Editar tablero"}
                {panel === "members" && "Participantes"}
                {panel === "activity" && "Actividad"}
                {panel === "shortcuts" && "Atajos de teclado"}
                {panel === "sprints" && "Sprints"}
                {panel === "archivedTasks" && "Tareas archivadas"}
                {panel === "archivedColumns" && "Columnas archivadas"}
              </SheetTitle>
            </div>
            {panel === "menu" && (
              <SheetDescription className="px-4 pb-3 text-left">
                Opciones del tablero y miembros.
              </SheetDescription>
            )}
          </SheetHeader>

          {panel === "menu" && (
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
              {sheetDangerError !== '' ? (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {sheetDangerError}
                </p>
              ) : null}
              {!canSettings && !canDelete && (
                <p className="text-muted-foreground mb-1 text-sm">
                  Puedes ver los participantes del tablero. La edición avanzada
                  está reservada a administradores y al creador.
                </p>
              )}
              {canSettings && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3"
                  onClick={handleOpenEditPanel}
                >
                  <Pencil className="size-4 shrink-0 opacity-80" />
                  <span className="text-left">Editar tablero</span>
                </Button>
              )}
              {canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 border-danger/30 py-3 text-danger hover:bg-danger/10 dark:border-danger/40 dark:hover:bg-danger/15"
                  onClick={handleOpenDeleteDialog}
                >
                  <Trash2 className="size-4 shrink-0 opacity-90" />
                  <span className="text-left">Eliminar tablero</span>
                </Button>
              )}
              {canLeaveBoard && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3"
                  onClick={handleOpenLeaveDialog}
                >
                  <LogOut className="size-4 shrink-0 opacity-80" />
                  <span className="text-left">Abandonar tablero</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-2 py-3"
                onClick={handleOpenMembersPanel}
              >
                <Users className="size-4 shrink-0 opacity-80" />
                <span className="text-left">Lista de participantes</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-2 py-3"
                onClick={() => void handleOpenActivityPanel()}
              >
                <History className="size-4 shrink-0 opacity-80" />
                <span className="text-left">Actividad del tablero</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-2 py-3"
                onClick={handleOpenShortcutsPanel}
              >
                <Keyboard className="size-4 shrink-0 opacity-80" />
                <span className="text-left">Atajos de teclado</span>
              </Button>
              {canEditContent && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3"
                  onClick={handleOpenArchivedTasksPanel}
                >
                  <ArchiveRestore className="size-4 shrink-0 opacity-80" />
                  <span className="text-left">Tareas archivadas</span>
                </Button>
              )}
              {canEditContent && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3"
                  onClick={handleOpenArchivedColumnsPanel}
                >
                  <LayoutGrid className="size-4 shrink-0 opacity-80" />
                  <span className="text-left">Columnas archivadas</span>
                </Button>
              )}
              {canSettings && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 py-3"
                  onClick={handleOpenSprintsPanel}
                >
                  <Flag className="size-4 shrink-0 opacity-80" />
                  <span className="text-left">Sprints</span>
                </Button>
              )}
            </div>
          )}

          {panel === "archivedTasks" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-surface-200 p-4 dark:border-surface-800">
                <div className="relative">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                    aria-hidden
                  />
                  <Input
                    value={archivedQuery}
                    onChange={(event) => setArchivedQuery(event.target.value)}
                    placeholder="Buscar por título..."
                    className="pl-8"
                  />
                </div>
                {archivedError ? (
                  <p className="mt-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {archivedError}
                  </p>
                ) : null}
              </div>
              {archivedLoading ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <Loader2 className="text-muted-foreground size-8 animate-spin" />
                </div>
              ) : (
                <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {(() => {
                    const queryLower = archivedQuery.trim().toLowerCase();
                    const rows = archivedTasks.filter((task) =>
                      queryLower.length === 0
                        ? true
                        : task.title.toLowerCase().includes(queryLower),
                    );
                    if (rows.length === 0) {
                      return (
                        <li className="text-muted-foreground rounded-lg border border-surface-200 bg-surface-100/70 px-4 py-6 text-center text-sm dark:border-surface-700 dark:bg-surface-950/40">
                          No hay tareas archivadas que coincidan.
                        </li>
                      );
                    }
                    return rows.map((task) => {
                      const busy = archivedRowBusy === task._id;
                      const archivedLabel = task.archivedAt
                        ? new Date(task.archivedAt).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—";
                      return (
                        <li
                          key={task._id}
                          className="rounded-lg border border-surface-200 bg-surface-100/80 p-3 dark:border-surface-700 dark:bg-surface-950/40"
                        >
                          <p className="truncate font-medium text-surface-900 dark:text-surface-50">
                            {task.title}
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Archivada: {archivedLabel}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {canEditContent ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy || archivedPurgeBusy}
                                onClick={() =>
                                  void handleRestoreArchivedTask(task._id)
                                }
                              >
                                {busy ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  "Restaurar"
                                )}
                              </Button>
                            ) : null}
                            {canSettings ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-danger/40 text-danger hover:bg-danger/10 dark:hover:bg-danger/15"
                                disabled={busy || archivedPurgeBusy}
                                onClick={() => setArchivedPurgeTarget(task)}
                              >
                                Borrar definitivamente
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ul>
              )}
            </div>
          )}

          {panel === "activity" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-surface-200 p-4 text-sm text-muted-foreground dark:border-surface-800">
                Registro cronológico de cambios (más recientes primero).
              </div>
              {activityError ? (
                <p className="mx-4 mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {activityError}
                </p>
              ) : null}
              {activityLoading ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {boardActivityLogs.length === 0 ? (
                    <li className="rounded-lg border border-surface-200 bg-surface-100/70 px-4 py-6 text-center text-sm text-muted-foreground dark:border-surface-700 dark:bg-surface-950/40">
                      Aún no hay actividad registrada en este tablero.
                    </li>
                  ) : (
                    boardActivityLogs.map((entry) => {
                      const date = new Date(entry.createdAt);
                      const createdLabel = Number.isNaN(date.getTime())
                        ? entry.createdAt
                        : date.toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                      const Icon = activityIconForEntry(entry);
                      const actionLabel = activityActionLabel(entry.action);
                      const actionBadgeClass = activityActionBadgeClass(entry.action);
                      const entityLabel = activityEntityLabel(entry.entityType);
                      const EntityIcon = activityEntityIcon(entry.entityType);
                      const actorName = entry.actorUsername ?? entry.actorEmail;
                      return (
                        <li
                          key={entry._id}
                          className="rounded-lg border border-surface-200 bg-surface-100/80 p-3 dark:border-surface-700 dark:bg-surface-950/40"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar size="sm" className="mt-0.5 shrink-0">
                              {entry.actorAvatarUrl ? (
                                <AvatarImage
                                  src={entry.actorAvatarUrl}
                                  alt={actorName}
                                  className="object-cover"
                                />
                              ) : null}
                              <AvatarFallback>
                                {userInitials(actorName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${actionBadgeClass}`}
                                >
                                  <Icon className="size-3.5" aria-hidden />
                                  <span className="tracking-wide">{actionLabel}</span>
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-surface-300/80 bg-surface-50 px-1.5 py-0.5 text-surface-700 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200">
                                  <EntityIcon className="size-3.5" aria-hidden />
                                  {entityLabel}
                                </span>
                              </div>
                              <p className="text-sm font-medium break-words text-surface-900 dark:text-surface-50">
                                {entry.message}
                              </p>
                              <p className="mt-1 text-xs break-all text-muted-foreground">
                                {actorName} · {createdLabel}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          )}

          {panel === "archivedColumns" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              {archivedColumnsError ? (
                <p className="mb-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {archivedColumnsError}
                </p>
              ) : null}
              <p className="text-muted-foreground mb-4 text-sm">
                Las columnas archivadas no aparecen en el tablero. Restaurarlas
                devuelve también las tareas que se archivaron al archivar la columna.
                Solo los administradores del tablero pueden borrarlas definitivamente.
              </p>
              <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                {(() => {
                  const rows = board.archivedColumns ?? [];
                  if (rows.length === 0) {
                    return (
                      <li className="text-muted-foreground rounded-lg border border-surface-200 bg-surface-100/70 px-4 py-6 text-center text-sm dark:border-surface-700 dark:bg-surface-950/40">
                        No hay columnas archivadas.
                      </li>
                    );
                  }
                  return rows.map((col) => {
                    const busy = columnRowBusy === col._id;
                    const archivedLabel = col.archivedAt
                      ? new Date(col.archivedAt).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—";
                    return (
                      <li
                        key={col._id}
                        className="rounded-lg border border-surface-200 bg-surface-100/80 p-3 dark:border-surface-700 dark:bg-surface-950/40"
                      >
                        <p className="truncate font-medium text-surface-900 dark:text-surface-50">
                          {col.title}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Archivada: {archivedLabel}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canEditContent ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy || columnPurgeBusy}
                              onClick={() =>
                                void handleRestoreArchivedBoardColumn(col._id)
                              }
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                "Restaurar"
                              )}
                            </Button>
                          ) : null}
                          {canSettings ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-danger/40 text-danger hover:bg-danger/10 dark:hover:bg-danger/15"
                              disabled={busy || columnPurgeBusy}
                              onClick={() => setColumnPurgeTarget(col)}
                            >
                              Borrar definitivamente
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          )}

          {panel === "sprints" && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              {sprintsPanelError ? (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {sprintsPanelError}
                </p>
              ) : null}
              <div className="rounded-lg border border-surface-200 bg-surface-100/80 p-4 dark:border-surface-700 dark:bg-surface-950/40">
                <div className="mb-3 flex items-center gap-2 text-sm text-surface-800 dark:text-surface-100">
                  <span>Habilita sprints para usar el flujo de sprint en este tablero.</span>
                  <Tooltip delayDuration={250}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-surface-200/80 hover:text-surface-700 dark:hover:bg-surface-700/80 dark:hover:text-surface-200"
                        aria-label="Más información sobre sprints"
                      >
                        <Info className="size-3.5" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                      Los editores pueden iniciar/cerrar sprints. Marca columnas como
                      <strong> Hecho</strong> para contar tareas al cierre. Si una
                      columna se llama <strong>Hecho</strong> o <strong>Done</strong>,
                      se marca automáticamente como Hecho.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 rounded border-surface-400"
                    checked={board.sprintsEnabled === true}
                    disabled={sprintsToggleBusy}
                    onChange={(event) =>
                      void handleSprintsEnabledChange(event.target.checked)
                    }
                  />
                  <span className="text-sm leading-snug text-surface-800 dark:text-surface-100">
                    Permitir sprints en este tablero
                    {sprintsToggleBusy ? (
                      <Loader2
                        className="ml-2 inline size-4 animate-spin align-middle text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </label>
              </div>

              {board.activeSprintId ? (
                <div className="rounded-lg border border-surface-200 bg-surface-100/80 p-4 dark:border-surface-700 dark:bg-surface-950/40">
                  <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Sprint activo
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-active-sprint-name">Nombre</Label>
                      <Input
                        id="settings-active-sprint-name"
                        value={activeSprintNameDraft}
                        onChange={(event) =>
                          setActiveSprintNameDraft(event.target.value)
                        }
                        maxLength={80}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-active-sprint-start">
                        Fecha de inicio
                      </Label>
                      <Input
                        id="settings-active-sprint-start"
                        type="date"
                        value={activeSprintStartDraft}
                        onChange={(event) =>
                          setActiveSprintStartDraft(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-active-sprint-end">
                        Fecha de fin planificada
                      </Label>
                      <Input
                        id="settings-active-sprint-end"
                        type="date"
                        value={activeSprintEndDraft}
                        onChange={(event) =>
                          setActiveSprintEndDraft(event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-active-sprint-objective">
                        Objetivo del sprint
                      </Label>
                      <Textarea
                        id="settings-active-sprint-objective"
                        value={activeSprintObjectiveDraft}
                        onChange={(event) =>
                          setActiveSprintObjectiveDraft(event.target.value)
                        }
                        placeholder="Foco u objetivo de este sprint (opcional)"
                        maxLength={2000}
                        rows={3}
                        className="min-h-[4.5rem] resize-y"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={activeSprintSaveBusy}
                      onClick={() => void handleSaveActiveSprintSettings()}
                    >
                      {activeSprintSaveBusy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        "Guardar cambios del sprint"
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="min-h-0">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Sprints cerrados (historial)
                </h3>
                {(() => {
                  const records = board.closedSprintRecords ?? [];
                  if (records.length === 0) {
                    return (
                      <p className="text-muted-foreground mt-2 text-sm">
                        Aún no hay sprints cerrados.
                      </p>
                    );
                  }
                  const ordered = records.slice().reverse();
                  return (
                    <ul className="mt-2 space-y-3 pr-1">
                      {ordered.map((record) => {
                        let completedPoints = 0;
                        for (
                          let snapshotIndex = 0;
                          snapshotIndex < record.taskSnapshots.length;
                          snapshotIndex++
                        ) {
                          const snapshot =
                            record.taskSnapshots[snapshotIndex];
                          if (
                            snapshot.wasCompleted &&
                            typeof snapshot.storyPointsWhenDone === "number"
                          ) {
                            completedPoints += snapshot.storyPointsWhenDone;
                          }
                        }
                        const closedDate = new Date(record.closedAt);
                        const dateLabel = Number.isNaN(closedDate.getTime())
                          ? record.closedAt
                          : closedDate.toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            });
                        const isEditing =
                          editingClosedSprintId === record.sprintId;
                        const draftName =
                          closedNameDrafts[record.sprintId] ?? record.sprintName;
                        const rowBusy = closedRowBusy === record.sprintId;

                        return (
                          <li
                            key={record.sprintId}
                            className="rounded-lg border border-surface-200 bg-surface-100/80 p-3 text-sm dark:border-surface-700 dark:bg-surface-950/40"
                          >
                            <div className="flex gap-2">
                              <div className="min-w-0 flex-1">
                                {isEditing ? (
                                  <Input
                                    value={draftName}
                                    onChange={(event) =>
                                      setClosedNameDrafts((previous) => ({
                                        ...previous,
                                        [record.sprintId]: event.target.value,
                                      }))
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void handleSaveClosedSprintName(
                                          record.sprintId,
                                        );
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        handleCancelClosedSprintEdit();
                                      }
                                    }}
                                    maxLength={80}
                                    disabled={rowBusy}
                                    aria-label="Nombre del sprint cerrado"
                                  />
                                ) : (
                                  <p className="truncate font-medium text-surface-900 dark:text-surface-50">
                                    {record.sprintName}
                                  </p>
                                )}
                                <p className="text-muted-foreground mt-1.5 text-xs">
                                  Cerrado: {dateLabel} · Puntos completados:{" "}
                                  {completedPoints}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-start">
                                {onViewClosedSprint ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-muted-foreground hover:text-foreground"
                                    aria-label="Ver resumen del sprint en el tablero"
                                    title="Ver resumen"
                                    disabled={isEditing}
                                    onClick={() =>
                                      handleViewClosedSprintSummary(
                                        record.sprintId,
                                      )
                                    }
                                  >
                                    <ChevronRight
                                      className="size-4"
                                      aria-hidden
                                    />
                                  </Button>
                                ) : null}
                                {canSettings ? (
                                  isEditing ? (
                                    <>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0 text-primary"
                                        aria-label="Guardar nombre"
                                        title="Aceptar"
                                        disabled={
                                          rowBusy || !draftName.trim()
                                        }
                                        onClick={() =>
                                          void handleSaveClosedSprintName(
                                            record.sprintId,
                                          )
                                        }
                                      >
                                        {rowBusy ? (
                                          <Loader2
                                            className="size-4 animate-spin"
                                            aria-hidden
                                          />
                                        ) : (
                                          <Check
                                            className="size-4"
                                            aria-hidden
                                          />
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0"
                                        aria-label="Cancelar edición"
                                        title="Cancelar"
                                        disabled={rowBusy}
                                        onClick={handleCancelClosedSprintEdit}
                                      >
                                        <X className="size-4" aria-hidden />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      className="shrink-0"
                                      aria-label="Renombrar sprint"
                                      title="Renombrar"
                                      onClick={() =>
                                        handleStartClosedSprintEdit(record)
                                      }
                                    >
                                      <Pencil className="size-4" aria-hidden />
                                    </Button>
                                  )
                                ) : null}
                                {canSettings ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="shrink-0 text-danger hover:bg-danger/10 hover:text-danger"
                                    aria-label="Eliminar del historial"
                                    title="Eliminar del historial"
                                    disabled={isEditing}
                                    onClick={() =>
                                      setDeleteClosedTarget(record)
                                    }
                                  >
                                    <Trash2 className="size-4" aria-hidden />
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </div>
          )}

          {panel === "shortcuts" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
              <p className="text-muted-foreground mb-3 text-sm">
                Usa Tab para enfocar una tarjeta y luego aplica los atajos.
              </p>
              <ul className="space-y-2">
                {KEYBOARD_SHORTCUTS.map((shortcut) => (
                  <li
                    key={`${shortcut.keys}-${shortcut.scope}`}
                    className="rounded-lg border border-surface-200 bg-surface-100/70 p-3 dark:border-surface-700 dark:bg-surface-950/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md border border-surface-300 bg-surface-50 px-2 py-0.5 text-xs font-semibold tracking-wide text-surface-700 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-200">
                        {shortcut.keys}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {shortcut.scope}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-surface-800 dark:text-surface-100">
                      {shortcut.action}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {panel === "edit" && (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="space-y-2">
                <Label htmlFor="board-settings-title">Título</Label>
                <Input
                  id="board-settings-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="board-settings-desc">Descripción</Label>
                <Textarea
                  id="board-settings-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="min-h-28 resize-none"
                />
              </div>
              <SheetFooter className="mt-auto flex-row justify-end gap-2 border-t border-surface-200 p-0 pt-4 sm:justify-end dark:border-surface-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBackToMenu}
                  disabled={savingBoard}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={savingBoard || !editTitle.trim()}
                  onClick={handleSaveBoardClick}
                >
                  {savingBoard ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </SheetFooter>
            </div>
          )}

          {panel === "members" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {listError && (
                <p className="text-destructive shrink-0 px-4 pt-2 text-sm">
                  {listError}
                </p>
              )}
              {canManageParticipantsUI && boardDocId ? (
                <div className="shrink-0 border-b border-surface-200 bg-surface-100/60 p-4 dark:border-surface-800 dark:bg-surface-950/40">
                  <BoardInviteBlock
                    title="Añadir participante"
                    slug={slug}
                    boardId={boardDocId}
                    enabled={open && panel === "members" && canManageParticipantsUI}
                    onSuccess={handleInviteSuccess}
                  />
                </div>
              ) : null}
              <div className="text-muted-foreground shrink-0 px-4 pt-3 text-xs font-medium tracking-wide uppercase">
                En el tablero
              </div>
              {membersLoading ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <Loader2 className="text-muted-foreground size-8 animate-spin" />
                </div>
              ) : (
                <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pt-2">
                  {members.map((member) => {
                    const isOwnerRow =
                      member.userId === (ownerId ?? boardOwnerUserId(board));
                    const busy = rowBusy === member.userId;
                    const draft =
                      roleDraft[member.userId] ?? (member.role as BoardInviteRole);
                    const showManage =
                      canManageParticipantsUI && !isOwnerRow;

                    return (
                      <li
                        key={member.userId}
                        className="rounded-lg border border-surface-200 bg-surface-100/80 p-3 dark:border-surface-700 dark:bg-surface-950/40"
                      >
                        <div className="flex gap-3">
                          <Avatar size="default" className="mt-0.5">
                            {member.avatarUrl ? (
                              <AvatarImage
                                src={member.avatarUrl}
                                alt=""
                                className="object-cover"
                              />
                            ) : null}
                            <AvatarFallback>
                              {userInitials(member.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-surface-900 dark:text-surface-50">
                              {member.username}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {member.email}
                            </p>
                            {isOwnerRow ? (
                              <p className="text-muted-foreground mt-2 text-sm">
                                Rol:{" "}
                                <strong>{roleLabel("owner")}</strong>
                              </p>
                            ) : showManage ? (
                              <>
                                <div className="mt-3 mb-2">
                                  <Label className="text-xs">Rol</Label>
                                  <select
                                    className="border-input bg-background mt-1 h-9 w-full rounded-lg border px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
                                    value={draft}
                                    disabled={busy}
                                    onChange={(e) =>
                                      setRoleDraft((d) => ({
                                        ...d,
                                        [member.userId]: e.target
                                          .value as BoardInviteRole,
                                      }))
                                    }
                                  >
                                    {MANAGEABLE_ROLES.map((roleOption) => (
                                      <option key={roleOption.value} value={roleOption.value}>
                                        {roleOption.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={
                                      busy ||
                                      draft === (member.role as BoardInviteRole)
                                    }
                                    onClick={handleUpdateRole.bind(null, member.userId)}
                                  >
                                    {busy ? (
                                      <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                      "Actualizar"
                                    )}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-danger/40 text-danger hover:bg-danger/10 dark:hover:bg-danger/15"
                                    disabled={busy}
                                    onClick={setExpelTarget.bind(null, member)}
                                  >
                                    Expulsar
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <p className="text-muted-foreground mt-2 text-sm">
                                Rol:{" "}
                                <strong>{roleLabel(member.role)}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!expelTarget}
        onOpenChange={handleExpelDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Expulsar participante?</AlertDialogTitle>
            <AlertDialogDescription>
              {expelTarget ? (
                <>
                  <strong>{expelTarget.username}</strong> dejará de tener
                  acceso a este tablero de inmediato.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={expelling}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={expelling}
              onClick={handleExpelActionClick}
            >
              {expelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Expulsar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este tablero?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará <strong>{board.title}</strong> y todo su contenido. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleting}
              onClick={handleDeleteActionClick}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteClosedTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteClosedBusy) {
            setDeleteClosedTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar este sprint del historial?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteClosedTarget ? (
                <>
                  Se eliminará <strong>{deleteClosedTarget.sprintName}</strong> de
                  la lista. No se borran tareas del tablero.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteClosedBusy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={deleteClosedBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteClosedSprint();
              }}
            >
              {deleteClosedBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Eliminar del historial"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!columnPurgeTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !columnPurgeBusy) {
            setColumnPurgeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar definitivamente esta columna?</AlertDialogTitle>
            <AlertDialogDescription>
              {columnPurgeTarget ? (
                <>
                  Se eliminarán de forma permanente la columna{" "}
                  <strong>{columnPurgeTarget.title}</strong> y todas las tareas que
                  sigan asociadas a ella. Esta acción no se puede deshacer.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={columnPurgeBusy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={columnPurgeBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPurgeArchivedColumn();
              }}
            >
              {columnPurgeBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Borrar permanentemente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!archivedPurgeTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !archivedPurgeBusy) {
            setArchivedPurgeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar definitivamente esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              {archivedPurgeTarget ? (
                <>
                  Se eliminará <strong>{archivedPurgeTarget.title}</strong> de forma
                  permanente. Esta acción no se puede deshacer.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivedPurgeBusy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={archivedPurgeBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmPurgeArchivedTask();
              }}
            >
              {archivedPurgeBusy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                "Borrar permanentemente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Abandonar este tablero?</AlertDialogTitle>
            <AlertDialogDescription>
              Perderás acceso a <strong>{board.title}</strong> hasta que alguien
              vuelva a invitarte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger text-white hover:bg-danger/90"
              disabled={leaving}
              onClick={handleLeaveActionClick}
            >
              {leaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Abandonar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
