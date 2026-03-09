/** Normalize a role string to UPPER_SNAKE_CASE for comparison. */
export const normalizeRole = (role: string): string =>
  role.trim().replace(/\s+/g, "_").toUpperCase();

/** Format a player role for display, adding ban order info for ABBA format. */
export const formatPlayerRole = (role: string, format: string): string => {
  const normalized = normalizeRole(role);
  if (format === "ABBA") {
    if (normalized === "PLAYER_A") return "Player A — Bans 1st & 4th";
    if (normalized === "PLAYER_B") return "Player B — Bans 2nd & 3rd";
  }
  return role;
};
