/**
 * Auth Module
 *
 * Convex Auth runtime exports (signIn, signOut, etc).
 */
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
