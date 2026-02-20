import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function SessionPausedOverlay({ isPaused }: { isPaused: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading when overlay appears; restore focus when it dismisses
  useEffect(() => {
    if (isPaused) {
      const previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      headingRef.current?.focus();
      return () => {
        previouslyFocused?.focus();
      };
    }
  }, [isPaused]);

  // Lock body scroll and compensate for scrollbar removal while paused
  useEffect(() => {
    if (isPaused) {
      const scrollbarWidth = Math.max(
        0,
        window.innerWidth - document.documentElement.clientWidth,
      );
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isPaused]);

  if (!isPaused) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paused-overlay-heading"
      aria-describedby="paused-overlay-description"
    >
      <Card className="max-w-md p-6 sm:p-8 text-center space-y-4 mx-4">
        <Loader2 aria-hidden="true" className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mx-auto" />
        <h2
          id="paused-overlay-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl sm:text-2xl font-bold outline-none"
        >
          Session Paused
        </h2>
        <p id="paused-overlay-description" className="text-sm sm:text-base text-muted-foreground">
          Waiting for admin to resume...
        </p>
      </Card>
    </div>
  );
}
