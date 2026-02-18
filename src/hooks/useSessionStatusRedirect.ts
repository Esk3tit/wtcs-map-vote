import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Minimal shape of the session data needed for redirect decisions.
 * Matches the union returned by `getSessionByToken`.
 */
type SessionQueryData =
  | {
      status: "valid";
      session: {
        _id: Id<"sessions">;
        status:
          | "DRAFT"
          | "WAITING"
          | "IN_PROGRESS"
          | "PAUSED"
          | "COMPLETE"
          | "EXPIRED";
      };
    }
  | { status: "error" };

/**
 * Auto-redirect players based on session status changes.
 * Must be called unconditionally (before early returns).
 *
 * @param data - Reactive session data from useQuery(getSessionByToken)
 * @param token - Player's auth token
 * @param currentPage - Which page this hook is called from
 * @returns isRedirecting - True when a redirect is pending (use as render guard)
 */
export function useSessionStatusRedirect(
  data: SessionQueryData | undefined,
  token: string,
  currentPage: "lobby" | "vote" | "results"
): boolean {
  const navigate = useNavigate();

  useEffect(() => {
    if (!data || data.status !== "valid") return;

    const { session } = data;

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
      if (session.status === "WAITING" || session.status === "DRAFT") {
        navigate({ to: "/lobby/$token", params: { token }, replace: true });
      }
    }
  }, [data, navigate, token, currentPage]);

  // Return whether a redirect is pending (for render guards)
  if (!data || data.status !== "valid") return false;

  const { session } = data;

  if (currentPage === "lobby") {
    return session.status === "IN_PROGRESS" || session.status === "COMPLETE";
  }
  if (currentPage === "vote") {
    return (
      session.status === "COMPLETE" ||
      session.status === "DRAFT" ||
      session.status === "WAITING"
    );
  }
  if (currentPage === "results") {
    return session.status === "WAITING" || session.status === "DRAFT";
  }

  return false;
}
