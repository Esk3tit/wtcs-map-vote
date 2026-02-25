/**
 * Random Selection Utilities
 *
 * Provides CSPRNG-based random selection helpers for competitive integrity.
 * Uses crypto.getRandomValues() instead of Math.random() to prevent
 * manipulation in map voting outcomes.
 */

/**
 * Select a random element from an array using CSPRNG.
 * Uses crypto.getRandomValues() for competitive integrity.
 * Employs rejection sampling to eliminate modulo bias and guarantee
 * a uniform distribution across all array indices.
 *
 * @param items - Non-empty array to select from
 * @returns A randomly selected element from the array
 */
export function pickRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick random item from empty array");
  }
  if (items.length === 1) return items[0];
  const buf = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % items.length);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return items[buf[0] % items.length];
}
