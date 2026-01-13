// Image validation constants for server-side file validation

/** Maximum allowed image file size: 2MB */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedImageContentType =
  (typeof ALLOWED_IMAGE_CONTENT_TYPES)[number];
