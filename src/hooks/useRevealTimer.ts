import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  const [generation, setGeneration] = useState(0);
  const prevActiveRef = useRef(false);
  useEffect(() => {
    if (isActive && !prevActiveRef.current) {
      setGeneration((g) => g + 1);
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  // Visual countdown state
  const [remainingMs, setRemainingMs] = useState(durationMs);

  // Reset remaining when generation changes (new reveal started)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setRemainingMs(durationMs), [generation, durationMs]);

  // Track accumulated elapsed time across pause/resume cycles
  const elapsedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);

  // Reset elapsed time when generation changes
  useEffect(() => {
    elapsedRef.current = 0;
    segmentStartRef.current = null;
  }, [generation]);

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
