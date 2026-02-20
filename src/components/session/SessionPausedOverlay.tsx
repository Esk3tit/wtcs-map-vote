import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function SessionPausedOverlay({ isPaused }: { isPaused: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus heading when overlay appears; restore focus when it dismisses
  useEffect(() => {
    if (isPaused) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      headingRef.current?.focus();
      return () => {
        previouslyFocused?.focus();
      };
    }
  }, [isPaused]);

  // Lock body scroll while paused
  useEffect(() => {
    if (isPaused) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isPaused]);

  if (!isPaused) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      aria-modal="true"
    >
      <Card className="max-w-md p-6 sm:p-8 text-center space-y-4 mx-4">
        <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-primary mx-auto" />
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl sm:text-2xl font-bold outline-none"
        >
          Session Paused
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Waiting for admin to resume...
        </p>
      </Card>
    </div>
  );
}
