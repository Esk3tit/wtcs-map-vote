/**
 * Auth Module
 *
 * Convex Auth runtime exports (signIn, signOut, etc) with whitelist validation.
 */
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import { normalizeEmail } from "./lib/auth";
import { logAdminAction } from "./lib/adminAudit";

/**
 * Safely extracts a string value from an unknown profile field.
 * Returns the value if it's a non-empty string, otherwise returns undefined.
 */
function extractProfileString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    /**
     * Custom callback after user creation/update.
     * Implements whitelist validation and first-user-is-root seeding.
     */
    async afterUserCreatedOrUpdated(ctx, args) {
      const email = args.profile?.email;
      if (!email) {
        throw new ConvexError("Email is required for authentication");
      }

      const normalizedEmail = normalizeEmail(email);

      // Cast ctx to typed MutationCtx for schema-aware index access
      const db = (ctx as unknown as MutationCtx).db;

      // Check if this email is whitelisted
      const existingAdmin = await db
        .query("admins")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();

      // Check if ANY admin exists (for first-user seeding)
      const anyAdmin = await db.query("admins").first();

      if (existingAdmin) {
        // Update profile data and lastLoginAt
        await db.patch(existingAdmin._id, {
          name: extractProfileString(args.profile.name) ?? existingAdmin.name,
          avatarUrl:
            extractProfileString(args.profile.image) ?? existingAdmin.avatarUrl,
          lastLoginAt: Date.now(),
        });
        return;
      }

      if (!anyAdmin) {
        // First user becomes root admin
        const profileName = extractProfileString(args.profile.name);
        const adminId = await db.insert("admins", {
          email: normalizedEmail,
          name: profileName ?? "Root Admin",
          avatarUrl: extractProfileString(args.profile.image),
          isRootAdmin: true,
          lastLoginAt: Date.now(),
        });

        // Audit log for system bootstrap
        await logAdminAction(ctx, {
          action: "SYSTEM_BOOTSTRAP",
          targetId: adminId,
          targetEmail: normalizedEmail,
          details: {
            isRootAdmin: true,
            targetName: profileName ?? "Root Admin",
            message: "First admin created as root admin",
          },
        });

        return;
      }

      // Not whitelisted and not first user - throw to prevent sign-in
      throw new ConvexError(
        "Your email is not authorized. Contact an administrator for access."
      );
    },
  },
});
