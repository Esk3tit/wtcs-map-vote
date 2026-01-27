/**
 * Admins Module
 *
 * Handles admin user management including whitelist CRUD operations.
 */

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

import {
  getCurrentAdmin,
  requireAdmin,
  requireRootAdmin,
  normalizeEmail,
} from "./lib/auth";
import { logAdminAction } from "./lib/adminAudit";

// ============================================================================
// Private Helpers
// ============================================================================

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

  for (const session of sessions) {
    await ctx.db.delete(session._id);
  }

  return sessions.length;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get the currently authenticated user's info.
 * Returns null if not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      name: v.string(),
      email: v.optional(v.string()),
      picture: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return {
      name: identity.name ?? "Admin",
      email: identity.email ?? undefined,
      picture: identity.pictureUrl ?? undefined,
    };
  },
});

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
    return await getCurrentAdmin(ctx);
  },
});

/**
 * Get the first admin in the database.
 * Temporary solution until auth is integrated.
 */
export const getFirstAdmin = query({
  args: {},
  returns: v.union(v.id("admins"), v.null()),
  handler: async (ctx) => {
    const admin = await ctx.db.query("admins").first();
    return admin?._id ?? null;
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
    return await ctx.db.query("admins").collect();
  },
});

/**
 * Check if an email is whitelisted (for login flow).
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
    const currentAdmin = await requireRootAdmin(ctx);
    const normalizedEmail = normalizeEmail(args.email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Invalid email format");
    }

    // Check for duplicate
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();
    if (existing) {
      throw new Error("Admin with this email already exists");
    }

    // Validate name
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Name is required");
    }

    const adminId = await ctx.db.insert("admins", {
      email: normalizedEmail,
      name: trimmedName,
      isRootAdmin: args.isRootAdmin ?? false,
      lastLoginAt: 0,
    });

    await logAdminAction(ctx, {
      action: "ADMIN_ADDED",
      actorId: currentAdmin._id,
      actorEmail: currentAdmin.email,
      targetId: adminId,
      targetEmail: normalizedEmail,
      details: {
        isRootAdmin: args.isRootAdmin ?? false,
        targetName: trimmedName,
      },
    });

    return { adminId };
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
    const currentAdmin = await requireRootAdmin(ctx);
    const targetAdmin = await ctx.db.get(args.adminId);

    if (!targetAdmin) {
      throw new Error("Admin not found");
    }

    // Self-removal check: only if not last root admin
    if (currentAdmin._id === args.adminId && targetAdmin.isRootAdmin) {
      const rootCount = await ctx.db
        .query("admins")
        .filter((q) => q.eq(q.field("isRootAdmin"), true))
        .collect();
      if (rootCount.length === 1) {
        throw new Error("Cannot remove the last root admin");
      }
    }

    // Invalidate the target admin's auth sessions (boot them out)
    const authUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), targetAdmin.email))
      .first();

    if (authUser) {
      await deleteUserSessions(ctx, authUser._id);

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

    return { success: true };
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
    const currentAdmin = await requireRootAdmin(ctx);
    const targetAdmin = await ctx.db.get(args.adminId);

    if (!targetAdmin) {
      throw new Error("Admin not found");
    }

    // No-op if already at target state
    if (targetAdmin.isRootAdmin === args.isRootAdmin) {
      return { success: true };
    }

    // Prevent demoting the last root admin
    if (targetAdmin.isRootAdmin && !args.isRootAdmin) {
      const rootCount = await ctx.db
        .query("admins")
        .filter((q) => q.eq(q.field("isRootAdmin"), true))
        .collect();
      if (rootCount.length === 1) {
        throw new Error("Cannot demote the last root admin");
      }
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

    return { success: true };
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
    const currentAdmin = await requireRootAdmin(ctx);
    const targetAdmin = await ctx.db.get(args.adminId);

    if (!targetAdmin) {
      throw new Error("Admin not found");
    }

    const authUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), targetAdmin.email))
      .first();

    if (!authUser) {
      throw new Error("Admin has no active sessions");
    }

    await deleteUserSessions(ctx, authUser._id);

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

    return { success: true };
  },
});
