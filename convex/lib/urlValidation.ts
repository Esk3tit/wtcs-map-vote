import validator from "validator";
import * as ipaddr from "ipaddr.js";
import { ConvexError } from "convex/values";
import { MAX_URL_LENGTH } from "./constants";

// IP ranges blocked for SSRF protection. See ipaddr.js range() for details.
const UNSAFE_IP_RANGES = new Set([
  // IPv4
  "unspecified",
  "broadcast",
  "multicast",
  "linkLocal",
  "loopback",
  "carrierGradeNat",
  "private",
  "reserved",
  "as112",
  "amt",
  // IPv6
  "uniqueLocal",
  "ipv4Mapped",
  "rfc6145",
  "rfc6052",
  "6to4",
  "teredo",
  "discard",
  "benchmarking",
  "orchid2",
  "as112v6",
]);

/**
 * Check if URL is secure (not pointing to private/internal IPs).
 * Note: Cannot detect domains resolving to private IPs (no DNS in Convex).
 */
export function isSecureUrl(url: string): boolean {
  if (!url) return false;
  if (url.length > MAX_URL_LENGTH) return false;

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

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "localhost.localdomain"
  ) {
    return false;
  }

  // Strip brackets from IPv6 addresses (URL.hostname returns "[::1]" for IPv6)
  let hostnameForIpCheck = hostname;
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostnameForIpCheck = hostname.slice(1, -1);
  }

  // Check if hostname is an IP address
  if (ipaddr.isValid(hostnameForIpCheck)) {
    const addr = ipaddr.process(hostnameForIpCheck);
    const range = addr.range();
    if (UNSAFE_IP_RANGES.has(range)) {
      return false;
    }
  }

  return true;
}

/** Validate URL and return trimmed value, or throw ConvexError. */
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
