import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Helper function to calculate remaining time from server timestamp.
// When paused, freezes elapsed time at the pause moment instead of using Date.now().
// Handles timerStartedAt being in the future (MULTIPLAYER reveal offset).
function calculateRemainingTime(
  turnTimerSeconds: number,
  timerStartedAt: number | undefined,
  timerPausedAt: number | undefined
): number {
  if (!timerStartedAt) return turnTimerSeconds;
  const now = timerPausedAt ?? Date.now();
  // Clamp: if timer hasn't started yet (future timerStartedAt from reveal offset),
  // show full duration instead of inflated time from negative elapsed
  if (timerStartedAt > now) return turnTimerSeconds;
  const elapsed = Math.floor((now - timerStartedAt) / 1000);
  return Math.max(0, turnTimerSeconds - elapsed);
}

// Separate Timer component that calculates remaining time from server timestamp.
// Displays M:SS format with warning colors at 10s (amber) and 5s (red + pulse).
export function CountdownTimer({
  turnTimerSeconds,
  timerStartedAt,
  timerPausedAt,
  isActive,
}: {
  turnTimerSeconds: number;
  timerStartedAt: number | undefined;
  timerPausedAt: number | undefined;
  isActive: boolean;
}) {
  const [remaining, setRemaining] = useState(() =>
    calculateRemainingTime(turnTimerSeconds, timerStartedAt, timerPausedAt)
  );

  // Recalculate when server state changes (new turn, pause, resume)
  useEffect(() => {
    setRemaining(
      calculateRemainingTime(turnTimerSeconds, timerStartedAt, timerPausedAt)
    );
  }, [turnTimerSeconds, timerStartedAt, timerPausedAt]);

  // Tick interval — only when active, not paused, and timer started
  useEffect(() => {
    if (!isActive || !timerStartedAt || timerPausedAt !== undefined) return;

    const timer = setInterval(() => {
      const next = calculateRemainingTime(
        turnTimerSeconds,
        timerStartedAt,
        timerPausedAt
      );
      setRemaining(next);
      if (next <= 0) clearInterval(timer);
    }, 1000);

    // Force immediate recalculation when tab becomes visible again,
    // instead of waiting up to 1s for the next interval tick.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const next = calculateRemainingTime(
          turnTimerSeconds,
          timerStartedAt,
          timerPausedAt
        );
        setRemaining(next);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, timerStartedAt, timerPausedAt, turnTimerSeconds]);

  // Show placeholder when timer hasn't started
  if (!timerStartedAt) {
    return <span>--:--</span>;
  }

  // Format as M:SS (max timer is 1200s = 20:00)
  const mins = Math.floor(remaining / 60);
  const secs = String(remaining % 60).padStart(2, "0");

  return (
    <span
      className={cn(
        remaining <= 5 && "text-red-500 animate-pulse",
        remaining > 5 && remaining <= 10 && "text-amber-500"
      )}
      role="timer"
      aria-label={
        mins > 0
          ? `${mins} minute${mins !== 1 ? "s" : ""} ${remaining % 60} second${remaining % 60 !== 1 ? "s" : ""} remaining`
          : `${remaining} second${remaining !== 1 ? "s" : ""} remaining`
      }
    >
      {mins}:{secs}
    </span>
  );
}
