import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiBase } from "./api";
import { useSession } from "./auth-client";
import { useConnectionStore } from "./store";
import { keys } from "./trello-queries";

interface StreamEvent {
  id?: string;
  type?: string;
  actorId?: string | null;
}

/**
 * Board realtime subscription (SSE). Missed events are impossible to
 * replay (no persistent log), so (re)connect always refetches — correctness
 * over pretending nothing was missed. Own events are skipped via actorId.
 */
export function useBoardRealtime(boardId: string | null) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const myId = session?.user ? (session.user as { id?: string }).id ?? null : null;

  useEffect(() => {
    if (!boardId) return;
    const setStatus = useConnectionStore.getState().setStatus;
    let stopped = false;
    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;
    const seen = new Set<string>();

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: keys.board(boardId, false) });
      queryClient.invalidateQueries({ queryKey: keys.board(boardId, true) });
      queryClient.invalidateQueries({ queryKey: ["card"] });
    };

    const connect = async () => {
      if (stopped) return;
      try {
        source = new EventSource(`${apiBase}/api/v1/realtime/stream?boardId=${boardId}`, { withCredentials: true });
        source.onopen = () => {
          backoff = 1000;
          setStatus(boardId, "live");
          refresh();
        };
        source.onmessage = (ev) => {
          try {
            const event = JSON.parse(ev.data) as StreamEvent;
            if (typeof event.id === "string") {
              if (seen.has(event.id)) return;
              seen.add(event.id);
              if (seen.size > 200) seen.clear();
            }
            if (event.type === "hello") return;
            if (event.actorId && event.actorId === myId) return;
            refresh();
          } catch {
            // Malformed frame — next heartbeat or reconnect recovers.
          }
        };
        source.onerror = () => {
          source?.close();
          source = null;
          if (stopped) return;
          setStatus(boardId, "reconnecting");
          timer = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 15_000);
        };
      } catch {
        if (stopped) return;
        setStatus(boardId, "reconnecting");
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15_000);
      }
    };

    setStatus(boardId, "connecting");
    connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      source?.close();
      useConnectionStore.getState().setStatus(boardId, "offline");
    };
  }, [boardId, myId, queryClient]);
}
