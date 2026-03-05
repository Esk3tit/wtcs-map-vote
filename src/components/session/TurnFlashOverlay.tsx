import { useEffect, useRef, useState } from "react";

interface TurnFlashOverlayProps {
  /** Whether it is currently this player's turn */
  isYourTurn: boolean;
  /** Current turn number (needed to detect ABBA consecutive turns) */
  currentTurn: number;
  /** Suppress the flash (e.g. when DisconnectedOverlay is visible) */
  isSuppressed: boolean;
}

/**
 * Full-viewport border glow that fires once when it becomes your turn.
 * Tracks both isYourTurn and currentTurn to handle ABBA consecutive turns
 * (where isYourTurn stays true across back-to-back turns for the same player).
 * Non-blocking (pointer-events: none) and respects prefers-reduced-motion.
 */
export function TurnFlashOverlay({
  isYourTurn,
  currentTurn,
  isSuppressed,
}: TurnFlashOverlayProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevState = useRef({ isYourTurn, currentTurn });

  useEffect(() => {
    const prev = prevState.current;
    prevState.current = { isYourTurn, currentTurn };

    // Skip if nothing actually changed (prevents firing on isSuppressed changes)
    if (prev.isYourTurn === isYourTurn && prev.currentTurn === currentTurn) return;

    if (isYourTurn && !isSuppressed) {
      setIsFlashing(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isYourTurn, currentTurn, isSuppressed]);

  // Fallback cleanup: onAnimationEnd won't fire when prefers-reduced-motion
  // suppresses the animation class. This timer guarantees unmount.
  // 750ms = 700ms CSS animation + 50ms buffer
  useEffect(() => {
    if (!isFlashing) return;
    const id = window.setTimeout(() => setIsFlashing(false), 750);
    return () => window.clearTimeout(id);
  }, [isFlashing]);

  if (!isFlashing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 select-none motion-safe:animate-border-flash motion-reduce:hidden"
      style={{
        boxShadow:
          "inset 0 0 40px 15px rgba(34, 197, 94, 0.5), inset 0 0 80px 30px rgba(34, 197, 94, 0.2), inset 0 0 120px 40px rgba(34, 197, 94, 0.1)",
      }}
      onAnimationEnd={() => setIsFlashing(false)}
      aria-hidden="true"
    />
  );
}
