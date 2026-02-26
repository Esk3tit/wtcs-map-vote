import { useEffect, useRef } from "react";
import { audioManager } from "@/lib/audio";
import { calculateRemainingTime } from "@/lib/timer";
import { usePrevious } from "@/hooks/usePrevious";
import type { PhaseState } from "@/hooks/useRevealPhase";

// ============================================================================
// Types
// ============================================================================

export interface UseAudioAlertsOptions {
  /** Whether it is currently this player's turn */
  isYourTurn: boolean;
  /** Whether the session is paused */
  isPaused: boolean;
  /** Whether the disconnected overlay is visible */
  isOverlayVisible: boolean;
  /** Turn timer duration in seconds */
  turnTimerSeconds: number;
  /** Server timestamp when timer started */
  timerStartedAt: number | undefined;
  /** Server timestamp when timer was paused */
  timerPausedAt: number | undefined;
  /** Current turn number (ABBA) */
  currentTurn: number;
  /** Current round number (MULTIPLAYER) */
  currentRound: number;
  /** Reveal phase state from useRevealPhase (MULTIPLAYER) */
  phaseState: PhaseState;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Triggers audio alerts based on voting session state changes.
 *
 * Handles: turn-start chime, timer warning beep (5s), timeout buzzer (0s),
 * map-banned sound (REVEALING phase), and winner fanfare (WINNER_REVEAL phase).
 */
export function useAudioAlerts({
  isYourTurn,
  isPaused,
  isOverlayVisible,
  turnTimerSeconds,
  timerStartedAt,
  timerPausedAt,
  currentTurn,
  currentRound,
  phaseState,
}: UseAudioAlertsOptions): void {
  // Suppression strategy: isInitialMount prevents false-positive sounds on
  // page load / reconnect. Phase-change and timer-warning sounds check
  // isInitialMount; turn-start uses sentinel initial values so the chime
  // plays on the first turn of a new session (and on page reload, which is
  // acceptable — it reminds the player to act).
  const isInitialMount = useRef(true);

  // --------------------------------------------------------------------------
  // Turn-start chime: fires when it becomes your turn.
  // Watches both isYourTurn AND currentTurn to handle ABBA consecutive turns
  // (e.g. A,B,B,A,A — where isYourTurn stays true across turns 4→5).
  // Sentinel initial values ensure the chime fires on the very first turn
  // regardless of whether Convex data is cached (instant) or fetched (async).
  // --------------------------------------------------------------------------
  const prevTurnState = useRef({ isYourTurn: false, currentTurn: 0 });

  useEffect(() => {
    const prev = prevTurnState.current;
    prevTurnState.current = { isYourTurn, currentTurn };

    // No change in turn state — skip (also prevents firing on isPaused/overlay changes)
    if (prev.isYourTurn === isYourTurn && prev.currentTurn === currentTurn) return;

    if (isYourTurn && !isPaused && !isOverlayVisible) {
      audioManager.play("turn-start");
    }
  }, [isYourTurn, currentTurn, isPaused, isOverlayVisible]);

  // --------------------------------------------------------------------------
  // Timer warning beep (5s) and timeout buzzer (0s)
  //
  // NOTE: This interval intentionally duplicates the countdown calculation from
  // CountdownTimer. Coupling them would add complexity for negligible perf gain.
  // --------------------------------------------------------------------------
  const turnKey = `${currentTurn}-${currentRound}`;
  const hasWarnedRef = useRef<string | null>(null);
  const hasBuzzedRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset once-per-turn flags at the start of each timer cycle
    hasWarnedRef.current = null;
    hasBuzzedRef.current = null;

    // Don't poll when timer isn't active
    if (!timerStartedAt || isPaused || timerPausedAt !== undefined) return;

    const checkTimer = () => {
      // Skip on initial mount to avoid beeping on reconnect when < 5s remain
      if (isInitialMount.current) return;
      // Skip if tab is hidden — don't fire retroactively
      if (document.visibilityState === "hidden") return;

      const remaining = calculateRemainingTime(
        turnTimerSeconds,
        timerStartedAt,
        timerPausedAt
      );

      // Warning beep at 5s (once per turn)
      if (remaining <= 5 && remaining > 0 && hasWarnedRef.current !== turnKey) {
        hasWarnedRef.current = turnKey;
        audioManager.play("timer-warning");
      }

      // Timeout buzzer at 0s (once per turn)
      if (remaining <= 0 && hasBuzzedRef.current !== turnKey) {
        hasBuzzedRef.current = turnKey;
        audioManager.play("timeout-buzzer");
      }
    };

    // Check immediately in case we're already past a threshold
    checkTimer();

    const interval = setInterval(checkTimer, 500);
    return () => {
      clearInterval(interval);
      // Final check: catch the buzzer before the turn changes. Without this,
      // the server can process a timeout and update timerStartedAt (triggering
      // effect re-run) before the interval catches remaining=0.
      checkTimer();
    };
  }, [timerStartedAt, timerPausedAt, isPaused, turnTimerSeconds, turnKey]);

  // --------------------------------------------------------------------------
  // Map-banned sound: fires once when phase transitions to REVEALING
  // Winner fanfare: fires once when phase transitions to WINNER_REVEAL
  //
  // Skip the first render to prevent sounds firing when a user loads the page
  // during an in-progress REVEALING or WINNER_REVEAL phase. On initial mount,
  // usePrevious returns undefined, so the "prevPhase !== X" check would
  // incorrectly evaluate to true. This effect also clears isInitialMount for
  // all other effects.
  // --------------------------------------------------------------------------
  const prevPhase = usePrevious(phaseState.phase);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (phaseState.phase === "REVEALING" && prevPhase !== "REVEALING") {
      audioManager.play("map-banned");
    }

    if (phaseState.phase === "WINNER_REVEAL" && prevPhase !== "WINNER_REVEAL") {
      audioManager.play("winner-fanfare");
    }
  }, [phaseState.phase, prevPhase]);
}
