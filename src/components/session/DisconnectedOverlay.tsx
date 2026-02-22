import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, WifiOff } from "lucide-react";

interface DisconnectedOverlayProps {
  status: "reconnecting" | "disconnected";
  retryAttempt: number;
  maxRetries: number;
  onRetry: () => void;
}

export function DisconnectedOverlay({
  status,
  retryAttempt,
  maxRetries,
  onRetry,
}: DisconnectedOverlayProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isReconnecting = status === "reconnecting";

  // Focus heading when overlay appears; restore focus when it dismisses
  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    headingRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  // Lock body scroll and compensate for scrollbar removal
  useEffect(() => {
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
  }, []);

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="disconnected-overlay-heading"
      aria-describedby="disconnected-overlay-description"
    >
      <Card className="max-w-md p-6 sm:p-8 text-center space-y-4 mx-4">
        {isReconnecting ? (
          <Loader2
            aria-hidden="true"
            className="h-10 w-10 sm:h-12 sm:w-12 animate-spin text-amber-500 mx-auto"
          />
        ) : (
          <WifiOff
            aria-hidden="true"
            className="h-10 w-10 sm:h-12 sm:w-12 text-destructive mx-auto"
          />
        )}
        <h2
          id="disconnected-overlay-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl sm:text-2xl font-bold outline-none"
        >
          {isReconnecting ? "Reconnecting..." : "Connection Lost"}
        </h2>
        <p
          id="disconnected-overlay-description"
          className="text-sm sm:text-base text-muted-foreground"
          aria-live="polite"
        >
          {isReconnecting
            ? `Attempt ${retryAttempt} of ${maxRetries}`
            : "Unable to reach the server. Check your internet connection."}
        </p>
        {!isReconnecting && (
          <Button onClick={onRetry} className="mt-2">
            Retry Connection
          </Button>
        )}
      </Card>
    </div>
  );
}
