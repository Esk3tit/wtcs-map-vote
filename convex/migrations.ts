/**
 * Database Migrations
 *
 * Defines and runs stateful migrations for schema evolution.
 * Migrations process documents in batches and track progress.
 *
 * Run via CLI:
 *   npx convex run migrations:run
 *   npx convex run migrations:run '{dryRun: true}'
 *
 * Check status:
 *   npx convex run --component migrations lib:getStatus --watch
 */

import { Migrations } from "@convex-dev/migrations";

import { components } from "./_generated/api.js";
import type { DataModel } from "./_generated/dataModel.js";
import { ACTIVE_SESSION_STATUSES } from "./lib/constants";

const migrations = new Migrations<DataModel>(components.migrations);

export const run = migrations.runner();

// ============================================================================
// Migration Definitions
// ============================================================================

/**
 * Backfill isActive field on sessions table.
 *
 * Sets isActive=true for DRAFT/WAITING/IN_PROGRESS/PAUSED,
 * isActive=false for COMPLETE/EXPIRED.
 */
export const backfillSessionIsActive = migrations.define({
  table: "sessions",
  migrateOne: async (_ctx, doc) => {
    if (doc.isActive !== undefined) return;
    return { isActive: ACTIVE_SESSION_STATUSES.has(doc.status) };
  },
});
