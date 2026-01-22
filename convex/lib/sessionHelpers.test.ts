/**
 * Session Helpers Tests
 *
 * Tests for session-related utility functions.
 */

import { describe, it, expect } from "vitest";
import { isActiveStatus } from "./sessionHelpers";
import type { SessionStatus } from "./constants";

describe("isActiveStatus", () => {
  describe("returns true for active statuses", () => {
    it("DRAFT is active", () => {
      expect(isActiveStatus("DRAFT")).toBe(true);
    });

    it("WAITING is active", () => {
      expect(isActiveStatus("WAITING")).toBe(true);
    });

    it("IN_PROGRESS is active", () => {
      expect(isActiveStatus("IN_PROGRESS")).toBe(true);
    });

    it("PAUSED is active", () => {
      expect(isActiveStatus("PAUSED")).toBe(true);
    });
  });

  describe("returns false for inactive statuses", () => {
    it("COMPLETE is not active", () => {
      expect(isActiveStatus("COMPLETE")).toBe(false);
    });

    it("EXPIRED is not active", () => {
      expect(isActiveStatus("EXPIRED")).toBe(false);
    });
  });

  describe("exhaustive status coverage", () => {
    it("covers all known statuses", () => {
      const allStatuses: SessionStatus[] = [
        "DRAFT",
        "WAITING",
        "IN_PROGRESS",
        "PAUSED",
        "COMPLETE",
        "EXPIRED",
      ];

      const activeStatuses = allStatuses.filter(isActiveStatus);
      const inactiveStatuses = allStatuses.filter((s) => !isActiveStatus(s));

      expect(activeStatuses).toHaveLength(4);
      expect(inactiveStatuses).toHaveLength(2);
      expect(activeStatuses).toEqual(
        expect.arrayContaining(["DRAFT", "WAITING", "IN_PROGRESS", "PAUSED"])
      );
      expect(inactiveStatuses).toEqual(
        expect.arrayContaining(["COMPLETE", "EXPIRED"])
      );
    });
  });
});
