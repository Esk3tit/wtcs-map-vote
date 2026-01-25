/**
 * Auth Configuration
 *
 * Configuration for Convex Auth providers and JWT verification.
 */

// Validate required environment variable - fail fast if missing
const siteUrl = process.env.CONVEX_SITE_URL;
if (!siteUrl) {
  throw new Error(
    "CONVEX_SITE_URL environment variable is required for auth configuration"
  );
}

export default {
  providers: [
    {
      domain: siteUrl,
      applicationID: "convex",
    },
  ],
};
