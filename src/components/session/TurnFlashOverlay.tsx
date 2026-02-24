import { useCallback, useEffect, useRef, useState } from "react";

interface TurnFlashOverlayProps {
  /** Whether it is currently this player's turn */
  isYourTurn: boolean;
  /** Suppress the flash (e.g. when DisconnectedOverlay is visible) */
  isSuppressed: boolean;
}

/**
 * Full-viewport border glow that fires once when isYourTurn transitions
 * from false to true. Non-blocking (pointer-events: none) and respects
 * prefers-reduced-motion via Tailwind's motion-safe variant.
 */
export function TurnFlashOverlay({
  isYourTurn,
  isSuppressed,
}: TurnFlashOverlayProps) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevTurnRef = useRef(isYourTurn);

  useEffect(() => {
    if (isYourTurn && !prevTurnRef.current && !isSuppressed) {
      setIsFlashing(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
    prevTurnRef.current = isYourTurn;
  }, [isYourTurn, isSuppressed]);

  // Fallback cleanup: onAnimationEnd won't fire when prefers-reduced-motion
  // suppresses the animation class. This timer guarantees unmount.
  useEffect(() => {
    if (!isFlashing) return;
    const id = window.setTimeout(() => setIsFlashing(false), 750);
    return () => window.clearTimeout(id);
  }, [isFlashing]);

  const handleAnimationEnd = useCallback(() => {
    setIsFlashing(false);
  }, []);

  if (!isFlashing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 select-none motion-safe:animate-border-flash motion-reduce:hidden"
      style={{
        boxShadow:
          "inset 0 0 40px 15px rgba(34, 197, 94, 0.5), inset 0 0 80px 30px rgba(34, 197, 94, 0.2), inset 0 0 120px 40px rgba(34, 197, 94, 0.1)",
      }}
      onAnimationEnd={handleAnimationEnd}
      aria-hidden="true"
    />
  );
}
