import { isRateLimitError } from "@convex-dev/rate-limiter";

/**
 * Extract a user-friendly error message from a Convex mutation error.
 * Handles rate limit errors with a specific message, falls back to
 * the error's message or a default.
 */
export function getMutationErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (isRateLimitError(error)) {
    return "Too many requests. Please wait a moment and try again.";
  }
  return error instanceof Error ? error.message : fallback;
}
