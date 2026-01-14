import { describe, it, expect } from "vitest";
import { isSecureUrl, validateSecureUrl } from "./urlValidation";
import { ConvexError } from "convex/values";

describe("isSecureUrl", () => {
  describe("blocks private IPv4 ranges", () => {
    it("blocks 10.x.x.x (Class A private)", () => {
      expect(isSecureUrl("http://10.0.0.1/")).toBe(false);
      expect(isSecureUrl("http://10.255.255.255/")).toBe(false);
      expect(isSecureUrl("http://10.1.2.3/path")).toBe(false);
    });

    it("blocks 192.168.x.x (Class C private)", () => {
      expect(isSecureUrl("http://192.168.1.1/")).toBe(false);
      expect(isSecureUrl("http://192.168.0.1/")).toBe(false);
      expect(isSecureUrl("http://192.168.255.255/")).toBe(false);
    });

    it("blocks 172.16.x.x to 172.31.x.x (Class B private)", () => {
      expect(isSecureUrl("http://172.16.0.1/")).toBe(false);
      expect(isSecureUrl("http://172.31.255.255/")).toBe(false);
      expect(isSecureUrl("http://172.20.10.5/")).toBe(false);
      // 172.15.x.x and 172.32.x.x are NOT private - handled by "allows edge IPs"
    });
  });

  describe("blocks loopback addresses", () => {
    it("blocks IPv4 loopback (127.x.x.x)", () => {
      expect(isSecureUrl("http://127.0.0.1/")).toBe(false);
      expect(isSecureUrl("http://127.0.0.2/")).toBe(false);
      expect(isSecureUrl("http://127.255.255.255/")).toBe(false);
    });

    it("blocks IPv6 loopback", () => {
      expect(isSecureUrl("http://[::1]/")).toBe(false);
    });
  });

  describe("blocks cloud metadata IPs", () => {
    it("blocks 169.254.x.x (link-local / AWS metadata)", () => {
      expect(isSecureUrl("http://169.254.169.254/")).toBe(false);
      expect(isSecureUrl("http://169.254.0.1/")).toBe(false);
    });
  });

  describe("blocks localhost hostnames", () => {
    it("blocks localhost", () => {
      expect(isSecureUrl("http://localhost/")).toBe(false);
      expect(isSecureUrl("https://localhost/")).toBe(false);
      expect(isSecureUrl("http://localhost:8080/")).toBe(false);
    });

    it("blocks localhost subdomains", () => {
      expect(isSecureUrl("http://test.localhost/")).toBe(false);
      expect(isSecureUrl("http://api.localhost/")).toBe(false);
    });

    it("blocks localhost.localdomain", () => {
      expect(isSecureUrl("http://localhost.localdomain/")).toBe(false);
    });
  });

  describe("blocks other unsafe IP ranges", () => {
    it("blocks broadcast address", () => {
      expect(isSecureUrl("http://255.255.255.255/")).toBe(false);
    });

    it("blocks unspecified address", () => {
      expect(isSecureUrl("http://0.0.0.0/")).toBe(false);
    });

    it("blocks multicast addresses", () => {
      expect(isSecureUrl("http://224.0.0.1/")).toBe(false);
      expect(isSecureUrl("http://239.255.255.255/")).toBe(false);
    });

    it("blocks carrier-grade NAT (100.64.0.0/10)", () => {
      expect(isSecureUrl("http://100.64.0.1/")).toBe(false);
      expect(isSecureUrl("http://100.127.255.255/")).toBe(false);
    });
  });

  describe("blocks unsafe IPv6 addresses", () => {
    it("blocks unique local addresses (fc00::/7)", () => {
      expect(isSecureUrl("http://[fc00::1]/")).toBe(false);
      expect(isSecureUrl("http://[fd00::1]/")).toBe(false);
    });

    it("blocks IPv4-mapped IPv6 addresses with private IPs", () => {
      expect(isSecureUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
      expect(isSecureUrl("http://[::ffff:192.168.1.1]/")).toBe(false);
    });
  });

  describe("allows valid public URLs", () => {
    it("allows public IPv4 addresses", () => {
      expect(isSecureUrl("https://8.8.8.8/")).toBe(true);
      expect(isSecureUrl("http://1.1.1.1/")).toBe(true);
      expect(isSecureUrl("https://142.250.189.206/")).toBe(true);
    });

    it("allows domain names", () => {
      expect(isSecureUrl("https://example.com/image.png")).toBe(true);
      expect(isSecureUrl("https://www.google.com/")).toBe(true);
    });

    it("allows CDN URLs", () => {
      expect(isSecureUrl("https://cdn.example.com/images/photo.jpg")).toBe(
        true
      );
      expect(isSecureUrl("https://d1234567890.cloudfront.net/image.png")).toBe(
        true
      );
    });

    it("allows URLs with ports", () => {
      expect(isSecureUrl("https://example.com:443/")).toBe(true);
      expect(isSecureUrl("http://example.com:8080/path")).toBe(true);
    });

    it("allows URLs with query strings and fragments", () => {
      expect(isSecureUrl("https://example.com/path?query=1&foo=bar")).toBe(
        true
      );
      expect(isSecureUrl("https://example.com/path#section")).toBe(true);
    });

    it("allows edge case IPs outside private ranges", () => {
      // Just outside 172.16-31 private range
      expect(isSecureUrl("http://172.15.255.255/")).toBe(true);
      expect(isSecureUrl("http://172.32.0.0/")).toBe(true);
    });
  });

  describe("handles invalid URLs", () => {
    it("returns false for non-URL strings", () => {
      expect(isSecureUrl("not-a-url")).toBe(false);
      expect(isSecureUrl("just some text")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isSecureUrl("")).toBe(false);
    });

    it("returns false for URLs without protocol", () => {
      expect(isSecureUrl("example.com")).toBe(false);
      expect(isSecureUrl("www.example.com/path")).toBe(false);
    });

    it("returns false for non-HTTP protocols", () => {
      expect(isSecureUrl("ftp://example.com/")).toBe(false);
      expect(isSecureUrl("file:///etc/passwd")).toBe(false);
      expect(isSecureUrl("javascript:alert(1)")).toBe(false);
      expect(isSecureUrl("data:text/html,<script>")).toBe(false);
    });

    it("returns false for URLs exceeding max length", () => {
      const longPath = "a".repeat(2100);
      expect(isSecureUrl(`https://example.com/${longPath}`)).toBe(false);
    });
  });

  describe("handles edge cases", () => {
    it("handles URLs with underscores in hostname", () => {
      expect(isSecureUrl("https://my_subdomain.example.com/")).toBe(true);
    });

    it("handles case-insensitive hostnames", () => {
      expect(isSecureUrl("http://LOCALHOST/")).toBe(false);
      expect(isSecureUrl("http://LocalHost/")).toBe(false);
    });

    it("handles IPv6 addresses with brackets", () => {
      // Public IPv6 (Google DNS)
      expect(isSecureUrl("https://[2001:4860:4860::8888]/")).toBe(true);
    });
  });
});

describe("validateSecureUrl", () => {
  it("throws ConvexError for insecure URLs", () => {
    expect(() => validateSecureUrl("http://127.0.0.1/", "imageUrl")).toThrow(
      ConvexError
    );
    expect(() => validateSecureUrl("http://localhost/", "imageUrl")).toThrow(
      ConvexError
    );
    expect(() => validateSecureUrl("http://10.0.0.1/", "imageUrl")).toThrow(
      ConvexError
    );
  });

  it("throws ConvexError with correct field name in message", () => {
    try {
      validateSecureUrl("http://127.0.0.1/", "logoUrl");
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect((error as ConvexError<string>).data).toContain("logoUrl");
    }
  });

  it("throws ConvexError for empty string", () => {
    expect(() => validateSecureUrl("", "imageUrl")).toThrow(ConvexError);
    expect(() => validateSecureUrl("   ", "imageUrl")).toThrow(ConvexError);
  });

  it("returns trimmed URL for secure URLs", () => {
    expect(validateSecureUrl("https://example.com/", "imageUrl")).toBe(
      "https://example.com/"
    );
    expect(validateSecureUrl("  https://example.com/  ", "imageUrl")).toBe(
      "https://example.com/"
    );
  });

  it("does not throw for secure URLs", () => {
    expect(() =>
      validateSecureUrl("https://example.com/", "imageUrl")
    ).not.toThrow();
    expect(() =>
      validateSecureUrl("https://cdn.example.com/image.jpg", "imageUrl")
    ).not.toThrow();
  });
});
