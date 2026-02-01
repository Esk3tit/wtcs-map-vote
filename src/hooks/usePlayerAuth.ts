import { useState, useEffect, useRef, useCallback } from "react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
if (!CONVEX_URL || typeof CONVEX_URL !== "string" || !CONVEX_URL.includes(".cloud")) {
  throw new Error(
    "VITE_CONVEX_URL must be set and contain '.cloud' for HTTP action URL derivation"
  );
}
const SITE_URL = CONVEX_URL.replace(".cloud", ".site");

// Must match HEARTBEAT_INTERVAL_MS in convex/lib/constants.ts
const HEARTBEAT_INTERVAL_MS = 30_000;

type AuthStatus = "loading" | "authenticated" | "error";
type AuthError =
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "IP_MISMATCH"
  | "TOKEN_NOT_ACTIVATED"
  | "NETWORK_ERROR";

type ValidateTokenResponse =
  | { status: "ok" }
  | { status: "error"; error: AuthError };

type HeartbeatResponse =
  | { status: "ok" }
  | { status: "error"; error: AuthError };

interface UsePlayerAuthResult {
  status: AuthStatus;
  error: AuthError | null;
}

/**
 * Hook for player token authentication with IP locking and heartbeat.
 *
 * On mount: calls the HTTP validate-token endpoint to lock the token
 * to the client's IP. On success, starts a periodic heartbeat.
 * On error: returns the error for display via TokenErrorPage.
 */
export function usePlayerAuth(token: string): UsePlayerAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<AuthError | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Reset state when token changes
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: reset auth state synchronously when token prop changes before async validation
    setStatus("loading");
    setError(null);

    async function validateToken() {
      try {
        const res = await fetch(`${SITE_URL}/api/player/validate-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const data = (await res.json()) as ValidateTokenResponse;

        if (data.status === "ok") {
          setStatus("authenticated");
          setError(null);

          // Start heartbeat
          heartbeatRef.current = setInterval(async () => {
            if (controller.signal.aborted) return;
            if (document.visibilityState === "hidden") return;
            try {
              const hbRes = await fetch(`${SITE_URL}/api/player/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
                signal: controller.signal,
              });

              if (controller.signal.aborted) return;

              const hbData = (await hbRes.json()) as HeartbeatResponse;

              if (controller.signal.aborted) return;

              if (hbData.status === "error") {
                setStatus("error");
                setError(hbData.error);
                stopHeartbeat();
              }
            } catch {
              // Heartbeat failures are non-fatal; will retry on next interval
            }
          }, HEARTBEAT_INTERVAL_MS);
        } else {
          setStatus("error");
          setError(data.error);
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
          setError("NETWORK_ERROR");
        }
      }
    }

    validateToken();

    return () => {
      controller.abort();
      stopHeartbeat();
    };
  }, [token, stopHeartbeat]);

  return { status, error };
}
