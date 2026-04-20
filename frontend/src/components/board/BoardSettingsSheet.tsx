import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  ArrowLeft,
  Keyboard,
  LogOut,
  Loader2,
  Pencil,
  Trash2,
  Users,
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
  type Board,
  type BoardInviteRole,
  type BoardMemberSummary,
  boardOwnerUserId,
  canDeleteBoard,
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
} from "@/api/boards.api";
import {
  useActiveBoardStore,
  type ActiveBoardState,
} from "@/store/useActiveBoardStore";
import { BoardInviteBlock } from "./BoardInviteBlock";

type Panel = "menu" | "edit" | "members" | "shortcuts";

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
};

export function BoardSettingsSheet({
  board,
  slug,
  user,
  open,
  onOpenChange,
}: Props) {
  const navigate = useNavigate();
  const inviteMember = useActiveBoardStore(selectInviteMember);
  const removeBoardMember = useActiveBoardStore(selectRemoveBoardMember);

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
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<BoardMemberSummary[]>([]);
  const [roleDraft, setRoleDraft] = useState<Record<string, BoardInviteRole>>(
    {},
  );
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

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
      setExpelTarget(null);
      setSheetDangerError('');
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setEditTitle(board.title);
      setEditDescription(board.description ?? "");
    }
  }, [open, board.title, board.description]);

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

  function handleOpenShortcutsPanel() {
    setPanel("shortcuts");
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
                {panel === "shortcuts" && "Atajos de teclado"}
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
                onClick={handleOpenShortcutsPanel}
              >
                <Keyboard className="size-4 shrink-0 opacity-80" />
                <span className="text-left">Atajos de teclado</span>
              </Button>
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
