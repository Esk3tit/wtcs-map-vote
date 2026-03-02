/**
 * Wide Event Builder Tests
 *
 * Unit tests for the WideEvent class, createWideEvent factory,
 * domain helpers, privacy truncation, and emit safety.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { WideEvent, createWideEvent } from "./lib/wideEvent";
import type { Doc, Id } from "./_generated/dataModel";

// ============================================================================
// Test Helpers
// ============================================================================

/** Build a minimal admin doc for testing. */
function fakeAdmin(
  overrides: Partial<Doc<"admins">> = {}
): Doc<"admins"> {
  return {
    _id: "admin123" as Id<"admins">,
    _creationTime: Date.now(),
    email: "alice@example.com",
    name: "Alice",
    isRootAdmin: false,
    lastLoginAt: Date.now(),
    ...overrides,
  };
}

/** Build a minimal session doc for testing. */
function fakeSession(
  overrides: Partial<Doc<"sessions">> = {}
): Doc<"sessions"> {
  return {
    _id: "session456" as Id<"sessions">,
    _creationTime: Date.now(),
    matchName: "Test Match",
    format: "ABBA",
    status: "IN_PROGRESS",
    turnTimerSeconds: 30,
    mapPoolSize: 7,
    playerCount: 2,
    currentTurn: 3,
    currentRound: 1,
    createdBy: "admin123" as Id<"admins">,
    updatedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    ...overrides,
  };
}

/** Build a minimal session player doc for testing. */
function fakePlayer(
  overrides: Partial<Doc<"sessionPlayers">> = {}
): Doc<"sessionPlayers"> {
  return {
    _id: "player789" as Id<"sessionPlayers">,
    _creationTime: Date.now(),
    sessionId: "session456" as Id<"sessions">,
    role: "PLAYER_A",
    teamName: "Team Alpha",
    token: "abcdefghijklmnop1234567890",
    tokenExpiresAt: Date.now() + 86400000,
    isConnected: true,
    hasVotedThisRound: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("createWideEvent", () => {
  it("sets required fields on creation", () => {
    const ev = createWideEvent("voting", "submitBan", "internalMutation");
    const json = ev.toJSON();

    expect(json._event).toBe("wide_event");
    expect(json.fn).toBe("voting.submitBan");
    expect(json.fnType).toBe("internalMutation");
    expect(json.ts).toBeTypeOf("number");
    expect(json.ts).toBeGreaterThan(0);
  });

  it("returns a WideEvent instance", () => {
    const ev = createWideEvent("sessions", "create", "mutation");
    expect(ev).toBeInstanceOf(WideEvent);
  });
});

describe("WideEvent.set", () => {
  it("stores arbitrary key-value pairs", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.set("mapsRemaining", 5);
    ev.set("isRevoteRound", true);
    ev.set("mapName", "Alaska");

    const json = ev.toJSON();
    expect(json.mapsRemaining).toBe(5);
    expect(json.isRevoteRound).toBe(true);
    expect(json.mapName).toBe("Alaska");
  });

  it("overwrites existing keys", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.set("count", 1);
    ev.set("count", 2);
    expect(ev.toJSON().count).toBe(2);
  });
});

describe("WideEvent.setAdmin", () => {
  it("extracts admin ID and email domain", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setAdmin(fakeAdmin());

    const json = ev.toJSON();
    expect(json.adminId).toBe("admin123");
    expect(json.adminDomain).toBe("example.com");
  });

  it("handles null admin gracefully", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setAdmin(null);
    ev.setAdmin(undefined);

    const json = ev.toJSON();
    expect(json.adminId).toBeUndefined();
    expect(json.adminDomain).toBeUndefined();
  });

  it("handles email without domain", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setAdmin(fakeAdmin({ email: "nodomain" }));

    const json = ev.toJSON();
    expect(json.adminId).toBe("admin123");
    expect(json.adminDomain).toBeUndefined();
  });
});

describe("WideEvent.setPlayer", () => {
  it("truncates token to first 8 characters", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setPlayer("abcdefghijklmnop1234567890", fakePlayer());

    const json = ev.toJSON();
    expect(json.tokenPrefix).toBe("abcdefgh");
    expect(json.playerId).toBe("player789");
    expect(json.teamName).toBe("Team Alpha");
  });

  it("handles short tokens", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setPlayer("abc", fakePlayer());

    expect(ev.toJSON().tokenPrefix).toBe("abc");
  });

  it("handles null token and player", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setPlayer(null, null);

    const json = ev.toJSON();
    expect(json.tokenPrefix).toBeUndefined();
    expect(json.playerId).toBeUndefined();
  });

  it("handles token without player", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setPlayer("abcdefghijklmnop", null);

    const json = ev.toJSON();
    expect(json.tokenPrefix).toBe("abcdefgh");
    expect(json.playerId).toBeUndefined();
  });
});

describe("WideEvent.setSession", () => {
  it("extracts all session context fields", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setSession(fakeSession());

    const json = ev.toJSON();
    expect(json.sessionId).toBe("session456");
    expect(json.format).toBe("ABBA");
    expect(json.sessionStatus).toBe("IN_PROGRESS");
    expect(json.currentTurn).toBe(3);
    expect(json.currentRound).toBe(1);
  });

  it("handles null session gracefully", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setSession(null);

    expect(ev.toJSON().sessionId).toBeUndefined();
  });
});

describe("WideEvent.setMap", () => {
  it("extracts map ID and name", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setMap({ _id: "map123", name: "Alaska" });

    const json = ev.toJSON();
    expect(json.mapId).toBe("map123");
    expect(json.mapName).toBe("Alaska");
  });

  it("handles null map", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setMap(null);

    expect(ev.toJSON().mapId).toBeUndefined();
  });

  it("handles partial map data", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setMap({ name: "Alaska" });

    const json = ev.toJSON();
    expect(json.mapId).toBeUndefined();
    expect(json.mapName).toBe("Alaska");
  });
});

describe("WideEvent.setIp", () => {
  it("truncates IPv4 to first 2 octets", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setIp("192.168.1.100");

    expect(ev.toJSON().ip).toBe("192.168");
  });

  it("handles different IP ranges", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setIp("10.0.0.1");
    expect(ev.toJSON().ip).toBe("10.0");
  });

  it("marks non-IPv4 addresses", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setIp("::1");
    expect(ev.toJSON().ip).toBe("non-ipv4");
  });

  it("handles null IP", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setIp(null);
    expect(ev.toJSON().ip).toBeUndefined();
  });

  it("handles undefined IP", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setIp(undefined);
    expect(ev.toJSON().ip).toBeUndefined();
  });
});

describe("WideEvent.setOutcome", () => {
  it("sets outcome field", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setOutcome("ok");
    expect(ev.toJSON().outcome).toBe("ok");
  });

  it("supports all outcome values", () => {
    for (const outcome of ["ok", "error", "noop"] as const) {
      const ev = createWideEvent("test", "fn", "mutation");
      ev.setOutcome(outcome);
      expect(ev.toJSON().outcome).toBe(outcome);
    }
  });
});

describe("WideEvent.setError", () => {
  it("handles Error objects", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError(new Error("something broke"), "system");

    const json = ev.toJSON();
    expect(json.error).toBe("something broke");
    expect(json.errorType).toBe("system");
    expect(json.outcome).toBe("error");
  });

  it("handles string errors", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError("NOT_YOUR_TURN", "business");

    const json = ev.toJSON();
    expect(json.error).toBe("NOT_YOUR_TURN");
    expect(json.errorType).toBe("business");
  });

  it("handles ConvexError-like objects with data property", () => {
    // ConvexError stores user-facing message in .data
    const fakeConvexError = Object.assign(new Error("ConvexError"), {
      data: "Session not found",
    });
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError(fakeConvexError, "business");

    expect(ev.toJSON().error).toBe("Session not found");
  });

  it("handles unknown error types", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError(42);

    expect(ev.toJSON().error).toBe("unknown");
  });

  it("auto-sets outcome to error if not already set", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError("fail");
    expect(ev.toJSON().outcome).toBe("error");
  });

  it("does not overwrite existing outcome", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setOutcome("noop");
    ev.setError("fail");
    // outcome was already set, setError should not overwrite
    // Actually per the code, it only sets if !this.fields.outcome
    expect(ev.toJSON().outcome).toBe("noop");
  });

  it("defaults errorType to system", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setError(new Error("oops"));

    expect(ev.toJSON().errorType).toBe("system");
  });
});

describe("WideEvent.setDuration", () => {
  it("calculates duration from start time", () => {
    const startTime = Date.now() - 50;
    const ev = createWideEvent("test", "fn", "mutation");
    ev.setDuration(startTime);

    const duration = ev.toJSON().durationMs as number;
    expect(duration).toBeGreaterThanOrEqual(50);
    expect(duration).toBeLessThan(500); // reasonable upper bound
  });
});

describe("WideEvent.toJSON", () => {
  it("returns a copy of the fields", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    const json1 = ev.toJSON();
    const json2 = ev.toJSON();

    // Different references
    expect(json1).not.toBe(json2);
    // Same content
    expect(json1).toEqual(json2);
  });

  it("mutations to returned object do not affect the event", () => {
    const ev = createWideEvent("test", "fn", "mutation");
    const json = ev.toJSON();
    json.fn = "tampered";

    expect(ev.toJSON().fn).toBe("test.fn");
  });
});

describe("WideEvent.emit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits valid JSON to console.log", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ev = createWideEvent("voting", "submitBan", "internalMutation");
    ev.setOutcome("ok");
    ev.emit();

    expect(logSpy).toHaveBeenCalledOnce();
    const payload = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(payload);
    expect(parsed._event).toBe("wide_event");
    expect(parsed.fn).toBe("voting.submitBan");
    expect(parsed.outcome).toBe("ok");
  });

  it("strips undefined values", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ev = createWideEvent("test", "fn", "mutation");
    ev.set("present", "yes");
    ev.set("absent", undefined);
    ev.emit();

    const payload = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(payload);
    expect(parsed.present).toBe("yes");
    expect("absent" in parsed).toBe(false);
  });

  it("never throws on normal usage", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const ev = createWideEvent("test", "fn", "mutation");
    expect(() => ev.emit()).not.toThrow();
  });

  it("never throws even when console.log throws", () => {
    vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("console broken");
    });
    const ev = createWideEvent("test", "fn", "mutation");
    expect(() => ev.emit()).not.toThrow();
  });

  it("truncates oversized payloads and adds _truncated flag", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ev = createWideEvent("test", "fn", "mutation");

    // Add a large array that will push payload over 3.5 KiB (need ~3600 bytes)
    const largeArray = Array.from(
      { length: 200 },
      (_, i) => `item-${i}-${"x".repeat(20)}`
    );
    ev.set("bigList", largeArray);
    ev.emit();

    const payload = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(payload);
    expect(parsed._truncated).toBe(true);
    expect(parsed.bigList).toBeUndefined(); // array was stripped
    expect(new TextEncoder().encode(payload).length).toBeLessThanOrEqual(3584);
  });

  it("emits fallback event when JSON.stringify fails", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const ev = createWideEvent("test", "fn", "mutation");

    // Create a circular reference
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    ev.set("circular", circular);
    ev.emit();

    // Should have emitted the fallback
    expect(logSpy).toHaveBeenCalled();
    const payload = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(payload);
    expect(parsed._emitError).toBe(true);
    expect(parsed.fn).toBe("test.fn");
  });
});
