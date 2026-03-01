interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "page" | "card";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "page",
}: EmptyStateProps) {
  if (variant === "card") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in duration-300">
        <div className="mb-4 text-muted-foreground/50">{icon}</div>
        <p className="text-lg font-medium text-muted-foreground">{title}</p>
        <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-in fade-in duration-500">
      <div className="w-64 h-64 mb-6 rounded-lg bg-muted/30 flex items-center justify-center">
        {icon}
      </div>
      <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 text-center max-w-sm">
        {description}
      </p>
      {action}
    </div>
  );
}
