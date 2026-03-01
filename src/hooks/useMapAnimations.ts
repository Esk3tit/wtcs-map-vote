import { useState, useEffect, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type { RevealData } from "./useRevealPhase";

// ============================================================================
// Types
// ============================================================================

interface MapForAnimation {
  _id: Id<"sessionMaps">;
  state: string;
}

interface UseMapAnimationsParams {
  /** All maps from the session query (empty array when data not yet valid). */
  maps: readonly MapForAnimation[];
  /** Session format — only ABBA triggers ban transition detection. */
  format: string | undefined;
  /** Whether any reveal phase is active (for elimination stagger). */
  isAnyReveal: boolean;
  /** Current reveal data (for elimination stagger index). */
  revealData: RevealData | null;
}

interface UseMapAnimationsResult {
  /** Set of map IDs currently animating a ban transition (ABBA). */
  animatingBanIds: Set<string>;
  /** Returns the elimination stagger index for a map, or undefined. */
  getStaggerIndex: (mapId: Id<"sessionMaps">) => number | undefined;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Manages map card animation state: entrance stagger, ABBA ban detection,
 * and multiplayer elimination stagger indices.
 */
export function useMapAnimations({
  maps,
  format,
  isAnyReveal,
  revealData,
}: UseMapAnimationsParams): UseMapAnimationsResult {
  // Track previous map states for ABBA ban animation detection
  const prevMapStatesRef = useRef<Map<string, string>>(new Map());
  const banTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Persist ban animation state (500ms CSS transition + 100ms buffer)
  const [animatingBanIds, setAnimatingBanIds] = useState<Set<string>>(
    new Set()
  );

  // Detect AVAILABLE→BANNED transitions, animate, then clear after timeout.
  // Per-id timers survive effect re-runs so Convex subscription updates
  // mid-animation don't cancel pending cleanup timeouts.
  useEffect(() => {
    const newlyBanned = new Set<string>();
    if (format === "ABBA") {
      for (const map of maps) {
        const prev = prevMapStatesRef.current.get(map._id);
        if (prev === "AVAILABLE" && map.state === "BANNED") {
          newlyBanned.add(map._id);
        }
      }
    }

    // Update ref for next render (must happen every render, not just on ban)
    prevMapStatesRef.current = new Map(
      maps.map((m) => [m._id, m.state])
    );

    if (newlyBanned.size === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external Convex subscription state transitions to UI
    setAnimatingBanIds((prev) => new Set([...prev, ...newlyBanned]));
    for (const id of newlyBanned) {
      const existing = banTimersRef.current.get(id);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        setAnimatingBanIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        banTimersRef.current.delete(id);
      }, 600);

      banTimersRef.current.set(id, timer);
    }
  }, [maps, format]);

  // Clean up all pending ban timers on unmount
  useEffect(() => {
    const timers = banTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // Compute stagger index for multiplayer elimination reveal
  const getStaggerIndex = (mapId: Id<"sessionMaps">): number | undefined => {
    if (!isAnyReveal || !revealData?.eliminatedMapIds) return undefined;
    const idx = revealData.eliminatedMapIds.indexOf(mapId);
    return idx >= 0 ? idx : undefined;
  };

  return {
    animatingBanIds,
    getStaggerIndex,
  };
}
