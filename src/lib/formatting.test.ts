import { describe, it, expect } from "vitest";
import { normalizeRole } from "./formatting";

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
});
