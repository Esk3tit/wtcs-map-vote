import { Link } from "@tanstack/react-router";
import type { SessionCardData } from "./session-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface CompletedSessionRowProps {
  session: SessionCardData;
}

export function CompletedSessionRow({ session }: CompletedSessionRowProps) {
  const teamDisplay =
    session.teams.length >= 2
      ? `${session.teams[0]} vs ${session.teams[1]}`
      : session.teams.length === 1
        ? session.teams[0]
        : "No teams assigned";

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="text-xs">
          {session.status === "COMPLETE" ? "Completed" : "Expired"}
        </Badge>
        <span className="font-medium">{session.matchName}</span>
        <span className="text-sm text-muted-foreground">{teamDisplay}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link
            to="/admin/session/$sessionId"
            params={{ sessionId: session._id }}
          />
        }
      >
        <Eye className="w-4 h-4" />
      </Button>
    </div>
  );
}
