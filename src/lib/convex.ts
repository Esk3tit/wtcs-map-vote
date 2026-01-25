/**
 * Convex React Helpers
 *
 * Re-exports Convex hooks and generated API for cleaner imports.
 * Import from "@/lib/convex" instead of multiple sources.
 */

// React hooks
export {
  useQuery,
  useMutation,
  usePaginatedQuery,
  useConvex,
  useConvexAuth,
  useQueries,
} from "convex/react";

// Generated API
export { api } from "../../convex/_generated/api";

// Type exports
export type { Id, Doc } from "../../convex/_generated/dataModel";
