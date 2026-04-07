import { useEffect, useState, type ChangeEvent } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchUsersForInviteRequest } from "@/api/users.api";
import { useActiveBoardStore } from "@/store/useActiveBoardStore";
import type { BoardInviteRole } from "@/types/board.types";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/utils/apiErrorMessage";

const ROLE_OPTIONS: { value: BoardInviteRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Lector" },
];

const INVITE_ERROR_FALLBACK = "No se pudo completar la invitación.";

type Props = {
  slug: string;
  boardId: string;
  /** Si es false, se limpia el formulario (p. ej. al cerrar el panel). */
  enabled: boolean;
  onSuccess?: () => void | Promise<void>;
  /** Muestra botón Cancelar junto a Invitar (p. ej. en el diálogo Compartir). */
  onCancel?: () => void;
  /** Título opcional encima del buscador */
  title?: string;
  className?: string;
};

export function BoardInviteBlock({
  slug,
  boardId,
  enabled,
  onSuccess,
  onCancel,
  title,
  className,
}: Props) {
  const inviteMember = useActiveBoardStore((s) => s.inviteMember);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Awaited<ReturnType<typeof searchUsersForInviteRequest>>
  >([]);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<BoardInviteRole>("editor");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Al cerrar el diálogo/panel, reseteamos el formulario completo.
  useEffect(() => {
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
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeoutId = window.setTimeout(() => {
      async function runUserSearch() {
        try {
          setResults(await searchUsersForInviteRequest(trimmedQuery));
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

  /** Envía invitación con el rol seleccionado al usuario marcado. */
  const handleInvite = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await inviteMember(slug, boardId, { userId: selectedId, role });
      setQuery("");
      setResults([]);
      setSelectedId(null);
      setRole("editor");
      await onSuccess?.();
    } catch (e) {
      setSubmitError(apiErrorMessage(e, INVITE_ERROR_FALLBACK));
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
    setSelectedId(userId);
  }

  function handleInviteClick() {
    void handleInvite();
  }

  const selectedUser = results.find((user) => user.id === selectedId);

  return (
    <div className={cn("grid gap-3", className)}>
      {title ? (
        <p className="text-foreground flex items-center gap-2 text-sm font-medium">
          <UserPlus className="size-4 opacity-70" />
          {title}
        </p>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="board-invite-search">Buscar usuario</Label>
        <Input
          id="board-invite-search"
          autoComplete="off"
          placeholder="Mínimo 2 caracteres…"
          value={query}
          onChange={handleSearchChange}
          disabled={!enabled}
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
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                role="option"
                aria-selected={selectedId === user.id}
                className={cn(
                  "hover:bg-muted/80 flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm transition-colors",
                  selectedId === user.id && "bg-primary/10",
                )}
                onClick={handleSelectSearchResult.bind(null, user.id)}
              >
                <span className="font-medium">{user.username}</span>
                <span className="text-muted-foreground text-xs">{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="board-invite-role">Rol en el tablero</Label>
        <select
          id="board-invite-role"
          className="border-input bg-background h-9 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
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
          <strong className="text-foreground">
            {ROLE_OPTIONS.find((roleOption) => roleOption.value === role)?.label}
          </strong>
          .
        </p>
      )}

      {submitError && (
        <p className="text-destructive text-sm">{submitError}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
        ) : null}
        <Button
          type="button"
          disabled={!selectedId || submitting || !enabled}
          onClick={handleInviteClick}
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enviando…
            </>
          ) : (
            "Invitar"
          )}
        </Button>
      </div>
    </div>
  );
}
