import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { SessionCard, type SessionCardData } from "@/components/session/session-card";
import { CompletedSessionRow } from "@/components/session/completed-session-row";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

const ACTIVE_PAGE_SIZE = 9;
const INACTIVE_PAGE_SIZE = 10;

function DashboardPage() {
  const [activePage, setActivePage] = useState(1);
  const [inactivePage, setInactivePage] = useState(1);

  // Query 1: Get all session IDs (lightweight)
  const activeIds = useQuery(api.sessions.listActiveSessionIds);
  const inactiveIds = useQuery(api.sessions.listInactiveSessionIds);

  // Calculate pagination from IDs
  const activeTotalCount = activeIds?.length ?? 0;
  const activeTotalPages = Math.ceil(activeTotalCount / ACTIVE_PAGE_SIZE);
  const inactiveTotalCount = inactiveIds?.length ?? 0;
  const inactiveTotalPages = Math.ceil(inactiveTotalCount / INACTIVE_PAGE_SIZE);

  // Slice IDs for current page
  const activePageIds = useMemo(() => {
    if (!activeIds) return [];
    const start = (activePage - 1) * ACTIVE_PAGE_SIZE;
    return activeIds.slice(start, start + ACTIVE_PAGE_SIZE);
  }, [activeIds, activePage]);

  const inactivePageIds = useMemo(() => {
    if (!inactiveIds) return [];
    const start = (inactivePage - 1) * INACTIVE_PAGE_SIZE;
    return inactiveIds.slice(start, start + INACTIVE_PAGE_SIZE);
  }, [inactiveIds, inactivePage]);

  // Query 2: Fetch full session data for current page IDs
  const activeSessions = useQuery(
    api.sessions.getSessionsByIds,
    activePageIds.length > 0 ? { ids: activePageIds } : "skip"
  );
  const inactiveSessions = useQuery(
    api.sessions.getSessionsByIds,
    inactivePageIds.length > 0 ? { ids: inactivePageIds } : "skip"
  );

  const isLoading = activeIds === undefined;
  const hasNoActiveSessions = activeTotalCount === 0;

  // Reset to page 1 if current page becomes invalid
  if (activePage > activeTotalPages && activeTotalPages > 0) {
    setActivePage(1);
  }
  if (inactivePage > inactiveTotalPages && inactiveTotalPages > 0) {
    setInactivePage(1);
  }

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
            {activeTotalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {activeTotalCount} total
              </span>
            )}
          </div>

          {hasNoActiveSessions ? (
            <EmptyState />
          ) : activeSessions === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: activePageIds.length }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session as SessionCardData}
                  />
                ))}
              </div>

              {activeTotalPages > 1 && (
                <Pagination
                  currentPage={activePage}
                  totalPages={activeTotalPages}
                  onPageChange={setActivePage}
                />
              )}
            </>
          )}
        </section>

        {/* Completed/Expired Sessions Section */}
        {inactiveTotalCount > 0 && (
          <Accordion>
            <AccordionItem>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-muted-foreground">
                    Completed & Expired
                  </span>
                  <span className="text-sm text-muted-foreground/60">
                    ({inactiveTotalCount})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {inactiveSessions === undefined ? (
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: inactivePageIds.length }).map(
                      (_, i) => (
                        <CompletedSessionRowSkeleton key={i} />
                      )
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    {inactiveSessions.map((session) => (
                      <CompletedSessionRow
                        key={session._id}
                        session={session as SessionCardData}
                      />
                    ))}
                  </div>
                )}

                {inactiveTotalPages > 1 && (
                  <Pagination
                    currentPage={inactivePage}
                    totalPages={inactiveTotalPages}
                    onPageChange={setInactivePage}
                  />
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </main>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {getPageNumbers().map((page, idx) =>
        page === "..." ? (
          <span
            key={`ellipsis-${idx}`}
            className="px-2 text-muted-foreground"
          >
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? "default" : "outline"}
            size="icon"
            onClick={() => onPageChange(page)}
            className="h-8 w-8"
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
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

function SessionCardSkeleton() {
  return (
    <Card className="border-border/50 bg-card/50 animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="h-6 w-32 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded" />
        </div>
        <div className="h-4 w-24 bg-muted rounded mt-2" />
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <div className="h-5 w-20 bg-muted rounded" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-full bg-muted rounded" />
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t border-border/30">
        <div className="h-8 w-full bg-muted rounded" />
      </CardFooter>
    </Card>
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
