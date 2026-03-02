/**
 * Wide Event Logging Module
 *
 * Implements the canonical log line / wide event pattern. Instead of scattering
 * many small console.log calls, build a single context-rich JSON event per
 * function invocation and emit it once at completion.
 *
 * Usage:
 *   const ev = createWideEvent("voting", "submitBan", "internalMutation");
 *   ev.setPlayer(token, player);
 *   ev.setSession(session);
 *   ev.set("mapsRemaining", 5);
 *   ev.setOutcome("ok");
 *   ev.setDuration(startTime);
 *   ev.emit();
 *
 * @see https://loggingsucks.com/
 * @see https://boristane.com/blog/observability-wide-events-101/
 */

import type { Doc } from "../_generated/dataModel";

// ============================================================================
// Types
// ============================================================================

/** Function types that can emit wide events. */
export type FnType =
  | "mutation"
  | "internalMutation"
  | "action"
  | "internalAction"
  | "httpAction";

/** Outcome of a function invocation. */
export type Outcome = "ok" | "error" | "noop";

/** Distinguishes returned errors from thrown exceptions. */
export type ErrorType = "business" | "system";

// Maximum safe payload size in bytes (Convex truncates at 4 KiB)
const MAX_PAYLOAD_BYTES = 3584; // 3.5 KiB

// ============================================================================
// WideEvent Class
// ============================================================================

/**
 * Accumulates context throughout a handler and emits a single structured
 * JSON event via console.log. Calling emit() never throws.
 */
export class WideEvent {
  private fields: Record<string, unknown>;

  constructor(module: string, fn: string, fnType: FnType) {
    this.fields = {
      _event: "wide_event",
      fn: `${module}.${fn}`,
      fnType,
      ts: Date.now(),
    };
  }

  /** Set an arbitrary key-value pair on the event. */
  set(key: string, value: unknown): void {
    this.fields[key] = value;
  }

  // --------------------------------------------------------------------------
  // Domain Helpers
  // --------------------------------------------------------------------------

  /** Add admin actor context. Logs doc ID and email domain only. */
  setAdmin(admin: Doc<"admins"> | null | undefined): void {
    if (!admin) return;
    this.fields.adminId = admin._id;
    const domain = admin.email?.split("@")[1];
    if (domain) this.fields.adminDomain = domain;
  }

  /**
   * Add player actor context. Token is truncated to first 8 chars.
   *
   * @param token - Raw player token (will be truncated)
   * @param player - Player document
   */
  setPlayer(
    token: string | null | undefined,
    player: Doc<"sessionPlayers"> | null | undefined
  ): void {
    if (token) this.fields.tokenPrefix = token.slice(0, 8);
    if (!player) return;
    this.fields.playerId = player._id;
    if (player.teamName) this.fields.teamName = player.teamName;
  }

  /** Add session context fields. */
  setSession(session: Doc<"sessions"> | null | undefined): void {
    if (!session) return;
    this.fields.sessionId = session._id;
    this.fields.format = session.format;
    this.fields.sessionStatus = session.status;
    this.fields.currentTurn = session.currentTurn;
    this.fields.currentRound = session.currentRound;
  }

  /** Add target map context. */
  setMap(map: { _id?: unknown; name?: string } | null | undefined): void {
    if (!map) return;
    if (map._id) this.fields.mapId = map._id;
    if (map.name) this.fields.mapName = map.name;
  }

  /**
   * Add client IP context. Truncated to first 2 octets for privacy.
   * Example: "192.168.1.1" → "192.168"
   */
  setIp(ip: string | null | undefined): void {
    if (!ip) return;
    const parts = ip.split(".");
    this.fields.ip =
      parts.length === 4 ? `${parts[0]}.${parts[1]}` : "non-ipv4";
  }

  // --------------------------------------------------------------------------
  // Outcome & Error Helpers
  // --------------------------------------------------------------------------

  /** Set the function outcome. */
  setOutcome(outcome: Outcome): void {
    this.fields.outcome = outcome;
  }

  /** Set error outcome and code for returned (non-thrown) errors. */
  returnError(code: string): void {
    this.fields.outcome = "error";
    this.fields.error = code;
    this.fields.errorType = "business";
  }

  /**
   * Set error context from a caught error or error code string.
   * Unconditionally sets outcome to "error" — if setError is called, the
   * invocation is an error regardless of any prior setOutcome call.
   *
   * @param err - The caught error (Error, ConvexError, string, or unknown)
   * @param errorType - "business" for returned/ConvexError, "system" for unexpected throws
   */
  setError(err: unknown, errorType: ErrorType = "system"): void {
    this.fields.outcome = "error";
    this.fields.errorType = errorType;

    if (typeof err === "string") {
      this.fields.error = err;
    } else if (err instanceof Error) {
      this.fields.error = err.message;
      // ConvexError stores its data in the `data` property
      if ("data" in err && typeof (err as { data: unknown }).data === "string") {
        this.fields.error = (err as { data: string }).data;
      }
    } else {
      this.fields.error = "unknown";
    }
  }

  /** Calculate and set duration from a start timestamp. */
  setDuration(startTime: number): void {
    this.fields.durationMs = Date.now() - startTime;
  }

  // --------------------------------------------------------------------------
  // Emission
  // --------------------------------------------------------------------------

  /** Return the accumulated fields (for testing). */
  toJSON(): Record<string, unknown> {
    return { ...this.fields };
  }

  /**
   * Emit the wide event as a single JSON line via console.log.
   * Never throws — logging must not break the actual mutation.
   */
  emit(): void {
    try {
      // Strip undefined values before serializing
      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(this.fields)) {
        if (v !== undefined) clean[k] = v;
      }

      let payload = JSON.stringify(clean);

      // Enforce size limit
      if (new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) {
        // Strip large optional fields to fit
        const trimmed: Record<string, unknown> = {
          ...clean,
          _truncated: true,
        };
        // Remove array/object fields that might be large
        for (const key of Object.keys(trimmed)) {
          if (typeof trimmed[key] === "object" && trimmed[key] !== null) {
            delete trimmed[key];
          }
        }
        payload = JSON.stringify(trimmed);

        // Final guard: if still over limit after trimming, emit minimal safe payload
        if (new TextEncoder().encode(payload).length > MAX_PAYLOAD_BYTES) {
          payload = JSON.stringify({
            _event: "wide_event",
            fn: this.fields.fn,
            outcome: this.fields.outcome ?? "error",
            _truncated: true,
            _oversized: true,
          });
        }
      }

      console.log(payload);
    } catch {
      // Fallback: emit minimal event so we at least know something happened
      try {
        console.log(
          JSON.stringify({
            _event: "wide_event",
            fn: this.fields.fn,
            outcome: "error",
            _emitError: true,
          })
        );
      } catch {
        // Even the fallback failed — silently swallow
      }
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new wide event for the current function invocation.
 *
 * @param module - The module name (e.g. "voting", "sessions")
 * @param fn - The function name (e.g. "submitBan", "createSession")
 * @param fnType - The Convex function type
 */
export function createWideEvent(
  module: string,
  fn: string,
  fnType: FnType
): WideEvent {
  return new WideEvent(module, fn, fnType);
}
