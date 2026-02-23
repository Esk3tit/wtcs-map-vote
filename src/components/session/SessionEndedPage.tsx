import { Card } from "@/components/ui/card";
import { type LucideIcon, Clock, Ban } from "lucide-react";

export type SessionEndReason = "EXPIRED" | "ENDED_BY_ADMIN" | "DELETED";

const reasonMessages: Record<
  SessionEndReason,
  { title: string; message: string; icon: LucideIcon }
> = {
  EXPIRED: {
    title: "Session Expired",
    message:
      "This voting session has expired. Contact your tournament administrator for details.",
    icon: Clock,
  },
  ENDED_BY_ADMIN: {
    title: "Session Ended",
    message:
      "This voting session was ended by the administrator. Contact your tournament administrator for details.",
    icon: Ban,
  },
  DELETED: {
    title: "Session Not Available",
    message:
      "This voting session is no longer available. It may have been removed by the tournament administrator.",
    icon: Ban,
  },
};

export function SessionEndedPage({ reason }: { reason: SessionEndReason }) {
  const { title, message, icon: Icon } = reasonMessages[reason];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center space-y-4">
        <Icon className="h-12 w-12 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
