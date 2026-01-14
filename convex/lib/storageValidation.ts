/**
 * Storage file validation utilities for Convex mutations.
 * Validates uploaded files for size limits and allowed content types.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import {
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_CONTENT_TYPES,
} from "./imageConstants";
import type { AllowedImageContentType } from "./imageConstants";

/**
 * Validates that a storage file exists, is within size limits, and is an allowed image type.
 * Throws ConvexError if validation fails.
 *
 * @param ctx - Mutation context with storage access
 * @param storageId - The Convex storage ID to validate
 * @throws ConvexError if file not found, too large, or invalid type
 */
export async function validateStorageFile(
  ctx: MutationCtx,
  storageId: Id<"_storage">
): Promise<void> {
  const metadata = await ctx.storage.getMetadata(storageId);
  if (!metadata) {
    throw new ConvexError("Invalid storage ID: file not found.");
  }
  if (metadata.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (metadata.size / 1024 / 1024).toFixed(1);
    throw new ConvexError(
      `File too large (${sizeMB}MB). Maximum size is 2MB.`
    );
  }
  if (
    !metadata.contentType ||
    !ALLOWED_IMAGE_CONTENT_TYPES.includes(
      metadata.contentType as AllowedImageContentType
    )
  ) {
    throw new ConvexError(
      `Invalid file type "${metadata.contentType ?? "unknown"}". Allowed: PNG, JPG, WebP.`
    );
  }
}
