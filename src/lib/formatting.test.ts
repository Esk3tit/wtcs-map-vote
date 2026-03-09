import { describe, it, expect } from "vitest";
import { normalizeRole, formatPlayerRole } from "@/lib/formatting";

describe("normalizeRole", () => {
  it('converts "Player A" to "PLAYER_A"', () => {
    expect(normalizeRole("Player A")).toBe("PLAYER_A");
  });

  it('converts "Player B" to "PLAYER_B"', () => {
    expect(normalizeRole("Player B")).toBe("PLAYER_B");
  });

  it('converts "Player 1" to "PLAYER_1"', () => {
    expect(normalizeRole("Player 1")).toBe("PLAYER_1");
  });

  it('is idempotent for "PLAYER_A"', () => {
    expect(normalizeRole("PLAYER_A")).toBe("PLAYER_A");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRole("  Player A  ")).toBe("PLAYER_A");
  });
});

describe("formatPlayerRole", () => {
  it("returns ban order label for Player A in ABBA format", () => {
    expect(formatPlayerRole("Player A", "ABBA")).toBe(
      "Player A — Bans 1st & 4th"
    );
  });

  it("returns ban order label for Player B in ABBA format", () => {
    expect(formatPlayerRole("Player B", "ABBA")).toBe(
      "Player B — Bans 2nd & 3rd"
    );
  });

  it("handles UPPER_SNAKE_CASE input in ABBA format", () => {
    expect(formatPlayerRole("PLAYER_A", "ABBA")).toBe(
      "Player A — Bans 1st & 4th"
    );
  });

  it("returns raw role for non-ABBA formats", () => {
    expect(formatPlayerRole("Player A", "MULTIPLAYER")).toBe("Player A");
  });

  it("returns raw role for unknown roles in ABBA format", () => {
    expect(formatPlayerRole("Player 1", "ABBA")).toBe("Player 1");
  });
});
