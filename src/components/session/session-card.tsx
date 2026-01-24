import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  formatTeamDisplay,
  getStatusColor,
  formatStatus,
  formatRelativeTime,
} from "./utils";

export interface SessionCardData
  extends Pick<
    Doc<"sessions">,
    "_id" | "_creationTime" | "matchName" | "format" | "status" | "playerCount"
  > {
  assignedPlayerCount: number;
  teams: string[];
}

interface SessionCardProps {
  session: SessionCardData;
}

export function SessionCard({ session }: SessionCardProps) {
  const teamDisplay = formatTeamDisplay(session.teams);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold text-foreground">
            {session.matchName}
          </CardTitle>
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {session.format}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{teamDisplay}</p>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`${getStatusColor(session.status)} font-medium`}
          >
            {formatStatus(session.status)}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Players</span>
            <span className="font-medium text-foreground">
              {session.assignedPlayerCount}/{session.playerCount} assigned
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium text-foreground">
              {formatRelativeTime(session._creationTime)}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/30">
        <Button
          variant="secondary"
          size="sm"
          className="w-full gap-2"
          render={
            <Link
              to="/admin/session/$sessionId"
              params={{ sessionId: session._id }}
            />
          }
        >
          <Eye className="w-4 h-4" />
          View
        </Button>
      </CardFooter>
    </Card>
  );
}
