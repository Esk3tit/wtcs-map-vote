import { useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// Constants
// ============================================================================

const TOAST_DEBOUNCE_MS = 5000;

// ============================================================================
// Types
// ============================================================================

interface PlayerConnectionInfo {
  _id: Id<"sessionPlayers">;
  teamName: string;
  isConnected: boolean;
}

interface UseConnectionToastsOptions {
  players: PlayerConnectionInfo[];
  sessionStatus: string | undefined;
  isActive: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Track player connection state changes and fire toast notifications.
 *
 * Compares previous vs current player `isConnected` values on each Convex
 * reactive update and fires Sonner toasts for disconnects, reconnects, and
 * auto-pause transitions. Includes 5-second per-player debounce.
 *
 * @returns markManualPause - Call before dispatching a manual pause mutation
 */
export function useConnectionToasts({
  players,
  sessionStatus,
  isActive,
}: UseConnectionToastsOptions): {
  markManualPause: () => void;
} {
  const prevPlayerStatesRef = useRef<Map<Id<"sessionPlayers">, boolean> | null>(
    null
  );
  const prevSessionStatusRef = useRef<string | null>(null);
  const lastToastTimeRef = useRef<Map<Id<"sessionPlayers">, number>>(
    new Map()
  );
  const manualPauseRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      // Reset all tracking when session is not active
      prevPlayerStatesRef.current = null;
      prevSessionStatusRef.current = null;
      lastToastTimeRef.current.clear();
      return;
    }

    const currentStates = new Map(
      players.map((p) => [p._id, p.isConnected] as const)
    );

    // Skip initial render — just store state, don't fire toasts
    if (prevPlayerStatesRef.current === null) {
      prevPlayerStatesRef.current = currentStates;
      prevSessionStatusRef.current = sessionStatus ?? null;
      return;
    }

    // Detect auto-pause transition (not triggered by manual admin pause)
    const isPauseTransition =
      prevSessionStatusRef.current !== "PAUSED" && sessionStatus === "PAUSED";
    const isAutoPauseTransition =
      isPauseTransition && !manualPauseRef.current;

    // Only consume the manual-pause flag when a pause transition actually arrives
    if (isPauseTransition) {
      manualPauseRef.current = false;
    }

    const now = Date.now();

    for (const player of players) {
      const prevConnected = prevPlayerStatesRef.current.get(player._id);
      if (prevConnected === undefined || prevConnected === player.isConnected)
        continue;

      const lastToast = lastToastTimeRef.current.get(player._id) ?? 0;
      if (now - lastToast < TOAST_DEBOUNCE_MS) continue;

      if (!player.isConnected) {
        // Skip individual disconnect toast if auto-pause toast will fire
        if (!isAutoPauseTransition) {
          toast.warning(`${player.teamName} disconnected`);
        }
      } else {
        toast.success(`${player.teamName} reconnected`);
      }
      lastToastTimeRef.current.set(player._id, now);
    }

    // Fire auto-pause toast
    if (isAutoPauseTransition) {
      const disconnectedPlayer = players.find((p) => !p.isConnected);
      if (disconnectedPlayer) {
        toast.warning(
          `Session auto-paused — ${disconnectedPlayer.teamName} disconnected`
        );
      }
    }

    prevPlayerStatesRef.current = currentStates;
    prevSessionStatusRef.current = sessionStatus ?? null;
  }, [players, sessionStatus, isActive]);

  const markManualPause = useCallback(() => {
    manualPauseRef.current = true;
  }, []);

  return { markManualPause };
}
