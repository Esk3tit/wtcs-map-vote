import { describe, it, expect } from "vitest";
import type { CaptureResult } from "posthog-js";

import { beforeSendEvent } from "@/lib/posthogRedaction";

/** Build a minimal CaptureResult with the given properties. */
function event(properties: Record<string, unknown>): CaptureResult {
  return {
    event: "$pageview",
    properties,
  } as unknown as CaptureResult;
}

describe("beforeSendEvent", () => {
  it("redacts player tokens from /vote and /lobby path segments in URL properties", () => {
    const result = beforeSendEvent(
      event({
        $current_url: "https://app.example.com/vote/SECRET123?foo=bar",
        $referrer: "https://app.example.com/lobby/TOK456",
        $session_entry_url: "https://app.example.com/vote/ABC789",
      }),
    );

    const props = result!.properties;
    expect(props.$current_url).toBe(
      "https://app.example.com/vote/[REDACTED]?foo=bar",
    );
    expect(props.$referrer).toBe("https://app.example.com/lobby/[REDACTED]");
    expect(props.$session_entry_url).toBe(
      "https://app.example.com/vote/[REDACTED]",
    );
  });

  it("redacts the ?token= query param value", () => {
    const result = beforeSendEvent(
      event({ $current_url: "https://app.example.com/results?token=SECRET" }),
    );

    expect(result!.properties.$current_url).toContain("token=%5BREDACTED%5D");
    expect(result!.properties.$current_url).not.toContain("SECRET");
  });

  it("redacts path-only properties", () => {
    const result = beforeSendEvent(
      event({ $pathname: "/lobby/SECRET", $session_entry_pathname: "/vote/X" }),
    );

    expect(result!.properties.$pathname).toBe("/lobby/[REDACTED]");
    expect(result!.properties.$session_entry_pathname).toBe("/vote/[REDACTED]");
  });

  it('stamps app: "map-vote-ban" on every event, including when absent', () => {
    const result = beforeSendEvent(event({ $current_url: "https://x/home" }));
    expect(result!.properties.app).toBe("map-vote-ban");
  });

  it("returns the event (never null) when there are no URL-bearing properties", () => {
    const e = event({ some_custom_prop: 42 });
    const result = beforeSendEvent(e);

    expect(result).toBe(e);
    expect(result!.properties.some_custom_prop).toBe(42);
    expect(result!.properties.app).toBe("map-vote-ban");
  });

  it("leaves non-URL properties untouched", () => {
    const result = beforeSendEvent(
      event({ distinct_id: "user-1", count: 3, flag: true }),
    );

    expect(result!.properties.distinct_id).toBe("user-1");
    expect(result!.properties.count).toBe(3);
    expect(result!.properties.flag).toBe(true);
  });

  it("passes a null event through unchanged", () => {
    expect(beforeSendEvent(null)).toBeNull();
  });
});
