/** Normalize a role string to UPPER_SNAKE_CASE for comparison. */
export const normalizeRole = (role: string): string =>
  role.trim().replace(/\s+/g, "_").toUpperCase();
