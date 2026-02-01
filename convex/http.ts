/**
 * HTTP Routes
 *
 * HTTP router for auth callback routes, player token validation,
 * and heartbeat endpoints.
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

import { internal } from "./_generated/api";
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

/** Standard CORS headers for player API responses. */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Validate a player token and lock it to the client's IP.
 * Called once on page load by the frontend.
 */
http.route({
  path: "/api/player/validate-token",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json();
    const token = body?.token;

    if (typeof token !== "string" || token.length === 0) {
      return new Response(
        JSON.stringify({ status: "error", error: "INVALID_TOKEN" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const ipAddress = extractClientIp(req);

    const result = await ctx.runMutation(
      internal.playerAuth.validateAndLockToken,
      { token, ipAddress }
    );

    const statusCode = result.status === "ok" ? 200 : 403;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

/**
 * Handle CORS preflight for validate-token endpoint.
 */
http.route({
  path: "/api/player/validate-token",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

/**
 * Player heartbeat to maintain connection status.
 * Called periodically by the frontend.
 */
http.route({
  path: "/api/player/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json();
    const token = body?.token;

    if (typeof token !== "string" || token.length === 0) {
      return new Response(
        JSON.stringify({ status: "error", error: "INVALID_TOKEN" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const ipAddress = extractClientIp(req);

    const result = await ctx.runMutation(
      internal.playerAuth.playerHeartbeat,
      { token, ipAddress }
    );

    const statusCode = result.status === "ok" ? 200 : 403;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});

/**
 * Handle CORS preflight for heartbeat endpoint.
 */
http.route({
  path: "/api/player/heartbeat",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

export default http;
