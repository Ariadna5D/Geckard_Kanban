import { useEffect, useRef } from 'react';

type ActiveBoardFetch = (
  slug: string,
  opts?: { silent?: boolean },
) => Promise<void>;

type UseRefetchBoardWhenTabVisibleParams = {
  slug: string | undefined;
  fetchBoard: ActiveBoardFetch;
  enabled: boolean;
  pollIntervalMs?: number;
};

// Refresca el tablero cuando vuelves a la pestana
export function useRefetchBoardWhenTabVisible({
  slug,
  fetchBoard,
  enabled,
  pollIntervalMs = 0,
}: UseRefetchBoardWhenTabVisibleParams) {
  // Guardamos referencia estable para evitar reusbscribir eventos por cada render
  const fetchBoardRef = useRef(fetchBoard);
  fetchBoardRef.current = fetchBoard;

  useEffect(() => {
    if (!enabled || !slug) {
      return;
    }

    function onVisibilityChange() {
      // Solo refresca cuando la pestana vuelve a estar visible
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

  useEffect(() => {
    if (!enabled || !slug || pollIntervalMs <= 0) {
      return;
    }

    const tick = () => {
      // Poll periodico solo en pestana visible para evitar trafico innecesario
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
