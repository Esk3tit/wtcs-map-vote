// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  phaseReducer,
  INITIAL_PHASE_STATE,
  type PhaseState,
  type PhaseEvent,
} from "../useRevealPhase";

// Helpers for fake Convex IDs
const fakeSessionMapId = (n: number) =>
  `session_maps_${n}` as Id<"sessionMaps">;

describe("phaseReducer", () => {
  // -------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------
  it("initial state is VOTING", () => {
    expect(INITIAL_PHASE_STATE).toEqual({ phase: "VOTING" });
  });

  // -------------------------------------------------------------------
  // ROUND_COMPLETED
  // -------------------------------------------------------------------
  describe("ROUND_COMPLETED", () => {
    it("transitions from VOTING to REVEALING with correct reveal data", () => {
      const event: PhaseEvent = {
        type: "ROUND_COMPLETED",
        completedRound: 1,
        eliminatedMapIds: [fakeSessionMapId(1), fakeSessionMapId(2)],
        outcome: "ROUND_ADVANCED",
      };

      const next = phaseReducer(INITIAL_PHASE_STATE, event);

      expect(next).toEqual({
        phase: "REVEALING",
        reveal: {
          completedRound: 1,
          eliminatedMapIds: [fakeSessionMapId(1), fakeSessionMapId(2)],
          outcome: "ROUND_ADVANCED",
        },
      });
    });

    it("is a no-op from REVEALING (non-VOTING state)", () => {
      const revealingState: PhaseState = {
        phase: "REVEALING",
        reveal: {
          completedRound: 1,
          eliminatedMapIds: [fakeSessionMapId(1)],
          outcome: "ROUND_ADVANCED",
        },
      };

      const event: PhaseEvent = {
        type: "ROUND_COMPLETED",
        completedRound: 2,
        eliminatedMapIds: [fakeSessionMapId(3)],
        outcome: "ROUND_ADVANCED",
      };

      const next = phaseReducer(revealingState, event);
      expect(next).toBe(revealingState);
    });

    it("is a no-op from WINNER_REVEAL (non-VOTING state)", () => {
      const winnerState: PhaseState = {
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [fakeSessionMapId(4)],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(5),
      };

      const event: PhaseEvent = {
        type: "ROUND_COMPLETED",
        completedRound: 4,
        eliminatedMapIds: [fakeSessionMapId(6)],
        outcome: "REVOTE",
      };

      const next = phaseReducer(winnerState, event);
      expect(next).toBe(winnerState);
    });

    it("is a no-op from REDIRECTING (non-VOTING state)", () => {
      const redirectingState: PhaseState = {
        phase: "REDIRECTING",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(5),
      };

      const event: PhaseEvent = {
        type: "ROUND_COMPLETED",
        completedRound: 4,
        eliminatedMapIds: [fakeSessionMapId(6)],
        outcome: "ROUND_ADVANCED",
      };

      const next = phaseReducer(redirectingState, event);
      expect(next).toBe(redirectingState);
    });
  });

  // -------------------------------------------------------------------
  // WINNER_DETECTED
  // -------------------------------------------------------------------
  describe("WINNER_DETECTED", () => {
    const winnerEvent: PhaseEvent = {
      type: "WINNER_DETECTED",
      winnerMapId: fakeSessionMapId(10),
      completedRound: 3,
      eliminatedMapIds: [fakeSessionMapId(7), fakeSessionMapId(8)],
      outcome: "WINNER",
    };

    it("transitions from VOTING to WINNER_REVEAL", () => {
      const next = phaseReducer(INITIAL_PHASE_STATE, winnerEvent);

      expect(next).toEqual({
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [fakeSessionMapId(7), fakeSessionMapId(8)],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(10),
      });
    });

    it("transitions from REVEALING to WINNER_REVEAL (winner can interrupt)", () => {
      const revealingState: PhaseState = {
        phase: "REVEALING",
        reveal: {
          completedRound: 2,
          eliminatedMapIds: [fakeSessionMapId(1)],
          outcome: "ROUND_ADVANCED",
        },
      };

      const next = phaseReducer(revealingState, winnerEvent);

      expect(next).toEqual({
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [fakeSessionMapId(7), fakeSessionMapId(8)],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(10),
      });
    });

    it("is a no-op from WINNER_REVEAL (already in winner reveal)", () => {
      const winnerState: PhaseState = {
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 2,
          eliminatedMapIds: [fakeSessionMapId(1)],
          outcome: "RANDOM_WINNER",
        },
        winnerMapId: fakeSessionMapId(9),
      };

      const next = phaseReducer(winnerState, winnerEvent);
      expect(next).toBe(winnerState);
    });

    it("is a no-op from REDIRECTING", () => {
      const redirectingState: PhaseState = {
        phase: "REDIRECTING",
        reveal: {
          completedRound: 2,
          eliminatedMapIds: [],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(9),
      };

      const next = phaseReducer(redirectingState, winnerEvent);
      expect(next).toBe(redirectingState);
    });
  });

  // -------------------------------------------------------------------
  // REVEAL_TIMER_ELAPSED
  // -------------------------------------------------------------------
  describe("REVEAL_TIMER_ELAPSED", () => {
    const timerEvent: PhaseEvent = { type: "REVEAL_TIMER_ELAPSED" };

    it("transitions from REVEALING back to VOTING", () => {
      const revealingState: PhaseState = {
        phase: "REVEALING",
        reveal: {
          completedRound: 1,
          eliminatedMapIds: [fakeSessionMapId(1)],
          outcome: "ROUND_ADVANCED",
        },
      };

      const next = phaseReducer(revealingState, timerEvent);
      expect(next).toEqual({ phase: "VOTING" });
    });

    it("is a no-op from VOTING (non-REVEALING state)", () => {
      const next = phaseReducer(INITIAL_PHASE_STATE, timerEvent);
      expect(next).toBe(INITIAL_PHASE_STATE);
    });

    it("is a no-op from WINNER_REVEAL (non-REVEALING state)", () => {
      const winnerState: PhaseState = {
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(5),
      };

      const next = phaseReducer(winnerState, timerEvent);
      expect(next).toBe(winnerState);
    });

    it("is a no-op from REDIRECTING (non-REVEALING state)", () => {
      const redirectingState: PhaseState = {
        phase: "REDIRECTING",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(5),
      };

      const next = phaseReducer(redirectingState, timerEvent);
      expect(next).toBe(redirectingState);
    });
  });

  // -------------------------------------------------------------------
  // WINNER_REVEAL_ELAPSED
  // -------------------------------------------------------------------
  describe("WINNER_REVEAL_ELAPSED", () => {
    const elapsedEvent: PhaseEvent = { type: "WINNER_REVEAL_ELAPSED" };

    it("transitions from WINNER_REVEAL to REDIRECTING, preserving reveal and winnerMapId", () => {
      const winnerState: PhaseState = {
        phase: "WINNER_REVEAL",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [fakeSessionMapId(1), fakeSessionMapId(2)],
          outcome: "RANDOM_WINNER",
        },
        winnerMapId: fakeSessionMapId(10),
      };

      const next = phaseReducer(winnerState, elapsedEvent);

      expect(next).toEqual({
        phase: "REDIRECTING",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [fakeSessionMapId(1), fakeSessionMapId(2)],
          outcome: "RANDOM_WINNER",
        },
        winnerMapId: fakeSessionMapId(10),
      });
    });

    it("is a no-op from VOTING (non-WINNER_REVEAL state)", () => {
      const next = phaseReducer(INITIAL_PHASE_STATE, elapsedEvent);
      expect(next).toBe(INITIAL_PHASE_STATE);
    });

    it("is a no-op from REVEALING (non-WINNER_REVEAL state)", () => {
      const revealingState: PhaseState = {
        phase: "REVEALING",
        reveal: {
          completedRound: 1,
          eliminatedMapIds: [],
          outcome: "REVOTE",
        },
      };

      const next = phaseReducer(revealingState, elapsedEvent);
      expect(next).toBe(revealingState);
    });

    it("is a no-op from REDIRECTING (non-WINNER_REVEAL state)", () => {
      const redirectingState: PhaseState = {
        phase: "REDIRECTING",
        reveal: {
          completedRound: 3,
          eliminatedMapIds: [],
          outcome: "WINNER",
        },
        winnerMapId: fakeSessionMapId(5),
      };

      const next = phaseReducer(redirectingState, elapsedEvent);
      expect(next).toBe(redirectingState);
    });
  });
});
