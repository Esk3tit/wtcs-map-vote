/**
 * HTTP Routes
 *
 * HTTP router for auth callback routes, player token validation,
 * and heartbeat endpoints.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

import { httpRouter } from "convex/server";

import { auth } from "./auth";
import { createWideEvent } from "./lib/wideEvent";

const http = httpRouter();

auth.addHttpRoutes(http);

// ============================================================================
// Player Token Endpoints
// ============================================================================

/**
 * Extract client IP from request headers.
 * Uses the rightmost IP in X-Forwarded-For (set by the edge proxy).
 * Falls back to X-Real-Ip, then "unknown".
 */
export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get("X-Forwarded-For");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    // Rightmost IP is the one added by the trusted proxy
    return ips[ips.length - 1];
  }
  return req.headers.get("X-Real-Ip") ?? "unknown";
}

/**
 * Build CORS headers for player API responses.
 * Uses SITE_URL env var when set, falls back to "*" in local dev.
 * Fails closed in Convex Cloud deployments if SITE_URL is missing.
 * Must be called inside handlers because env vars are only available at runtime.
 */
export function getCorsHeaders(): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  let origin: string;
  if (env?.SITE_URL) {
    origin = env.SITE_URL.replace(/\/+$/, "");
  } else if (env?.CONVEX_CLOUD_URL) {
    // Running in Convex Cloud without SITE_URL — fail closed
    console.warn("CORS misconfiguration: SITE_URL is not set in Convex Cloud. Blocking all origins.");
    origin = "https://blocked.invalid";
  } else {
    // Local development — allow all origins
    origin = "*";
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...(origin !== "*" ? { Vary: "Origin" } : {}),
  };
}

/**
 * Create a POST handler for player endpoints that share the same structure:
 * parse JSON body, validate token, call an internal mutation, return result.
 *
 * @param mutationRef - The internal mutation to invoke with { token, ipAddress }
 */
function createPlayerHandler(
  mutationRef:
    | typeof internal.playerAuth.validateAndLockToken
    | typeof internal.playerAuth.playerHeartbeat
    | typeof internal.playerAuth.playerReady,
  endpointName: string
) {
  return httpAction(async (ctx, req) => {
    const ev = createWideEvent("http", endpointName, "httpAction");
    const startTime = Date.now();
    try {
      const corsHeaders = getCorsHeaders();
      ev.set("method", "POST");
      ev.set("path", new URL(req.url).pathname);

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        ev.setOutcome("error");
        ev.set("error", "INVALID_REQUEST");
        ev.set("httpStatus", 400);
        return new Response(
          JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const token = typeof body === "object" && body !== null && "token" in body
        ? (body as { token: unknown }).token
        : undefined;

      if (typeof token !== "string" || token.length === 0) {
        ev.setOutcome("error");
        ev.set("error", "INVALID_TOKEN");
        ev.set("httpStatus", 400);
        return new Response(
          JSON.stringify({ status: "error", error: "INVALID_TOKEN" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const ipAddress = extractClientIp(req);
      ev.setIp(ipAddress);
      ev.setPlayer(token, null);

      const result = await ctx.runMutation(mutationRef, { token, ipAddress });

      let statusCode: number;
      if (result.status === "ok") {
        statusCode = 200;
      } else if (result.error === "RATE_LIMITED") {
        statusCode = 429;
      } else {
        // Use 403 for all auth failures to avoid leaking token/session existence
        statusCode = 403;
      }

      ev.set("httpStatus", statusCode);
      ev.setOutcome(result.status === "ok" ? "ok" : "error");
      if (result.status !== "ok") {
        ev.set("error", result.error);
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...corsHeaders,
      };
      if (statusCode === 429 && "retryAfter" in result && result.retryAfter) {
        headers["Retry-After"] = String(Math.ceil(result.retryAfter / 1000));
      }

      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers,
      });
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  });
}

/** Shared CORS preflight handler for player endpoints. */
const corsPreflightHandler = httpAction(async () => {
  return new Response(null, { status: 204, headers: getCorsHeaders() });
});

/**
 * Validate a player token and lock it to the client's IP.
 * Called once on page load by the frontend.
 */
http.route({
  path: "/api/player/validate-token",
  method: "POST",
  handler: createPlayerHandler(internal.playerAuth.validateAndLockToken, "validateToken"),
});

/** Handle CORS preflight for validate-token endpoint. */
http.route({
  path: "/api/player/validate-token",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * Player heartbeat to maintain connection status.
 * Called periodically by the frontend.
 */
http.route({
  path: "/api/player/heartbeat",
  method: "POST",
  handler: createPlayerHandler(internal.playerAuth.playerHeartbeat, "heartbeat"),
});

/** Handle CORS preflight for heartbeat endpoint. */
http.route({
  path: "/api/player/heartbeat",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * Player ready signal to indicate readiness in the lobby.
 * Called by the frontend when a player presses "Ready Up".
 */
http.route({
  path: "/api/player/ready",
  method: "POST",
  handler: createPlayerHandler(internal.playerAuth.playerReady, "playerReady"),
});

/** Handle CORS preflight for ready endpoint. */
http.route({
  path: "/api/player/ready",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

// ============================================================================
// Voting Endpoints
// ============================================================================

/**
 * Create a POST handler for voting endpoints that share the same structure:
 * parse JSON body, validate token + mapId, call an internal mutation, return result.
 * Wraps the mutation call in try/catch to surface invalid Convex ID formats as 400.
 *
 * @param mutationRef - The internal mutation to invoke with { token, mapId, ipAddress }
 */
function createVotingHandler(
  mutationRef: typeof internal.voting.submitBan | typeof internal.voting.submitVote,
  endpointName: string
) {
  return httpAction(async (ctx, req) => {
    const ev = createWideEvent("http", endpointName, "httpAction");
    const startTime = Date.now();
    try {
      const corsHeaders = getCorsHeaders();
      ev.set("method", "POST");
      ev.set("path", new URL(req.url).pathname);

      let body: unknown;
      try {
        body = await req.json();
      } catch {
        ev.setOutcome("error");
        ev.set("error", "INVALID_REQUEST");
        ev.set("httpStatus", 400);
        return new Response(
          JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const token =
        typeof body === "object" && body !== null && "token" in body
          ? (body as { token: unknown }).token
          : undefined;
      const mapId =
        typeof body === "object" && body !== null && "mapId" in body
          ? (body as { mapId: unknown }).mapId
          : undefined;

      if (typeof token !== "string" || token.length === 0) {
        ev.setOutcome("error");
        ev.set("error", "INVALID_TOKEN");
        ev.set("httpStatus", 400);
        return new Response(
          JSON.stringify({ status: "error", error: "INVALID_TOKEN" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (typeof mapId !== "string" || mapId.length === 0) {
        ev.setOutcome("error");
        ev.set("error", "INVALID_REQUEST");
        ev.set("httpStatus", 400);
        return new Response(
          JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const ipAddress = extractClientIp(req);
      ev.setIp(ipAddress);
      ev.setPlayer(token, null);
      ev.set("mapId", mapId);

      // Cast to Id — wrap in try/catch to surface invalid ID format as 400
      try {
        const result = await ctx.runMutation(mutationRef, {
          token,
          mapId: mapId as Id<"sessionMaps">,
          ipAddress,
        });

        let statusCode: number;
        if (result.status === "ok") {
          statusCode = 200;
        } else if (result.error === "RATE_LIMITED") {
          statusCode = 429;
        } else {
          statusCode = 403;
        }

        ev.set("httpStatus", statusCode);
        ev.setOutcome(result.status === "ok" ? "ok" : "error");
        if (result.status !== "ok") {
          ev.set("error", result.error);
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...corsHeaders,
        };
        if (statusCode === 429 && "retryAfter" in result && result.retryAfter) {
          headers["Retry-After"] = String(Math.ceil(result.retryAfter / 1000));
        }

        return new Response(JSON.stringify(result), {
          status: statusCode,
          headers,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Invalid Convex ID format surfaces as an argument validation error
        if (message.includes("is not a valid ID")) {
          ev.setOutcome("error");
          ev.set("error", "INVALID_REQUEST");
          ev.set("httpStatus", 400);
          return new Response(
            JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        // Re-throw unexpected errors so Convex logs them properly
        throw error;
      }
    } catch (err) {
      ev.setError(err);
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  });
}

/**
 * Submit a map ban during ABBA voting.
 * Called by the frontend when a player clicks a map to ban.
 */
http.route({
  path: "/api/player/submit-ban",
  method: "POST",
  handler: createVotingHandler(internal.voting.submitBan, "submitBan"),
});

/** Handle CORS preflight for submit-ban endpoint. */
http.route({
  path: "/api/player/submit-ban",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

/**
 * Submit a vote during MULTIPLAYER voting.
 * Called by the frontend when a player clicks a map to vote to eliminate.
 */
http.route({
  path: "/api/player/submit-vote",
  method: "POST",
  handler: createVotingHandler(internal.voting.submitVote, "submitVote"),
});

/** Handle CORS preflight for submit-vote endpoint. */
http.route({
  path: "/api/player/submit-vote",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

export default http;
