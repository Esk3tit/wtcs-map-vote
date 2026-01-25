/**
 * Auth Configuration
 *
 * Configuration for Convex Auth providers and JWT verification.
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
