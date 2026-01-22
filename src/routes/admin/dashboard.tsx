import { createFileRoute, Link } from "@tanstack/react-router";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Loader2 } from "lucide-react";
import { SessionCard } from "@/components/session/session-card";
import { CompletedSessionRow } from "@/components/session/completed-session-row";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

const INITIAL_ACTIVE_ITEMS = 12;
const LOAD_MORE_ACTIVE_ITEMS = 12;
const INITIAL_INACTIVE_ITEMS = 10;
const LOAD_MORE_INACTIVE_ITEMS = 10;

function DashboardPage() {
  // Active sessions (server filters out COMPLETE and EXPIRED)
  const {
    results: activeSessions,
    status: activeStatus,
    loadMore: loadMoreActive,
  } = usePaginatedQuery(
    api.sessions.listSessionsForDashboard,
    {},
    { initialNumItems: INITIAL_ACTIVE_ITEMS }
  );

  // Completed sessions (uses by_status index)
  const {
    results: completedSessions,
    status: completedStatus,
    loadMore: loadMoreCompleted,
  } = usePaginatedQuery(
    api.sessions.listSessionsForDashboard,
    { status: "COMPLETE" },
    { initialNumItems: INITIAL_INACTIVE_ITEMS }
  );

  // Expired sessions (uses by_status index)
  const {
    results: expiredSessions,
    status: expiredStatus,
    loadMore: loadMoreExpired,
  } = usePaginatedQuery(
    api.sessions.listSessionsForDashboard,
    { status: "EXPIRED" },
    { initialNumItems: INITIAL_INACTIVE_ITEMS }
  );

  const isLoading = activeStatus === "LoadingFirstPage";
  const inactiveSessions = [...completedSessions, ...expiredSessions];
  const inactiveCount = inactiveSessions.length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-4 py-4 pl-16 md:px-8 md:pl-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <Button
            size="default"
            className="gap-2"
            render={<Link to="/admin/create" />}
          >
            <Plus className="w-4 h-4" />
            Create Session
          </Button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 md:px-8 md:py-8 space-y-8">
        {/* Active Sessions Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Active Sessions</h2>
            {activeSessions.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {activeSessions.length} total
              </span>
            )}
          </div>

          {activeSessions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                  />
                ))}
              </div>

              {activeStatus === "CanLoadMore" && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => loadMoreActive(LOAD_MORE_ACTIVE_ITEMS)}
                  >
                    Load More
                  </Button>
                </div>
              )}

              {activeStatus === "LoadingMore" && (
                <div className="flex justify-center pt-2">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Completed & Expired Sessions Section */}
        {(inactiveCount > 0 ||
          completedStatus === "LoadingFirstPage" ||
          expiredStatus === "LoadingFirstPage") && (
          <Accordion>
            <AccordionItem>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-muted-foreground">
                    Completed & Expired
                  </span>
                  {inactiveCount > 0 && (
                    <span className="text-sm text-muted-foreground/60">
                      ({inactiveCount})
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {completedStatus === "LoadingFirstPage" &&
                expiredStatus === "LoadingFirstPage" ? (
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <CompletedSessionRowSkeleton key={i} />
                    ))}
                  </div>
                ) : inactiveCount === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No completed or expired sessions yet.
                  </p>
                ) : (
                  <div className="space-y-2 pt-2">
                    {inactiveSessions.map((session) => (
                      <CompletedSessionRow
                        key={session._id}
                        session={session}
                      />
                    ))}

                    {(completedStatus === "CanLoadMore" ||
                      expiredStatus === "CanLoadMore") && (
                      <div className="flex justify-center pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (completedStatus === "CanLoadMore") {
                              loadMoreCompleted(LOAD_MORE_INACTIVE_ITEMS);
                            }
                            if (expiredStatus === "CanLoadMore") {
                              loadMoreExpired(LOAD_MORE_INACTIVE_ITEMS);
                            }
                          }}
                        >
                          Load More
                        </Button>
                      </div>
                    )}

                    {(completedStatus === "LoadingMore" ||
                      expiredStatus === "LoadingMore") && (
                      <div className="flex justify-center pt-4">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-24 h-24 text-muted-foreground/50"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        No active sessions
      </h2>
      <p className="text-muted-foreground mb-6 text-center max-w-sm">
        Get started by creating your first voting session
      </p>
      <Button
        size="lg"
        className="gap-2"
        render={<Link to="/admin/create" />}
      >
        <Plus className="w-5 h-5" />
        Create Session
      </Button>
    </div>
  );
}

function CompletedSessionRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-5 w-16 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
      <div className="h-8 w-8 bg-muted rounded" />
    </div>
  );
}
