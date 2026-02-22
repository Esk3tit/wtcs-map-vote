import { useState, useEffect, useRef, useCallback } from "react";
import { SITE_URL } from "@/lib/convexHttp";
import { HEARTBEAT_INTERVAL_MS } from "../../convex/lib/constants";

/** Consecutive heartbeat failures before transitioning to "error". */
const MAX_MISSED_HEARTBEATS = 2;

type AuthStatus = "loading" | "authenticated" | "reconnecting" | "error";
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
 *
 * Connection status states:
 * - "loading" → initial token validation in progress
 * - "authenticated" → connected and heartbeat is healthy
 * - "reconnecting" → 1 missed heartbeat, retrying
 * - "error" → 2+ missed heartbeats or server-side auth error
 */
export function usePlayerAuth(token: string): UsePlayerAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<AuthError | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const missedHeartbeatsRef = useRef(0);

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
    missedHeartbeatsRef.current = 0;

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setStatus("error");
      setError("INVALID_TOKEN");
      return () => {
        controller.abort();
        stopHeartbeat();
      };
    }

    async function validateToken() {
      try {
        const res = await fetch(`${SITE_URL}/api/player/validate-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: normalizedToken }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const data = (await res.json()) as ValidateTokenResponse;

        if (controller.signal.aborted) return;

        if (data.status === "ok") {
          stopHeartbeat();
          setStatus("authenticated");
          setError(null);
          missedHeartbeatsRef.current = 0;

          // Start heartbeat
          heartbeatRef.current = setInterval(async () => {
            if (controller.signal.aborted) return;
            try {
              const hbRes = await fetch(`${SITE_URL}/api/player/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: normalizedToken }),
                signal: controller.signal,
              });

              if (controller.signal.aborted) return;

              const hbData = (await hbRes.json()) as HeartbeatResponse;

              if (controller.signal.aborted) return;

              if (hbData.status === "error") {
                // Server-side auth error (token expired, IP mismatch, etc.)
                setStatus("error");
                setError(hbData.error);
                stopHeartbeat();
              } else {
                // Heartbeat success — reset missed counter and restore status
                missedHeartbeatsRef.current = 0;
                setStatus("authenticated");
                setError(null);
              }
            } catch {
              if (controller.signal.aborted) return;

              // Network failure — track consecutive misses
              missedHeartbeatsRef.current += 1;
              if (missedHeartbeatsRef.current >= MAX_MISSED_HEARTBEATS) {
                setStatus("error");
                setError("NETWORK_ERROR");
                stopHeartbeat();
              } else {
                setStatus("reconnecting");
              }
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
