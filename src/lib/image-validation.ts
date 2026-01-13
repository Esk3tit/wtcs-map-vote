/**
 * Client-side image validation utilities for team logo uploads.
 */

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
export const MAX_FILE_SIZE_MB = 2;
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg", "webp"] as const;

export type ImageValidationError = {
  type: "file_too_large" | "invalid_type" | "invalid_extension";
  message: string;
};

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; error: ImageValidationError };

/**
 * Validates an image file for upload.
 * Checks file size (max 2MB) and type (PNG, JPG, WebP).
 */
export function validateImageFile(file: File): ImageValidationResult {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: {
        type: "file_too_large",
        message: `File is too large (${sizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`,
      },
    };
  }

  // Check MIME type
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: {
        type: "invalid_type",
        message: `Invalid file type "${file.type}". Allowed types: PNG, JPG, WebP.`,
      },
    };
  }

  // Check file extension as fallback
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      error: {
        type: "invalid_extension",
        message: `Invalid file extension ".${extension}". Allowed: .png, .jpg, .jpeg, .webp`,
      },
    };
  }

  return { valid: true };
}

/**
 * Formats bytes to human-readable size string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Checks if a string is a valid HTTP/HTTPS URL.
 * This is a simple client-side check - full SSRF validation happens server-side.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
