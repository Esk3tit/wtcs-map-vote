import { ConvexError } from "convex/values";
import { MAX_NAME_LENGTH } from "./constants";

/**
 * Validate and trim an entity name.
 * @param name - The name to validate
 * @param entityType - Type of entity for error messages (e.g., "Map", "Team")
 * @returns Trimmed name
 * @throws ConvexError if name is empty or exceeds max length
 */
export function validateName(name: string, entityType: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new ConvexError(`${entityType} name cannot be empty`);
  }

  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new ConvexError(
      `${entityType} name cannot exceed ${MAX_NAME_LENGTH} characters`
    );
  }

  return trimmed;
}
