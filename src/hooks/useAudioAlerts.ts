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
  // --------------------------------------------------------------------------
  // Turn-start chime: fires on isYourTurn false → true transition
  // --------------------------------------------------------------------------
  const prevTurnRef = useRef(isYourTurn);

  useEffect(() => {
    const wasMyTurn = prevTurnRef.current;
    prevTurnRef.current = isYourTurn;

    // Only fire on false → true transition (not on initial mount if already true)
    if (isYourTurn && !wasMyTurn && !isPaused && !isOverlayVisible) {
      audioManager.play("turn-start");
    }
  }, [isYourTurn, isPaused, isOverlayVisible]);

  // --------------------------------------------------------------------------
  // Timer warning beep (5s) and timeout buzzer (0s)
  // --------------------------------------------------------------------------
  const turnKey = `${currentTurn}-${currentRound}`;
  const hasWarnedRef = useRef<string | null>(null);
  const hasBuzzedRef = useRef<string | null>(null);

  // Reset flags when turn changes
  useEffect(() => {
    hasWarnedRef.current = null;
    hasBuzzedRef.current = null;
  }, [turnKey]);

  useEffect(() => {
    // Don't poll when timer isn't active
    if (!timerStartedAt || isPaused || timerPausedAt !== undefined) return;

    const checkTimer = () => {
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

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt, timerPausedAt, isPaused, turnTimerSeconds, turnKey]);

  // --------------------------------------------------------------------------
  // Map-banned sound: fires once when phase transitions to REVEALING
  // --------------------------------------------------------------------------
  const prevPhase = usePrevious(phaseState.phase);

  useEffect(() => {
    if (phaseState.phase === "REVEALING" && prevPhase !== "REVEALING") {
      audioManager.play("map-banned");
    }
  }, [phaseState.phase, prevPhase]);

  // --------------------------------------------------------------------------
  // Winner fanfare: fires once when phase transitions to WINNER_REVEAL
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phaseState.phase === "WINNER_REVEAL" && prevPhase !== "WINNER_REVEAL") {
      audioManager.play("winner-fanfare");
    }
  }, [phaseState.phase, prevPhase]);
}
