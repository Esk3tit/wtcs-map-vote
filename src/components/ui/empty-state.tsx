import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  className?: string;
} & (
  | {
      variant?: "page";
      action?: ReactNode;
    }
  | {
      variant: "card";
      action?: never;
    }
);

export function EmptyState(props: EmptyStateProps) {
  const { icon, title, description, variant = "page", className } = props;

  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
          className,
        )}
      >
        <div className="mb-4 text-muted-foreground/50">{icon}</div>
        <p className="text-lg font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500",
        className,
      )}
    >
      <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground/50">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-sm">
        {description}
      </p>
      {props.action}
    </div>
  );
}
