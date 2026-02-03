/**
 * HTTP Routes
 *
 * HTTP router for auth callback routes, player token validation,
 * and heartbeat endpoints.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

import { httpRouter } from "convex/server";

import { auth } from "./auth";

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
function extractClientIp(req: Request): string {
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
 * Uses FRONTEND_URL env var when set (production), falls back to "*" (development).
 * Must be called inside handlers because env vars are only available at runtime.
 */
function getCorsHeaders(): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env as Record<string, string> | undefined;
  const origin = env?.FRONTEND_URL ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/**
 * Create a POST handler for player endpoints that share the same structure:
 * parse JSON body, validate token, call an internal mutation, return result.
 *
 * @param mutationRef - The internal mutation to invoke with { token, ipAddress }
 */
function createPlayerHandler(
  mutationRef: typeof internal.playerAuth.validateAndLockToken | typeof internal.playerAuth.playerHeartbeat
) {
  return httpAction(async (ctx, req) => {
    const corsHeaders = getCorsHeaders();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ status: "error", error: "INVALID_REQUEST" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = typeof body === "object" && body !== null && "token" in body
      ? (body as { token: unknown }).token
      : undefined;

    if (typeof token !== "string" || token.length === 0) {
      return new Response(
        JSON.stringify({ status: "error", error: "INVALID_TOKEN" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const ipAddress = extractClientIp(req);
    const result = await ctx.runMutation(mutationRef, { token, ipAddress });
    // Use 403 for all auth failures to avoid leaking token/session existence
    const statusCode = result.status === "ok" ? 200 : 403;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
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
  handler: createPlayerHandler(internal.playerAuth.validateAndLockToken),
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
  handler: createPlayerHandler(internal.playerAuth.playerHeartbeat),
});

/** Handle CORS preflight for heartbeat endpoint. */
http.route({
  path: "/api/player/heartbeat",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

export default http;
