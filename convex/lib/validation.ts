import { ConvexError } from "convex/values";
import { MAX_NAME_LENGTH } from "./constants";

/**
 * Validate that a numeric value falls within a specified range.
 * @param value - The value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param fieldName - Name of the field for error messages
 * @param unit - Optional unit suffix for error messages (e.g., "seconds")
 * @throws ConvexError if value is outside the range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string,
  unit?: string
): void {
  const suffix = unit ? ` ${unit}` : "";
  if (value < min) {
    throw new ConvexError(`${fieldName} must be at least ${min}${suffix}`);
  }
  if (value > max) {
    throw new ConvexError(`${fieldName} cannot exceed ${max}${suffix}`);
  }
}

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
