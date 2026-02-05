/**
 * HTTP Helper Tests
 *
 * Tests for extractClientIp and getCorsHeaders functions.
 *
 * NOTE: HTTP actions (httpAction) cannot be directly invoked in convex-test.
 * The helper functions are exported and tested directly as pure functions.
 * Full HTTP integration tests require a running deployment.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractClientIp, getCorsHeaders } from "./http";

// ============================================================================
// extractClientIp Tests
// ============================================================================

describe("extractClientIp", () => {
  it("extracts rightmost IP from X-Forwarded-For header", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "203.0.113.1, 70.41.3.18, 150.172.238.178" },
    });

    expect(extractClientIp(req)).toBe("150.172.238.178");
  });

  it("handles single IP in X-Forwarded-For", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "203.0.113.1" },
    });

    expect(extractClientIp(req)).toBe("203.0.113.1");
  });

  it("trims whitespace from extracted IP", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "  203.0.113.1 ,  70.41.3.18 " },
    });

    expect(extractClientIp(req)).toBe("70.41.3.18");
  });

  it("falls back to X-Real-Ip when no X-Forwarded-For", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Real-Ip": "10.0.0.1" },
    });

    expect(extractClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const req = new Request("https://example.com");

    expect(extractClientIp(req)).toBe("unknown");
  });

  it("prefers X-Forwarded-For over X-Real-Ip when both present", () => {
    const req = new Request("https://example.com", {
      headers: {
        "X-Forwarded-For": "203.0.113.1",
        "X-Real-Ip": "10.0.0.1",
      },
    });

    expect(extractClientIp(req)).toBe("203.0.113.1");
  });
});

// ============================================================================
// getCorsHeaders Tests
// ============================================================================

describe("getCorsHeaders", () => {
  // Save and restore original process.env
  let originalEnv: Record<string, string> | undefined;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalEnv = (globalThis as any).process?.env;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).process = { env: originalEnv };
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).process;
    }
  });

  it("uses SITE_URL when set", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: { SITE_URL: "https://mysite.com" } };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("strips trailing slash from SITE_URL", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: { SITE_URL: "https://mysite.com/" } };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("strips multiple trailing slashes from SITE_URL", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: { SITE_URL: "https://mysite.com///" } };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("blocks origin in Convex Cloud when SITE_URL missing", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = {
      env: { CONVEX_CLOUD_URL: "https://my-deployment.convex.cloud" },
    };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://blocked.invalid"
    );
  });

  it("allows all origins in local dev (no env vars)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: {} };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("includes Vary: Origin when specific origin set", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: { SITE_URL: "https://mysite.com" } };

    const headers = getCorsHeaders();

    expect(headers["Vary"]).toBe("Origin");
  });

  it("omits Vary header when allowing all origins", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: {} };

    const headers = getCorsHeaders();

    expect(headers["Vary"]).toBeUndefined();
  });

  it("always includes standard CORS method and header fields", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env: {} };

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });
});
