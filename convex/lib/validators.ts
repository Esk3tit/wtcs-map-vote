import { v } from "convex/values";

/**
 * Validator for session status field.
 * Matches the status union in convex/schema.ts sessions table.
 */
export const sessionStatusValidator = v.union(
  v.literal("DRAFT"),
  v.literal("WAITING"),
  v.literal("IN_PROGRESS"),
  v.literal("PAUSED"),
  v.literal("COMPLETE"),
  v.literal("EXPIRED")
);

/**
 * Validator for session format field.
 * ABBA: 1v1 alternating ban format
 * MULTIPLAYER: Multi-player voting format
 */
export const sessionFormatValidator = v.union(
  v.literal("ABBA"),
  v.literal("MULTIPLAYER")
);

/**
 * Validator for session map state field.
 * Matches the state union in convex/schema.ts sessionMaps table.
 */
export const mapStateValidator = v.union(
  v.literal("AVAILABLE"),
  v.literal("BANNED"),
  v.literal("WINNER")
);
