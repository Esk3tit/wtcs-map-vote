import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export type TokenError =
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "SESSION_NOT_FOUND"
  | "TOKEN_NOT_ACTIVATED"
  | "IP_MISMATCH"
  | "SESSION_NOT_ACTIVE"
  | "NETWORK_ERROR";

export function TokenErrorPage({ error }: { error: TokenError }) {
  const errorMessages: Record<TokenError, { title: string; message: string }> = {
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
    TOKEN_NOT_ACTIVATED: {
      title: "Connecting...",
      message:
        "Your session is being verified. If this persists, please refresh the page.",
    },
    IP_MISMATCH: {
      title: "Session Locked to Another Device",
      message:
        "This session is locked to a different device. Each access link can only be used from one device.",
    },
    SESSION_NOT_ACTIVE: {
      title: "Session Not Active",
      message:
        "This voting session is no longer active. It may have been completed or expired.",
    },
    NETWORK_ERROR: {
      title: "Connection Error",
      message:
        "Unable to connect to the server. Please check your internet connection and try again.",
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
