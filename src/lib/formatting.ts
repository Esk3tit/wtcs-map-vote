/** Normalize a role string to UPPER_SNAKE_CASE for comparison. */
export const normalizeRole = (role: string): string =>
  role.replace(/\s+/g, "_").toUpperCase();

/** Convert an UPPER_SNAKE_CASE role to Title Case (e.g., "PLAYER_A" → "Player A"). */
export const humanizeRole = (role: string): string =>
  role.includes("_")
    ? role
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : role;
