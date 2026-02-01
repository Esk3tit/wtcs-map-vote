import { useState, useEffect, useRef, useCallback } from "react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const SITE_URL = CONVEX_URL.replace(".cloud", ".site");
const HEARTBEAT_INTERVAL_MS = 30_000;

type AuthStatus = "loading" | "authenticated" | "error";
type AuthError =
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_ACTIVE"
  | "IP_MISMATCH"
  | "NETWORK_ERROR";

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
    let cancelled = false;

    async function validateToken() {
      try {
        const res = await fetch(`${SITE_URL}/api/player/validate-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (cancelled) return;

        const data = await res.json();

        if (data.status === "ok") {
          setStatus("authenticated");
          setError(null);

          // Start heartbeat
          heartbeatRef.current = setInterval(async () => {
            try {
              const hbRes = await fetch(`${SITE_URL}/api/player/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              });

              const hbData = await hbRes.json();
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
        if (!cancelled) {
          setStatus("error");
          setError("NETWORK_ERROR");
        }
      }
    }

    validateToken();

    return () => {
      cancelled = true;
      stopHeartbeat();
    };
  }, [token, stopHeartbeat]);

  return { status, error };
}
