/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data consistently.
 */

/**
 * Factory for admin test data.
 */
export const adminFactory = (
  overrides: Partial<{
    email: string;
    name: string;
    avatarUrl: string;
    isRootAdmin: boolean;
    lastLoginAt: number;
  }> = {}
) => ({
  email: overrides.email ?? "admin@test.com",
  name: overrides.name ?? "Test Admin",
  avatarUrl: overrides.avatarUrl,
  isRootAdmin: overrides.isRootAdmin ?? false,
  lastLoginAt: overrides.lastLoginAt ?? Date.now(),
});

/**
 * Factory for team test data.
 */
export const teamFactory = (
  overrides: Partial<{
    name: string;
    logoUrl: string;
    updatedAt: number;
  }> = {}
) => ({
  name: overrides.name ?? "Test Team",
  logoUrl: overrides.logoUrl,
  updatedAt: overrides.updatedAt ?? Date.now(),
});

/**
 * Factory for map test data.
 */
export const mapFactory = (
  overrides: Partial<{
    name: string;
    imageUrl: string;
    isActive: boolean;
    updatedAt: number;
  }> = {}
) => ({
  name: overrides.name ?? "Test Map",
  imageUrl: overrides.imageUrl,
  isActive: overrides.isActive ?? true,
  updatedAt: overrides.updatedAt ?? Date.now(),
});

/**
 * Factory for session test data.
 */
export const sessionFactory = (
  overrides: Partial<{
    matchName: string;
    format: "ABBA" | "MULTIPLAYER";
    status:
      | "DRAFT"
      | "WAITING"
      | "IN_PROGRESS"
      | "PAUSED"
      | "COMPLETE"
      | "EXPIRED";
    turnTimerSeconds: number;
    mapPoolSize: number;
    playerCount: number;
    currentTurn: number;
    currentRound: number;
    updatedAt: number;
    expiresAt: number;
  }> = {}
) => ({
  matchName: overrides.matchName ?? "Test Match",
  format: overrides.format ?? "ABBA",
  status: overrides.status ?? "DRAFT",
  turnTimerSeconds: overrides.turnTimerSeconds ?? 30,
  mapPoolSize: overrides.mapPoolSize ?? 7,
  playerCount: overrides.playerCount ?? 2,
  currentTurn: overrides.currentTurn ?? 0,
  currentRound: overrides.currentRound ?? 0,
  updatedAt: overrides.updatedAt ?? Date.now(),
  expiresAt: overrides.expiresAt ?? Date.now() + 24 * 60 * 60 * 1000,
});
