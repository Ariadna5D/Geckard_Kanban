import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchUsersForInviteRequest } from "@/api/users.api";
import { useActiveBoardStore } from "@/store/useActiveBoardStore";
import { memberUserId, type BoardInviteRole } from "@/types/board.types";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

const ROLE_OPTIONS: { value: BoardInviteRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Lector" },
];

type Props = {
  slug: string;
  boardId: string;
  enabled: boolean;
  onSuccess?: () => void | Promise<void>;
  onCancel?: () => void;
  title?: string;
  className?: string;
};

// Permite buscar y enviar invitaciones
export function BoardInviteBlock({
  slug,
  boardId,
  enabled,
  onSuccess,
  onCancel,
  title,
  className,
}: Props) {
  // Usamos accion del store que termina haciendo peticion al back
  const inviteMember = useActiveBoardStore((storeState) => storeState.inviteMember);
  const board = useActiveBoardStore((storeState) => storeState.board);
  const boardMembers = useActiveBoardStore((storeState) => storeState.boardMembers);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof searchUsersForInviteRequest>>
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<BoardInviteRole>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Cuando el bloque se desactiva limpiamos formulario y resultados
    if (!enabled) {
      setQuery("");
      setResults([]);
      setSelectedId(null);
      setRole("editor");
      setSubmitError(null);
      setSearching(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const inviteSearchQuery = query.trim();
    if (inviteSearchQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = window.setTimeout(() => {
      async function runUserSearch() {
        try {
          // Busqueda remota de usuarios para invitar al tablero
          setResults(await searchUsersForInviteRequest(inviteSearchQuery));
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      }
      void runUserSearch();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [query, enabled]);

  const handleInvite = async () => {
    if (!selectedId) return;
    if (isUserAlreadyInBoard(selectedId)) {
      setSubmitError("Ese usuario ya está en el tablero.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Invitacion al back con rol elegido y usuario seleccionado
      await inviteMember(slug, boardId, { userId: selectedId, role });
      setQuery("");
      setResults([]);
      setSelectedId(null);
      setRole("editor");
      await onSuccess?.();
    } catch (error) {
      setSubmitError(
        apiErrorMessage(error, "No se pudo completar la invitacion"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
  }

  function handleRoleChange(event: ChangeEvent<HTMLSelectElement>) {
    setRole(event.target.value as BoardInviteRole);
  }

  function handleSelectSearchResult(userId: string) {
    if (isUserAlreadyInBoard(userId)) {
      return;
    }
    setSelectedId(userId);
  }

  function handleInviteClick() {
    void handleInvite();
  }

  const selectedUser = results.find((userResult) => userResult.id === selectedId);
  function isUserAlreadyInBoard(userId: string): boolean {
    if (board) {
      const ownerId = String(board.owner ?? "");
      if (ownerId === userId) {
        return true;
      }
      for (let index = 0; index < board.members.length; index++) {
        const memberId = memberUserId(board.members[index]);
        if (memberId === userId) {
          return true;
        }
      }
    }
    for (let index = 0; index < boardMembers.length; index++) {
      if (boardMembers[index].userId === userId) {
        return true;
      }
    }
    return false;
  }
  let blockClassName = "grid gap-3";
  if (className) {
    blockClassName = `grid gap-3 ${className}`;
  }
  let selectedRoleLabel: string = role;
  for (let roleIndex = 0; roleIndex < ROLE_OPTIONS.length; roleIndex++) {
    const roleOption = ROLE_OPTIONS[roleIndex];
    if (roleOption.value === role) {
      selectedRoleLabel = roleOption.label;
      break;
    }
  }

  return (
    <div className={blockClassName}>
      {title && (
        <p className="text-foreground flex items-center gap-2 text-lg font-semibold">
          <UserPlus className="size-5 shrink-0 opacity-70" />
          {title}
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="board-invite-search">Buscar usuario</Label>
        <Input
          id="board-invite-search"
          autoComplete="off"
          placeholder="Mínimo 2 caracteres…"
          value={query}
          onChange={handleSearchChange}
          disabled={!enabled}
          className="h-11 text-base"
        />
        {searching && (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Loader2 className="size-3 animate-spin" />
            Buscando…
          </p>
        )}
      </div>

      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <p className="text-muted-foreground text-xs">Sin coincidencias.</p>
      )}

      {results.length > 0 && (
        <ul
          className="max-h-36 overflow-y-auto rounded-lg border border-border"
          role="listbox"
        >
          {results.map((user) => {
            const alreadyInBoard = isUserAlreadyInBoard(user.id);
            let resultRowClassName =
              "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/80";
            if (selectedId === user.id) {
              resultRowClassName =
                "flex w-full flex-col items-start gap-0.5 bg-primary/10 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/80";
            }
            if (alreadyInBoard) {
              resultRowClassName =
                "flex w-full cursor-not-allowed flex-col items-start gap-0.5 bg-muted/40 px-3 py-2 text-left text-sm opacity-75";
            }
            return (
              <li key={user.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedId === user.id}
                  className={resultRowClassName}
                  onClick={() => handleSelectSearchResult(user.id)}
                  disabled={alreadyInBoard}
                >
                  <span className="font-medium">{user.username}</span>
                  <span className="text-muted-foreground text-xs">{user.email}</span>
                  {alreadyInBoard && (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Ya en el tablero
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="board-invite-role">Rol en el tablero</Label>
        <select
          id="board-invite-role"
          className="border-input bg-background h-11 w-full rounded-lg border px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
          value={role}
          disabled={!enabled}
          onChange={handleRoleChange}
        >
          {ROLE_OPTIONS.map((roleOption) => (
            <option key={roleOption.value} value={roleOption.value}>
              {roleOption.label}
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <p className="text-muted-foreground text-xs">
          Invitar a{" "}
          <strong className="text-foreground">{selectedUser.username}</strong>{" "}
          como{" "}
          <strong className="text-foreground">{selectedRoleLabel}</strong>
          .
        </p>
      )}

      {submitError && (
        <p className="text-destructive text-sm">{submitError}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          disabled={!selectedId || submitting || !enabled}
          onClick={handleInviteClick}
        >
          {!submitting && "Invitar"}
          {submitting && (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enviando…
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
