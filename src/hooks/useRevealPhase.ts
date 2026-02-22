import { useReducer, useEffect } from "react";
import { usePrevious } from "@/hooks/usePrevious";
import { useRevealTimer } from "@/hooks/useRevealTimer";
import {
  REVEAL_DURATION_MS,
  WINNER_REVEAL_DURATION_MS,
} from "../../convex/lib/constants";
import type { Id } from "../../convex/_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

export type RoundOutcome = "ROUND_ADVANCED" | "REVOTE" | "WINNER" | "RANDOM_WINNER";

export type RevealData = {
  completedRound: number;
  eliminatedMapIds: Id<"sessionMaps">[];
  outcome: RoundOutcome;
};

export type PhaseState =
  | { phase: "VOTING" }
  | { phase: "REVEALING"; reveal: RevealData }
  | { phase: "WINNER_REVEAL"; reveal: RevealData; winnerMapId: Id<"sessionMaps"> }
  | { phase: "REDIRECTING"; reveal: RevealData; winnerMapId: Id<"sessionMaps"> };

export type PhaseEvent =
  | {
      type: "ROUND_COMPLETED";
      completedRound: number;
      eliminatedMapIds: Id<"sessionMaps">[];
      outcome: "ROUND_ADVANCED" | "REVOTE";
    }
  | {
      type: "WINNER_DETECTED";
      winnerMapId: Id<"sessionMaps">;
      completedRound: number;
      eliminatedMapIds: Id<"sessionMaps">[];
      outcome: "WINNER" | "RANDOM_WINNER";
    }
  | { type: "REVEAL_TIMER_ELAPSED" }
  | { type: "WINNER_REVEAL_ELAPSED" };

// ============================================================================
// Reducer & Helpers
// ============================================================================

export const INITIAL_PHASE_STATE: PhaseState = { phase: "VOTING" };

export function phaseReducer(state: PhaseState, event: PhaseEvent): PhaseState {
  switch (event.type) {
    case "ROUND_COMPLETED":
      if (state.phase !== "VOTING") return state;
      return {
        phase: "REVEALING",
        reveal: {
          completedRound: event.completedRound,
          eliminatedMapIds: event.eliminatedMapIds,
          outcome: event.outcome,
        },
      };
    case "WINNER_DETECTED":
      // Winner can interrupt both VOTING and REVEALING phases
      if (state.phase === "REDIRECTING" || state.phase === "WINNER_REVEAL")
        return state;
      return {
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: event.completedRound,
          eliminatedMapIds: event.eliminatedMapIds,
          outcome: event.outcome,
        },
        winnerMapId: event.winnerMapId,
      };
    case "REVEAL_TIMER_ELAPSED":
      if (state.phase !== "REVEALING") return state;
      return { phase: "VOTING" };
    case "WINNER_REVEAL_ELAPSED":
      if (state.phase !== "WINNER_REVEAL") return state;
      return { ...state, phase: "REDIRECTING" };
    default:
      return state;
  }
}

/** Returns IDs of maps eliminated (banned) in the given round. */
function getEliminatedMapIds(
  maps: ReadonlyArray<{ _id: Id<"sessionMaps">; state: string; bannedAtRound?: number }>,
  round: number
): Id<"sessionMaps">[] {
  return maps
    .filter((m) => m.state === "BANNED" && m.bannedAtRound === round)
    .map((m) => m._id);
}

// ============================================================================
// Hook
// ============================================================================

export interface RevealPhaseResult {
  phaseState: PhaseState;
  isRevealPhase: boolean;
  isWinnerReveal: boolean;
  isAnyReveal: boolean;
  /** Reveal data from the current phase, or null if VOTING. */
  revealData: RevealData | null;
  /** Countdown milliseconds remaining in the reveal timer. */
  remainingMs: number;
}

export function useRevealPhase(params: {
  currentRound: number | undefined;
  sessionStatus: string | undefined;
  maps: ReadonlyArray<{ _id: Id<"sessionMaps">; state: string; bannedAtRound?: number }>;
  sessionWinnerMapId: Id<"sessionMaps"> | null | undefined;
  isRevoteRound: boolean;
  isMultiplayer: boolean;
  isPaused: boolean;
}): RevealPhaseResult {
  const {
    currentRound,
    sessionStatus,
    maps,
    sessionWinnerMapId,
    isRevoteRound,
    isMultiplayer,
    isPaused,
  } = params;

  const [phaseState, dispatch] = useReducer(phaseReducer, INITIAL_PHASE_STATE);

  // Track previous values for transition detection
  const previousRound = usePrevious(currentRound);
  const previousStatus = usePrevious(sessionStatus);

  // Detect multiplayer round completion (currentRound incremented)
  useEffect(() => {
    if (!isMultiplayer) return;
    if (previousRound === undefined || currentRound === undefined) return;
    if (currentRound <= previousRound) return;

    // Determine outcome: if isRevoteRound is now true, the previous round was a deadlock
    const outcome = isRevoteRound ? "REVOTE" : "ROUND_ADVANCED";

    // For REVOTE, the backend resets ALL maps back to AVAILABLE in the same
    // transaction that increments currentRound, so getEliminatedMapIds would
    // find nothing. Instead, use all AVAILABLE maps as the eliminated set
    // (they were all eliminated before being restored).
    const eliminated =
      outcome === "REVOTE"
        ? maps.filter((m) => m.state === "AVAILABLE").map((m) => m._id)
        : getEliminatedMapIds(maps, previousRound);

    dispatch({
      type: "ROUND_COMPLETED",
      completedRound: previousRound,
      eliminatedMapIds: eliminated,
      outcome,
    });
  }, [currentRound, previousRound, maps, isMultiplayer, isRevoteRound]);

  // Detect winner (session transitions from IN_PROGRESS to COMPLETE)
  useEffect(() => {
    if (!isMultiplayer) return;
    if (previousStatus !== "IN_PROGRESS" || sessionStatus !== "COMPLETE")
      return;

    if (!sessionWinnerMapId) return;

    // Find maps eliminated in the final round
    const completedRound = previousRound ?? currentRound ?? 1;
    const eliminated = getEliminatedMapIds(maps, completedRound);

    // Determine if this was a random winner.
    // In a RANDOM_WINNER resolution the server bans all maps then promotes
    // one back to WINNER state. That winner map retains its bannedAtRound
    // field, whereas a normal last-map-standing winner was never banned.
    const winnerMap = maps.find((m) => m._id === sessionWinnerMapId);
    const outcome: "WINNER" | "RANDOM_WINNER" =
      winnerMap?.bannedAtRound !== undefined ? "RANDOM_WINNER" : "WINNER";

    dispatch({
      type: "WINNER_DETECTED",
      winnerMapId: sessionWinnerMapId,
      completedRound,
      eliminatedMapIds: eliminated,
      outcome,
    });
  }, [sessionStatus, previousStatus, maps, isMultiplayer, previousRound, sessionWinnerMapId, currentRound]);

  // Derived booleans
  const isRevealPhase = phaseState.phase === "REVEALING";
  const isWinnerReveal = phaseState.phase === "WINNER_REVEAL";
  const isAnyReveal = isRevealPhase || isWinnerReveal;

  // Reveal timer (3s for normal rounds, 5s for winner)
  const revealDuration =
    phaseState.phase === "WINNER_REVEAL"
      ? WINNER_REVEAL_DURATION_MS
      : REVEAL_DURATION_MS;

  const { remainingMs } = useRevealTimer(
    isAnyReveal,
    revealDuration,
    isPaused,
    () => {
      if (phaseState.phase === "WINNER_REVEAL") {
        dispatch({ type: "WINNER_REVEAL_ELAPSED" });
      } else {
        dispatch({ type: "REVEAL_TIMER_ELAPSED" });
      }
    }
  );

  // Derive revealData
  const revealData =
    phaseState.phase === "REVEALING" ||
    phaseState.phase === "WINNER_REVEAL" ||
    phaseState.phase === "REDIRECTING"
      ? phaseState.reveal
      : null;

  return {
    phaseState,
    isRevealPhase,
    isWinnerReveal,
    isAnyReveal,
    revealData,
    remainingMs,
  };
}
