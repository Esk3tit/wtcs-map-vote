/**
 * Connection Status Tests
 *
 * Unit tests for the computeConnectionStatus pure function.
 * No Convex test harness needed — this tests a pure function with mocked time.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { computeConnectionStatus } from "./lib/connectionStatus";

const NOW = 1_000_000_000;

describe("computeConnectionStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Branch 1: isConnected = false -> "disconnected"
  // ==========================================================================

  describe("when isConnected is false", () => {
    it("returns 'disconnected' with no lastHeartbeat", () => {
      expect(computeConnectionStatus(false, undefined)).toBe("disconnected");
    });

    it("returns 'disconnected' even with a recent lastHeartbeat", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(false, NOW)).toBe("disconnected");
    });
  });

  // ==========================================================================
  // Branch 2: isConnected = true, no lastHeartbeat -> "connected"
  // ==========================================================================

  describe("when isConnected is true and no lastHeartbeat", () => {
    it("returns 'connected' when lastHeartbeat is undefined", () => {
      expect(computeConnectionStatus(true, undefined)).toBe("connected");
    });
  });

  // ==========================================================================
  // Branch 3: isConnected = true, recent heartbeat -> "connected"
  // ==========================================================================

  describe("when isConnected is true and heartbeat is recent", () => {
    it("returns 'connected' for a heartbeat 1s ago", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 1_000)).toBe("connected");
    });

    it("returns 'connected' for a heartbeat just under interval (29_999ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 29_999)).toBe("connected");
    });
  });

  // ==========================================================================
  // Branch 4: isConnected = true, stale heartbeat -> "reconnecting"
  // ==========================================================================

  describe("when isConnected is true and heartbeat is stale (between interval and timeout)", () => {
    it("returns 'reconnecting' for a heartbeat just over interval (30_001ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 30_001)).toBe("reconnecting");
    });

    it("returns 'reconnecting' for a heartbeat just under timeout (59_999ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 59_999)).toBe("reconnecting");
    });
  });

  // ==========================================================================
  // Branch 5: isConnected = true, very stale heartbeat -> "disconnected"
  // ==========================================================================

  describe("when isConnected is true and heartbeat exceeds timeout", () => {
    it("returns 'disconnected' for a heartbeat just over timeout (60_001ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 60_001)).toBe("disconnected");
    });

    it("returns 'disconnected' for a heartbeat way over timeout (120_000ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      expect(computeConnectionStatus(true, NOW - 120_000)).toBe("disconnected");
    });
  });

  // ==========================================================================
  // Boundary tests (exact threshold values)
  // ==========================================================================

  describe("boundary values at exact thresholds", () => {
    it("returns 'connected' when elapsed is exactly HEARTBEAT_INTERVAL_MS (30_000ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      // elapsed === 30_000 is NOT > 30_000, so still "connected"
      expect(computeConnectionStatus(true, NOW - 30_000)).toBe("connected");
    });

    it("returns 'reconnecting' when elapsed is exactly HEARTBEAT_TIMEOUT_MS (60_000ms)", () => {
      vi.spyOn(Date, "now").mockReturnValue(NOW);
      // elapsed === 60_000 is NOT > 60_000, so still "reconnecting"
      expect(computeConnectionStatus(true, NOW - 60_000)).toBe("reconnecting");
    });
  });
});
