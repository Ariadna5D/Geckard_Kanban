import { useEffect, useRef } from 'react';

type ActiveBoardFetch = (
  slug: string,
  opts?: { silent?: boolean },
) => Promise<void>;

type UseRefetchBoardWhenTabVisibleParams = {
  /** Slug del tablero en la URL (`/boards/:slug`). */
  slug: string | undefined;
  /** Misma función del store: `useActiveBoardStore.getState().fetchBoard` o la del hook. */
  fetchBoard: ActiveBoardFetch;
  /**
   * Activa el listener solo cuando ya terminó la carga inicial del tablero.
   * Así no compites con el primer `fetchBoard(slug)` del montaje.
   */
  enabled: boolean;
  /**
   * Si es mayor que 0, dispara un refetch silencioso cada X ms **solo mientras la pestaña está visible**.
   * Ver `BOARD_SILENT_POLL_INTERVAL_MS` en `constants/boardRefetch.ts`.
   */
  pollIntervalMs?: number;
};

/**
 * Escucha cuándo la pestaña del navegador pasa a estar visible otra vez
 * (`visibilitychange`: por ejemplo vuelves desde otra pestaña o desde el móvil).
 *
 * En ese momento pide de nuevo el tablero al servidor en modo silencioso
 * (`silent: true`): no muestra el spinner de pantalla completa, solo actualiza datos.
 *
 * Sustituye en parte a WebSockets para equipos pequeños: los cambios de otros
 * aparecen al volver a mirar esta pestaña.
 *
 * Opcionalmente puedes pasar `pollIntervalMs` para repetir el refetch en silencio
 * (útil en demos); si la pestaña está oculta no se dispara el intervalo.
 */
export function useRefetchBoardWhenTabVisible({
  slug,
  fetchBoard,
  enabled,
  pollIntervalMs = 0,
}: UseRefetchBoardWhenTabVisibleParams) {
  const fetchBoardRef = useRef(fetchBoard);
  fetchBoardRef.current = fetchBoard;

  useEffect(() => {
    if (!enabled || !slug) {
      return;
    }

    /**
     * Si el documento no está visible, no hacemos nada.
     * Cuando vuelve a `visible`, pedimos el tablero otra vez.
     */
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void fetchBoardRef.current(slug, { silent: true });
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, slug]);

  /**
   * Refetch periódico en silencio (simulacro / demo).
   * No corre si `pollIntervalMs <= 0` o la pestaña no está en primer plano.
   */
  useEffect(() => {
    if (!enabled || !slug || pollIntervalMs <= 0) {
      return;
    }

    const tick = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void fetchBoardRef.current(slug, { silent: true });
    };

    const id = window.setInterval(tick, pollIntervalMs);
    return () => {
      window.clearInterval(id);
    };
  }, [enabled, slug, pollIntervalMs]);
}
