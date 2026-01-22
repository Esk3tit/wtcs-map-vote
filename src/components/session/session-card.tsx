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
import type { Id } from "../../../convex/_generated/dataModel";

export interface SessionCardData {
  _id: Id<"sessions">;
  _creationTime: number;
  matchName: string;
  format: "ABBA" | "MULTIPLAYER";
  status:
    | "DRAFT"
    | "WAITING"
    | "IN_PROGRESS"
    | "PAUSED"
    | "COMPLETE"
    | "EXPIRED";
  playerCount: number;
  assignedPlayerCount: number;
  teams: string[];
}

const getStatusColor = (status: SessionCardData["status"]) => {
  switch (status) {
    case "DRAFT":
      return "bg-muted/50 text-muted-foreground border-border";
    case "WAITING":
      return "bg-chart-4/20 text-chart-4 border-chart-4/30";
    case "IN_PROGRESS":
      return "bg-primary/20 text-primary border-primary/30";
    case "PAUSED":
      return "bg-chart-2/20 text-chart-2 border-chart-2/30";
    case "COMPLETE":
      return "bg-green-500/20 text-green-600 border-green-500/30";
    case "EXPIRED":
      return "bg-red-500/20 text-red-600 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const formatTimestamp = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const formatStatus = (status: SessionCardData["status"]) => {
  return status.replace(/_/g, " ");
};

interface SessionCardProps {
  session: SessionCardData;
}

export function SessionCard({ session }: SessionCardProps) {
  const teamDisplay =
    session.teams.length >= 2
      ? `${session.teams[0]} vs ${session.teams[1]}`
      : session.teams.length === 1
        ? session.teams[0]
        : "No teams assigned";

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
              {formatTimestamp(session._creationTime)}
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
