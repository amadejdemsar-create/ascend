/**
 * SSRF protection helpers.
 *
 * Shared between the MCP `upload_file` tool (file-tools.ts) and the
 * OpenGraph fetch route (app/api/og/route.ts). Extracted from file-tools.ts
 * in Wave 4 backlog to avoid code duplication.
 *
 * Known limitation: DNS rebinding attacks via short-TTL records are not
 * mitigated here. The hostname is resolved once at validation time; a
 * malicious DNS server could return a public IP first and then switch to a
 * private IP on subsequent queries. Full mitigation would require pinning the
 * resolved IP for the actual fetch, which is not supported by globalThis.fetch.
 * Acceptable risk for authenticated-only endpoints.
 */

import dns from "node:dns/promises";

/**
 * Check whether an IP address belongs to a private, loopback, or
 * link-local range that should be blocked for SSRF protection.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1) — extract the embedded
  // IPv4 and recursively check it before falling through to IPv6 logic.
  const normalized = ip.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    const embedded = normalized.slice(7); // strip "::ffff:"
    if (embedded.includes(".")) {
      return isPrivateIp(embedded);
    }
  }

  // IPv4 checks
  const parts = ip.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    const [a, b] = parts;
    // 0.0.0.0/8 — on Linux, 0.x.y.z aliases to 127.x.y.z (loopback)
    if (a === 0) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (RFC 6598 carrier-grade NAT, used by Tailscale / some AWS VPCs)
    if (a === 100 && b !== undefined && b >= 64 && b <= 127) return true;
    // 224.0.0.0/4 (multicast)
    if (a >= 224 && a <= 239) return true;
    // 240.0.0.0/4 (reserved, includes 255.255.255.255 broadcast)
    if (a >= 240) return true;
    return false;
  }

  // IPv6 checks
  // ::1 (loopback)
  if (
    normalized === "::1" ||
    normalized === "0000:0000:0000:0000:0000:0000:0000:0001"
  )
    return true;
  // fc00::/7 (unique local)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // fe80::/10 (link-local) — covers fe80:: through febf::
  // The /10 means the first 10 bits are 1111111010, so the second byte
  // ranges from 80 to bf. Match fe8, fe9, fea, feb prefixes.
  if (/^fe[89ab]/.test(normalized)) return true;

  return false;
}

/**
 * Validate a URL for SSRF safety:
 * 1. Must be https: scheme
 * 2. Hostname must not resolve to a private/loopback IP
 *
 * @throws {Error} on invalid URL, non-https scheme, or private IP resolution.
 */
export async function validateUrlForSsrf(urlString: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `Only https: URLs are allowed. Got ${parsed.protocol}`,
    );
  }

  // Resolve the hostname and check all returned addresses
  const hostname = parsed.hostname;

  // Handle IP literal hostnames directly
  if (isPrivateIp(hostname)) {
    throw new Error("URL resolves to a private/loopback address");
  }

  try {
    const result = await dns.lookup(hostname, { all: true });
    for (const entry of result) {
      if (isPrivateIp(entry.address)) {
        throw new Error("URL resolves to a private/loopback address");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("private/loopback")) {
      throw err;
    }
    throw new Error(
      `DNS resolution failed for ${hostname}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
