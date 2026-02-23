import { useState, useEffect, useRef, useCallback } from "react";
import { SITE_URL } from "@/lib/convexHttp";
import { HEARTBEAT_INTERVAL_MS } from "../../convex/lib/constants";
import type { ConnectionStatus } from "../../convex/lib/connectionStatus";

// Retry with exponential backoff: 2s, 4s, 8s, 16s delays + 8s fetch timeout per attempt
// Worst-case ~62s total — may exceed 60s server heartbeat window on final attempt
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000] as const;
const MAX_RETRIES = RETRY_DELAYS_MS.length;
/** Timeout per heartbeat/retry fetch to keep timing predictable. */
const HEARTBEAT_FETCH_TIMEOUT_MS = 8_000;
/** Minimum interval between heartbeat attempts (visibility handler debounce). */
const ATTEMPT_DEBOUNCE_MS = 2_000;

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "reconnecting"
  | "disconnected"
  | "error";

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

export interface UsePlayerAuthResult {
  status: AuthStatus;
  error: AuthError | null;
  /** Trigger manual reconnection (full token re-validation). Useful when disconnected or when error is NETWORK_ERROR. */
  retry: () => void;
  /** Current retry attempt (0 = not retrying, 1–4 during backoff). */
  retryAttempt: number;
  /** Maximum number of retry attempts before giving up. */
  maxRetries: number;
  /** Whether the overlay should be shown (reconnecting or disconnected). */
  isOverlayVisible: boolean;
  /** Whether the Convex subscription should remain active. */
  isSubscriptionActive: boolean;
  /** Derived connection status for display components. */
  connectionStatus: ConnectionStatus;
}

/**
 * Hook for player token authentication with IP locking, heartbeat, and reconnection.
 *
 * On mount: calls the HTTP validate-token endpoint to lock the token
 * to the client's IP. On success, starts a periodic heartbeat.
 * On heartbeat network failure: retries with exponential backoff (2s, 4s, 8s, 16s).
 * If all retries fail: transitions to "disconnected" with manual retry option.
 * On server auth error: transitions to "error" (permanent, no retry).
 *
 * Connection status states:
 * - "loading" → initial token validation in progress
 * - "authenticated" → connected and heartbeat is healthy
 * - "reconnecting" → heartbeat failed, auto-retrying with backoff
 * - "disconnected" → all retries exhausted, manual retry required
 * - "error" → permanent server auth error (IP_MISMATCH, TOKEN_EXPIRED, etc.)
 */
export function usePlayerAuth(token: string): UsePlayerAuthResult {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<AuthError | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  // Incrementing retryTrigger re-runs the effect (full token re-validation)
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Ref to track current status for visibility handler (avoids stale closure)
  const statusRef = useRef<AuthStatus>("loading");

  // Timer refs
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAttemptRef = useRef(0);
  const generationRef = useRef(0);

  const retry = useCallback(() => {
    setRetryTrigger((c) => c + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    // Increment generation to invalidate any in-flight callbacks from previous effect runs
    const generation = ++generationRef.current;

    // Reset state when token changes or manual retry triggers
    /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset auth state synchronously when token/retryTrigger changes before async validation begins */
    updateStatus("loading");
    setError(null);
    setRetryAttempt(0);
    /* eslint-enable react-hooks/set-state-in-effect */

    // ================================================================
    // Timer helpers (scoped to this effect instance)
    // ================================================================

    function stopNormalHeartbeat() {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }

    function clearRetryTimeout() {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    }

    function stopAll() {
      stopNormalHeartbeat();
      clearRetryTimeout();
    }

    /** Update status both as React state and synchronously in ref (for event handlers). */
    function updateStatus(newStatus: AuthStatus) {
      statusRef.current = newStatus;
      setStatus(newStatus);
    }

    /** Create an AbortSignal that aborts when either the effect controller or a timeout fires. */
    function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      const onAbort = () => timeoutController.abort();
      controller.signal.addEventListener("abort", onAbort);
      return {
        signal: timeoutController.signal,
        cleanup: () => {
          clearTimeout(timeoutId);
          controller.signal.removeEventListener("abort", onAbort);
        },
      };
    }

    // ================================================================
    // Early exit for empty token
    // ================================================================

    const normalizedToken = token.trim();
    if (!normalizedToken) {
      updateStatus("error");
      setError("INVALID_TOKEN");
      return () => {
        controller.abort();
        stopAll();
      };
    }

    // ================================================================
    // Heartbeat sender (bounded by HEARTBEAT_FETCH_TIMEOUT_MS)
    // ================================================================

    type HeartbeatResult =
      | { kind: "ok" }
      | { kind: "auth_error"; error: AuthError }
      | { kind: "network_error" };

    async function sendHeartbeat(): Promise<HeartbeatResult> {
      const { signal, cleanup } = createTimeoutSignal(HEARTBEAT_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${SITE_URL}/api/player/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: normalizedToken }),
          signal,
        });

        if (controller.signal.aborted) return { kind: "network_error" };

        const data = (await res.json()) as HeartbeatResponse;

        if (controller.signal.aborted) return { kind: "network_error" };

        if (data.status === "error") {
          return { kind: "auth_error", error: data.error };
        }
        return { kind: "ok" };
      } catch {
        return { kind: "network_error" };
      } finally {
        cleanup();
      }
    }

    // ================================================================
    // Two-mode heartbeat system
    // ================================================================

    // --- Normal mode: 30s interval ---
    function startNormalHeartbeat() {
      stopAll();
      const gen = generation; // capture for closure
      heartbeatRef.current = setInterval(async () => {
        if (controller.signal.aborted || gen !== generationRef.current) return;
        lastAttemptRef.current = Date.now();
        const r = await sendHeartbeat();
        if (controller.signal.aborted || gen !== generationRef.current) return;

        if (r.kind === "ok") {
          updateStatus("authenticated");
          setError(null);
        } else if (r.kind === "auth_error") {
          updateStatus("error");
          setError(r.error);
          stopAll();
        } else {
          // Network error → switch to retry mode
          stopNormalHeartbeat();
          startRetrySequence(0);
        }
      }, HEARTBEAT_INTERVAL_MS);
    }

    // --- Retry mode: chained setTimeout with backoff ---
    function startRetrySequence(attempt: number) {
      if (controller.signal.aborted || generation !== generationRef.current)
        return;

      if (attempt >= MAX_RETRIES) {
        updateStatus("disconnected");
        setError("NETWORK_ERROR");
        setRetryAttempt(MAX_RETRIES);
        return;
      }

      updateStatus("reconnecting");
      setRetryAttempt(attempt + 1);

      retryTimeoutRef.current = setTimeout(async () => {
        if (controller.signal.aborted || generation !== generationRef.current)
          return;
        lastAttemptRef.current = Date.now();
        const r = await sendHeartbeat();
        if (controller.signal.aborted || generation !== generationRef.current)
          return;

        if (r.kind === "ok") {
          updateStatus("authenticated");
          setError(null);
          setRetryAttempt(0);
          startNormalHeartbeat();
        } else if (r.kind === "auth_error") {
          updateStatus("error");
          setError(r.error);
          stopAll();
        } else {
          startRetrySequence(attempt + 1);
        }
      }, RETRY_DELAYS_MS[attempt]);
    }

    // --- Immediate attempt (visibility handler) ---
    async function attemptImmediateHeartbeat() {
      if (controller.signal.aborted || generation !== generationRef.current)
        return;
      lastAttemptRef.current = Date.now();
      stopAll();
      const r = await sendHeartbeat();
      if (controller.signal.aborted || generation !== generationRef.current)
        return;

      if (r.kind === "ok") {
        updateStatus("authenticated");
        setError(null);
        setRetryAttempt(0);
        startNormalHeartbeat();
      } else if (r.kind === "auth_error") {
        updateStatus("error");
        setError(r.error);
      } else {
        // Failed → start retry from attempt 0
        startRetrySequence(0);
      }
    }

    // ================================================================
    // Tab visibility handler
    // ================================================================

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const currentStatus = statusRef.current;
      // Only act when authenticated or reconnecting
      if (currentStatus !== "authenticated" && currentStatus !== "reconnecting")
        return;
      // Debounce: skip if we attempted recently
      if (Date.now() - lastAttemptRef.current < ATTEMPT_DEBOUNCE_MS) return;
      clearRetryTimeout();
      stopNormalHeartbeat();
      attemptImmediateHeartbeat();
    }

    // iOS Safari bfcache recovery
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        handleVisibilityChange();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    // ================================================================
    // Initial token validation
    // ================================================================

    async function validateToken() {
      const { signal, cleanup } = createTimeoutSignal(HEARTBEAT_FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${SITE_URL}/api/player/validate-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: normalizedToken }),
          signal,
        });

        if (controller.signal.aborted) return;

        const data = (await res.json()) as ValidateTokenResponse;

        if (controller.signal.aborted) return;

        if (data.status === "ok") {
          updateStatus("authenticated");
          setError(null);
          setRetryAttempt(0);
          startNormalHeartbeat();
        } else {
          updateStatus("error");
          setError(data.error);
        }
      } catch {
        if (!controller.signal.aborted) {
          updateStatus("error");
          setError("NETWORK_ERROR");
        }
      } finally {
        cleanup();
      }
    }

    // Debounce-protect against visibility handler firing during initial validation
    lastAttemptRef.current = Date.now();
    validateToken();

    // ================================================================
    // Cleanup
    // ================================================================

    return () => {
      controller.abort();
      stopAll();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [token, retryTrigger]);

  const isOverlayVisible = status === "reconnecting" || status === "disconnected";
  const isSubscriptionActive = status === "authenticated" || status === "reconnecting" || status === "disconnected";
  // "loading" and "error" fall through to "disconnected" — safe because consumers
  // early-return before rendering ConnectionStatusBadge in those states.
  const connectionStatus: ConnectionStatus =
    status === "authenticated"
      ? "connected"
      : status === "reconnecting"
        ? "reconnecting"
        : "disconnected";

  return {
    status, error, retry, retryAttempt, maxRetries: MAX_RETRIES,
    isOverlayVisible,
    isSubscriptionActive,
    connectionStatus,
  };
}
