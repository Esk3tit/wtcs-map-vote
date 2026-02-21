import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Manages a timed reveal phase with pause support.
 * Counts down from durationMs and calls onComplete when elapsed.
 * Pauses when isPaused is true and resumes from the remaining time.
 *
 * @param isActive - Whether the reveal timer should be running
 * @param durationMs - Total duration in milliseconds
 * @param isPaused - Whether the session is paused (freezes the timer)
 * @param onComplete - Callback when the timer elapses
 */
export function useRevealTimer(
  isActive: boolean,
  durationMs: number,
  isPaused: boolean,
  onComplete: () => void
): { remainingMs: number } {
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Generation counter increments each time isActive transitions to true.
  // This resets the timer for each new reveal without accessing refs during render.
  // setState here is intentional — we detect edge transitions to trigger resets.
  const [generation, setGeneration] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setGeneration((g) => g + 1); // eslint-disable-line react-hooks/set-state-in-effect
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  // Visual countdown state
  const [remainingMs, setRemainingMs] = useState(durationMs);

  // Track accumulated elapsed time across pause/resume cycles
  const elapsedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);

  // Reset timer state when generation or durationMs changes.
  // Merging elapsed ref reset here avoids a race condition between
  // separate effects that could leave stale elapsed time.
  // setState here is intentional — we synchronize remainingMs with external
  // inputs (generation/durationMs) that cannot be derived during render.
  useEffect(() => {
    setRemainingMs(durationMs); // eslint-disable-line react-hooks/set-state-in-effect
    elapsedRef.current = 0;
    segmentStartRef.current = null;
  }, [generation, durationMs]);

  const timerCallback = useCallback(() => {
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    if (!isActive || isPaused) {
      // Snapshot elapsed time when pausing
      if (segmentStartRef.current !== null) {
        elapsedRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
      return;
    }

    // Start a new countdown segment
    segmentStartRef.current = Date.now();
    const segmentRemaining = Math.max(0, durationMs - elapsedRef.current);

    if (segmentRemaining <= 0) {
      timerCallback();
      return;
    }

    // Visual tick for countdown display
    const tickInterval = setInterval(() => {
      if (segmentStartRef.current === null) return;
      const segmentElapsed = Date.now() - segmentStartRef.current;
      const totalElapsed = elapsedRef.current + segmentElapsed;
      setRemainingMs(Math.max(0, durationMs - totalElapsed));
    }, 100);

    // Auto-advance timeout
    const timeoutId = setTimeout(timerCallback, segmentRemaining);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(tickInterval);
      if (segmentStartRef.current !== null) {
        elapsedRef.current += Date.now() - segmentStartRef.current;
        segmentStartRef.current = null;
      }
    };
  }, [isActive, isPaused, durationMs, timerCallback, generation]);

  return { remainingMs: isActive ? remainingMs : durationMs };
}
