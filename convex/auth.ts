/**
 * Auth Module
 *
 * Convex Auth runtime exports (signIn, signOut, etc).
 * Providers will be added in WAR-24 (Google OAuth).
 */
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [],
});
