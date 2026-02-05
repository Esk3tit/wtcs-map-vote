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

  it("falls through to X-Real-Ip when X-Forwarded-For is empty string", () => {
    const req = new Request("https://example.com", {
      headers: {
        "X-Forwarded-For": "",
        "X-Real-Ip": "10.0.0.1",
      },
    });

    // Empty string is falsy, so extractClientIp skips it
    expect(extractClientIp(req)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when X-Forwarded-For is empty and no X-Real-Ip", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "" },
    });

    expect(extractClientIp(req)).toBe("unknown");
  });

  it("returns IPv6 loopback address from X-Forwarded-For", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "::1" },
    });

    // extractClientIp does not validate format, returns as-is
    expect(extractClientIp(req)).toBe("::1");
  });

  it("returns full IPv6 address from X-Forwarded-For", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "203.0.113.1, 2001:db8::1" },
    });

    // Rightmost entry is IPv6 — returned without validation
    expect(extractClientIp(req)).toBe("2001:db8::1");
  });

  it("returns non-IP value from X-Forwarded-For as-is", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "not-an-ip" },
    });

    // extractClientIp is a pass-through; validation happens downstream
    expect(extractClientIp(req)).toBe("not-an-ip");
  });

  it("falls through when X-Forwarded-For contains only whitespace", () => {
    const req = new Request("https://example.com", {
      headers: { "X-Forwarded-For": "  " },
    });

    // The Request API normalizes whitespace-only values to "", which is
    // falsy, so extractClientIp falls through to "unknown"
    expect(extractClientIp(req)).toBe("unknown");
  });
});

// ============================================================================
// getCorsHeaders Tests
// ============================================================================

describe("getCorsHeaders", () => {
  // Save and restore original process.env
  let originalEnv: Record<string, string> | undefined;

  /** Set process.env for testing getCorsHeaders. */
  function setEnv(env: Record<string, string>): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = { env };
  }

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    originalEnv = (globalThis as any).process?.env;
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      setEnv(originalEnv);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).process;
    }
  });

  it("uses SITE_URL when set", () => {
    setEnv({ SITE_URL: "https://mysite.com" });

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("strips trailing slash from SITE_URL", () => {
    setEnv({ SITE_URL: "https://mysite.com/" });

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("strips multiple trailing slashes from SITE_URL", () => {
    setEnv({ SITE_URL: "https://mysite.com///" });

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://mysite.com");
  });

  it("blocks origin in Convex Cloud when SITE_URL missing", () => {
    setEnv({ CONVEX_CLOUD_URL: "https://my-deployment.convex.cloud" });

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://blocked.invalid"
    );
  });

  it("allows all origins in local dev (no env vars)", () => {
    setEnv({});

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("includes Vary: Origin when specific origin set", () => {
    setEnv({ SITE_URL: "https://mysite.com" });

    const headers = getCorsHeaders();

    expect(headers["Vary"]).toBe("Origin");
  });

  it("omits Vary header when allowing all origins", () => {
    setEnv({});

    const headers = getCorsHeaders();

    expect(headers["Vary"]).toBeUndefined();
  });

  it("always includes standard CORS method and header fields", () => {
    setEnv({});

    const headers = getCorsHeaders();

    expect(headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });
});
