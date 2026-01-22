import { Link } from "@tanstack/react-router";
import type { SessionCardData } from "./session-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { formatTeamDisplay } from "./utils";

interface CompletedSessionRowProps {
  session: SessionCardData;
}

export function CompletedSessionRow({ session }: CompletedSessionRowProps) {
  const teamDisplay = formatTeamDisplay(session.teams);

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
        <span className="sr-only">View session</span>
      </Button>
    </div>
  );
}
