import validator from "validator";
import * as ipaddr from "ipaddr.js";
import { ConvexError } from "convex/values";
import { MAX_URL_LENGTH } from "./constants";

/**
 * IP ranges that are unsafe for user-provided URLs.
 * Based on ipaddr.js range() return values.
 *
 * These ranges are blocked to prevent SSRF attacks:
 * - Private networks (10.x, 172.16.x, 192.168.x)
 * - Localhost/loopback (127.x, ::1)
 * - Cloud metadata endpoints (169.254.x)
 * - Various reserved/special ranges
 */
const UNSAFE_IP_RANGES = new Set([
  // IPv4 ranges
  "unspecified", // 0.0.0.0/8
  "broadcast", // 255.255.255.255
  "multicast", // 224.0.0.0/4
  "linkLocal", // 169.254.0.0/16 (includes cloud metadata)
  "loopback", // 127.0.0.0/8
  "carrierGradeNat", // 100.64.0.0/10 (CGNAT)
  "private", // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  "reserved", // Various RFC reserved ranges

  // IPv6 ranges
  "uniqueLocal", // fc00::/7 (IPv6 private equivalent)
  "ipv4Mapped", // ::ffff:0:0/96 (will be unwrapped and checked)
  "rfc6145", // IPv4-translatable
  "rfc6052", // Well-known prefix
  "6to4", // 2002::/16 (embeds IPv4)
  "teredo", // 2001::/32 (tunneling)
]);

/**
 * Check if a URL is secure (doesn't point to private/internal IPs).
 *
 * This function validates URLs for SSRF protection by:
 * 1. Checking URL format with validator.js
 * 2. Extracting and checking the hostname
 * 3. Blocking localhost hostnames
 * 4. Blocking private/reserved IP addresses
 *
 * Limitation: Domain names that resolve to private IPs cannot be detected
 * without DNS resolution (not available in Convex runtime). This is acceptable
 * because URLs are rendered client-side, not fetched server-side.
 */
export function isSecureUrl(url: string): boolean {
  // Empty/null check
  if (!url || typeof url !== "string") return false;

  // Length check
  if (url.length > MAX_URL_LENGTH) return false;

  // Format validation with validator.js
  if (
    !validator.isURL(url, {
      protocols: ["http", "https"],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: true,
    })
  ) {
    return false;
  }

  // Extract hostname
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  // Block localhost
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return false;
  }

  // Check if hostname is an IP address
  if (ipaddr.isValid(hostname)) {
    // process() handles IPv4-mapped IPv6 automatically
    const addr = ipaddr.process(hostname);
    const range = addr.range();

    // Only allow unicast (public) addresses
    if (UNSAFE_IP_RANGES.has(range)) {
      return false;
    }
  }

  // Domain names pass through (can't DNS resolve in Convex)
  return true;
}

/**
 * Validate URL and return trimmed value, or throw ConvexError.
 *
 * Use this in mutations for consistent error handling.
 * The error message is generic to avoid leaking information about
 * what specific check failed.
 */
export function validateSecureUrl(url: string, fieldName: string): string {
  const trimmed = url.trim();

  if (trimmed.length === 0) {
    throw new ConvexError(`${fieldName} cannot be empty`);
  }

  if (!isSecureUrl(trimmed)) {
    throw new ConvexError(
      `Invalid ${fieldName}. Must be a valid HTTP/HTTPS URL that doesn't point to internal addresses.`
    );
  }

  return trimmed;
}
