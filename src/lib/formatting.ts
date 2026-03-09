/** Normalize a role string to UPPER_SNAKE_CASE for comparison. */
export const normalizeRole = (role: string): string =>
  role.replace(/\s+/g, "_").toUpperCase();
