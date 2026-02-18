import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";
import type { SessionStatus } from "../../convex/lib/constants";

/**
 * Minimal shape of the session data needed for redirect decisions.
 * Matches the union returned by `getSessionByToken`.
 */
export type SessionQueryData =
  | {
      status: "valid";
      session: {
        _id: Id<"sessions">;
        status: SessionStatus;
      };
    }
  | { status: "error" };

/** Returns true when the current page should redirect for the given status. */
function shouldRedirect(
  currentPage: "lobby" | "vote" | "results",
  status: SessionStatus
): boolean {
  switch (currentPage) {
    case "lobby":
      return status === "IN_PROGRESS" || status === "COMPLETE";
    case "vote":
      return (
        status === "COMPLETE" || status === "DRAFT" || status === "WAITING"
      );
    case "results":
      return status === "WAITING" || status === "DRAFT";
    default: {
      const _exhaustive: never = currentPage;
      throw new Error(`Unhandled page: ${_exhaustive}`);
    }
  }
}

/**
 * Auto-redirect players based on session status changes.
 * Must be called unconditionally (before early returns).
 *
 * Uses `useEffect` + `useNavigate` instead of TanStack Router's `<Navigate>`
 * component because `shouldRedirect` evaluates `data`, `token`, and
 * `currentPage` to fire an immediate side-effect, and the hook must return
 * an `isRedirecting` render-guard boolean that `<Navigate>` cannot provide.
 *
 * @param data - Reactive session data from useQuery(getSessionByToken)
 * @param token - Player's auth token
 * @param currentPage - Which page this hook is called from
 * @returns isRedirecting - True when a redirect is pending (use as render guard)
 */
export function useSessionStatusRedirect(
  data: SessionQueryData | undefined,
  token: string | undefined,
  currentPage: "lobby" | "vote" | "results"
): boolean {
  const navigate = useNavigate();

  useEffect(() => {
    if (!data || data.status !== "valid" || !token) return;

    const { session } = data;
    if (!shouldRedirect(currentPage, session.status)) return;

    if (currentPage === "lobby") {
      if (session.status === "IN_PROGRESS") {
        navigate({ to: "/vote/$token", params: { token }, replace: true });
      } else if (session.status === "COMPLETE") {
        navigate({
          to: "/results/$sessionId",
          params: { sessionId: session._id },
          search: { token },
          replace: true,
        });
      }
    } else if (currentPage === "vote") {
      if (session.status === "COMPLETE") {
        navigate({
          to: "/results/$sessionId",
          params: { sessionId: session._id },
          search: { token },
          replace: true,
        });
      } else if (session.status === "DRAFT" || session.status === "WAITING") {
        navigate({ to: "/lobby/$token", params: { token }, replace: true });
      }
    } else if (currentPage === "results") {
      navigate({ to: "/lobby/$token", params: { token }, replace: true });
    }
  }, [data, navigate, token, currentPage]);

  // Render guard: true when a redirect is pending
  if (!data || data.status !== "valid" || !token) return false;
  return shouldRedirect(currentPage, data.session.status);
}
