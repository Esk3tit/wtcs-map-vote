/**
 * Admins Module
 *
 * Handles admin user management including whitelist CRUD operations.
 */

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

import {
  getCurrentAdmin,
  requireAdmin,
  requireRootAdmin,
  normalizeEmail,
} from "./lib/auth";
import { logAdminAction } from "./lib/adminAudit";
import { createWideEvent } from "./lib/wideEvent";

// ============================================================================
// Private Helpers
// ============================================================================

/** Strip _creationTime from an admin document to match return validators. */
function toAdminResponse(admin: Doc<"admins">) {
  const { _creationTime, ...rest } = admin;
  return rest;
}

/**
 * Get an admin by ID or throw ConvexError if not found.
 *
 * @param adminId - The admin ID to look up
 */
async function getAdminOrThrow(
  ctx: MutationCtx,
  adminId: Id<"admins">
): Promise<Doc<"admins">> {
  const admin = await ctx.db.get(adminId);
  if (!admin) {
    throw new ConvexError("Admin not found");
  }
  return admin;
}

/**
 * Ensure we're not removing/demoting the last root admin.
 *
 * @param errorMessage - Custom error message to throw
 */
async function ensureNotLastRootAdmin(
  ctx: MutationCtx,
  errorMessage: string
): Promise<void> {
  const rootCount = await ctx.db
    .query("admins")
    .withIndex("by_isRootAdmin", (q) => q.eq("isRootAdmin", true))
    .collect();
  if (rootCount.length === 1) {
    throw new ConvexError(errorMessage);
  }
}

/**
 * Get auth user by email from the users table.
 * Normalizes the email before lookup to ensure consistent matching.
 *
 * @param email - Email address to look up
 */
async function getAuthUserByEmail(
  ctx: MutationCtx,
  email: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .filter((q) => q.eq(q.field("email"), normalizeEmail(email)))
    .first();
}

/**
 * Delete all auth sessions for a user.
 * This invalidates the user's login by removing their session records.
 */
async function deleteUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<number> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();

  await Promise.all(sessions.map((session) => ctx.db.delete(session._id)));

  return sessions.length;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get current authenticated admin with role info.
 * Returns null if not authenticated or not whitelisted.
 */
export const getMe = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("admins"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      isRootAdmin: v.boolean(),
      lastLoginAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const admin = await getCurrentAdmin(ctx);
    return admin ? toAdminResponse(admin) : null;
  },
});

/**
 * List all admins. Requires authenticated admin.
 */
export const listAdmins = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("admins"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      isRootAdmin: v.boolean(),
      lastLoginAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const admins = await ctx.db.query("admins").collect();
    return admins.map(toAdminResponse);
  },
});

/**
 * Get a specific admin by ID. Requires authenticated admin.
 *
 * @param adminId - ID of the admin to fetch
 */
export const getAdmin = query({
  args: { adminId: v.id("admins") },
  returns: v.union(
    v.object({
      _id: v.id("admins"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      isRootAdmin: v.boolean(),
      lastLoginAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const admin = await ctx.db.get(args.adminId);
    return admin ? toAdminResponse(admin) : null;
  },
});

/**
 * Get an admin by email. Requires authenticated admin.
 *
 * @param email - Email address to look up
 */
export const getAdminByEmail = query({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("admins"),
      email: v.string(),
      name: v.string(),
      avatarUrl: v.optional(v.string()),
      isRootAdmin: v.boolean(),
      lastLoginAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const normalized = normalizeEmail(args.email);
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .first();
    return admin ? toAdminResponse(admin) : null;
  },
});

/**
 * Check if an email is whitelisted (for login flow).
 *
 * DESIGN DECISION: This query is intentionally unauthenticated.
 * It is called during the login flow before the user has authenticated,
 * so requiring auth would create a chicken-and-egg problem.
 *
 * Security considerations:
 * - Risk: enables email enumeration (an attacker can probe if an email is whitelisted)
 * - Acceptable at this project's scale (~12 admin users with known emails)
 * - The `afterUserCreatedOrUpdated` callback in `convex/auth.ts` performs
 *   the same whitelist check server-side during OAuth, so this query is
 *   only used for early UI feedback, not as the sole gate
 *
 * @param email - The email address to check
 * @returns Whether the email is whitelisted
 */
export const isEmailWhitelisted = query({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    return admin !== null;
  },
});

/**
 * Get admin audit logs with pagination. Root admin only.
 *
 * @param paginationOpts - Pagination options (numItems, cursor)
 */
export const getAdminAuditLogs = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("adminAuditLogs"),
        _creationTime: v.number(),
        action: v.string(),
        actorId: v.optional(v.id("admins")),
        actorEmail: v.optional(v.string()),
        targetId: v.optional(v.id("admins")),
        targetEmail: v.string(),
        details: v.optional(
          v.object({
            isRootAdmin: v.optional(v.boolean()),
            targetName: v.optional(v.string()),
            message: v.optional(v.string()),
          })
        ),
        timestamp: v.number(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireRootAdmin(ctx);
    return await ctx.db
      .query("adminAuditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Add a new admin to the whitelist. Root admin only.
 *
 * @param email - Email address to whitelist
 * @param name - Display name for the admin
 * @param isRootAdmin - Whether to grant root admin privileges
 */
export const addAdmin = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    isRootAdmin: v.optional(v.boolean()),
  },
  returns: v.object({ adminId: v.id("admins") }),
  handler: async (ctx, args) => {
    const ev = createWideEvent("admins", "addAdmin", "mutation");
    const startTime = Date.now();
    try {
      const currentAdmin = await requireRootAdmin(ctx);
      ev.setAdmin(currentAdmin);
      const normalizedEmail = normalizeEmail(args.email);
      const domain = normalizedEmail.split("@")[1];
      ev.set("targetDomain", domain);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emailFormatValid = emailRegex.test(normalizedEmail);
      ev.set("emailFormatValid", emailFormatValid);
      if (!emailFormatValid) {
        throw new ConvexError("Invalid email format");
      }

      // Check for duplicate
      const existing = await ctx.db
        .query("admins")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      ev.set("duplicateExists", !!existing);
      if (existing) {
        throw new ConvexError("Admin with this email already exists");
      }

      // Validate name
      const trimmedName = args.name.trim();
      const nameValid = trimmedName.length > 0;
      ev.set("nameValid", nameValid);
      if (!nameValid) {
        throw new ConvexError("Name is required");
      }

      const grantedRoot = args.isRootAdmin ?? false;
      ev.set("grantedRoot", grantedRoot);

      const adminId = await ctx.db.insert("admins", {
        email: normalizedEmail,
        name: trimmedName,
        isRootAdmin: grantedRoot,
        lastLoginAt: 0,
      });

      await logAdminAction(ctx, {
        action: "ADMIN_ADDED",
        actorId: currentAdmin._id,
        actorEmail: currentAdmin.email,
        targetId: adminId,
        targetEmail: normalizedEmail,
        details: {
          isRootAdmin: grantedRoot,
          targetName: trimmedName,
        },
      });

      ev.setOutcome("ok");
      return { adminId };
    } catch (err) {
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

/**
 * Remove an admin from the whitelist and invalidate their sessions. Root admin only.
 * Cannot remove yourself if you're the last root admin.
 *
 * @param adminId - ID of admin to remove
 */
export const removeAdmin = mutation({
  args: { adminId: v.id("admins") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const ev = createWideEvent("admins", "removeAdmin", "mutation");
    const startTime = Date.now();
    try {
      const currentAdmin = await requireRootAdmin(ctx);
      ev.setAdmin(currentAdmin);
      const targetAdmin = await getAdminOrThrow(ctx, args.adminId);
      ev.set("targetIsRoot", targetAdmin.isRootAdmin);
      ev.set("selfRemoval", currentAdmin._id === args.adminId);

      // Self-removal check: only if not last root admin
      if (currentAdmin._id === args.adminId && targetAdmin.isRootAdmin) {
        await ensureNotLastRootAdmin(ctx, "Cannot remove the last root admin");
      }

      // Invalidate the target admin's auth sessions (boot them out)
      const authUser = await getAuthUserByEmail(ctx, targetAdmin.email);
      ev.set("authUserFound", !!authUser);

      if (authUser) {
        const sessionsDeletedCount = await deleteUserSessions(ctx, authUser._id);
        ev.set("sessionsDeletedCount", sessionsDeletedCount);

        await logAdminAction(ctx, {
          action: "ADMIN_SESSIONS_INVALIDATED",
          actorId: currentAdmin._id,
          actorEmail: currentAdmin.email,
          targetEmail: targetAdmin.email,
          details: {
            targetName: targetAdmin.name,
            message: "Sessions invalidated during admin removal",
          },
        });
      }

      await ctx.db.delete(args.adminId);

      await logAdminAction(ctx, {
        action: "ADMIN_REMOVED",
        actorId: currentAdmin._id,
        actorEmail: currentAdmin.email,
        targetEmail: targetAdmin.email,
        details: {
          isRootAdmin: targetAdmin.isRootAdmin,
          targetName: targetAdmin.name,
        },
      });

      ev.setOutcome("ok");
      return { success: true };
    } catch (err) {
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

/**
 * Update admin's root status. Root admin only.
 * Cannot demote yourself if you're the last root admin.
 *
 * @param adminId - ID of admin to update
 * @param isRootAdmin - New root admin status
 */
export const updateAdminRole = mutation({
  args: {
    adminId: v.id("admins"),
    isRootAdmin: v.boolean(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const ev = createWideEvent("admins", "updateAdminRole", "mutation");
    const startTime = Date.now();
    try {
      const currentAdmin = await requireRootAdmin(ctx);
      ev.setAdmin(currentAdmin);
      const targetAdmin = await getAdminOrThrow(ctx, args.adminId);
      ev.set("previousRole", targetAdmin.isRootAdmin ? "root" : "admin");
      ev.set("newRole", args.isRootAdmin ? "root" : "admin");

      // No-op if already at target state
      if (targetAdmin.isRootAdmin === args.isRootAdmin) {
        ev.set("noopReason", "already_at_target");
        ev.setOutcome("noop");
        return { success: true };
      }

      // Prevent demoting the last root admin
      if (targetAdmin.isRootAdmin && !args.isRootAdmin) {
        await ensureNotLastRootAdmin(ctx, "Cannot demote the last root admin");
      }

      await ctx.db.patch(args.adminId, { isRootAdmin: args.isRootAdmin });

      const action = args.isRootAdmin ? "ADMIN_PROMOTED" : "ADMIN_DEMOTED";
      await logAdminAction(ctx, {
        action,
        actorId: currentAdmin._id,
        actorEmail: currentAdmin.email,
        targetId: args.adminId,
        targetEmail: targetAdmin.email,
        details: {
          isRootAdmin: args.isRootAdmin,
          targetName: targetAdmin.name,
        },
      });

      ev.setOutcome("ok");
      return { success: true };
    } catch (err) {
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});

/**
 * Invalidate all sessions for a specific admin. Root admin only.
 * Use this to force logout an admin without removing them.
 *
 * @param adminId - ID of admin to force logout
 */
export const invalidateAdminSessions = mutation({
  args: { adminId: v.id("admins") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const ev = createWideEvent("admins", "invalidateAdminSessions", "mutation");
    const startTime = Date.now();
    try {
      const currentAdmin = await requireRootAdmin(ctx);
      ev.setAdmin(currentAdmin);
      const targetAdmin = await getAdminOrThrow(ctx, args.adminId);

      const authUser = await getAuthUserByEmail(ctx, targetAdmin.email);
      ev.set("authUserFound", !!authUser);

      if (!authUser) {
        throw new ConvexError("Admin has no active sessions");
      }

      const sessionsDeletedCount = await deleteUserSessions(ctx, authUser._id);
      ev.set("sessionsDeletedCount", sessionsDeletedCount);

      await logAdminAction(ctx, {
        action: "ADMIN_SESSIONS_INVALIDATED",
        actorId: currentAdmin._id,
        actorEmail: currentAdmin.email,
        targetId: args.adminId,
        targetEmail: targetAdmin.email,
        details: {
          targetName: targetAdmin.name,
          message: "Manual session invalidation by root admin",
        },
      });

      ev.setOutcome("ok");
      return { success: true };
    } catch (err) {
      ev.setError(err, err instanceof ConvexError ? "business" : "system");
      throw err;
    } finally {
      ev.setDuration(startTime);
      ev.emit();
    }
  },
});
