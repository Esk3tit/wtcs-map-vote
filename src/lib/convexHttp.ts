const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
if (
  !CONVEX_URL ||
  typeof CONVEX_URL !== "string" ||
  !CONVEX_URL.includes(".cloud")
) {
  throw new Error(
    "VITE_CONVEX_URL must be set and contain '.cloud' for HTTP action URL derivation"
  );
}

/** Base URL for Convex HTTP actions (e.g. `https://<deployment>.convex.site`). */
export const SITE_URL: string = CONVEX_URL.replace(".cloud", ".site");
