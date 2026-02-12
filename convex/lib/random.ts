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
 *
 * @param items - Non-empty array to select from
 * @returns A randomly selected element from the array
 */
export function pickRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot pick random item from empty array");
  }
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return items[buf[0] % items.length];
}
