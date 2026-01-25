import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export function TokenErrorPage({ error }: { error: string }) {
  const errorMessages: Record<string, { title: string; message: string }> = {
    INVALID_TOKEN: {
      title: "Invalid Access Code",
      message:
        "This access code is invalid or has been revoked. Please contact your tournament administrator for a new link.",
    },
    TOKEN_EXPIRED: {
      title: "Access Code Expired",
      message:
        "This access code has expired. Please request a new link from your tournament administrator.",
    },
    SESSION_NOT_FOUND: {
      title: "Session Not Found",
      message:
        "The voting session could not be found. It may have been deleted.",
    },
  };

  const { title, message } = errorMessages[error] ?? {
    title: "Error",
    message: "An unexpected error occurred.",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
