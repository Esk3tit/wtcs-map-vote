import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const TEAM_COLORS = [
  "bg-red-500/20 text-red-600 dark:text-red-400",
  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  "bg-green-500/20 text-green-600 dark:text-green-400",
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  "bg-pink-500/20 text-pink-600 dark:text-pink-400",
  "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
  "bg-orange-500/20 text-orange-600 dark:text-orange-400",
] as const;

function getTeamColorClass(name: string): string {
  const hash = Array.from(name).reduce(
    (acc, char, i) => acc + (char.codePointAt(0) ?? 0) * (i + 1),
    name.length,
  );
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

function getTeamInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    const first = Array.from(words[0])[0] ?? "";
    const second = Array.from(words[1])[0] ?? "";
    return (first + second).toUpperCase();
  }
  const chars = Array.from(name);
  return chars.slice(0, 2).join("").toUpperCase();
}

interface TeamAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function TeamAvatar({
  name,
  logoUrl,
  size = "default",
  className,
}: TeamAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {logoUrl && <AvatarImage src={logoUrl} alt={`${name} logo`} />}
      <AvatarFallback className={cn(getTeamColorClass(name), "font-semibold")}>
        {getTeamInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
