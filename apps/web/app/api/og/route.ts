/**
 * OpenGraph image fetcher.
 *
 * GET /api/og?url=<encoded-url>
 *
 * Fetches the target URL's HTML, parses it for og:image (and twitter:image
 * as fallback) using a regex (no third-party HTML parser needed), and returns
 * { ogImage: string | null }.
 *
 * Security:
 *   - Authenticated (authenticate() from lib/auth.ts).
 *   - URL must be https: scheme (no http, data, javascript, file).
 *   - SSRF defense via shared validateUrlForSsrf (private IP blocklist + DNS check).
 *   - 30-second timeout via AbortSignal.timeout.
 *   - 5 MiB max response size; abort if exceeded.
 *   - redirect: "error" (no following).
 *
 * Cache: Cache-Control: public, max-age=86400 (24 hours).
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticate, unauthorizedResponse, handleApiError } from "@/lib/auth";
import { validateUrlForSsrf } from "@/lib/ssrf";

/** 5 MiB cap on HTML response body to prevent memory abuse. */
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/** 30-second fetch timeout. */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Extract the og:image or twitter:image URL from raw HTML.
 *
 * Uses regex instead of a DOM parser to avoid adding a third-party
 * dependency. Handles both single and double quotes, and property/name
 * appearing before or after content.
 */
function extractOgImage(html: string): string | null {
  // Try og:image first (most common and authoritative).
  // Pattern matches <meta property="og:image" content="..." /> in either order.
  const ogPatterns = [
    // property before content
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*\/?>/i,
    // content before property
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*\/?>/i,
  ];

  for (const pattern of ogPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  // Fallback: twitter:image (name attribute, not property).
  const twitterPatterns = [
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*\/?>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*\/?>/i,
  ];

  for (const pattern of twitterPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth.success) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing required query parameter: url" },
        { status: 400 },
      );
    }

    // SSRF validation (scheme + private IP check)
    await validateUrlForSsrf(url);

    // Fetch with timeout and redirect rejection
    const response = await globalThis.fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
      headers: {
        // Present as a bot so servers return full HTML (some serve JS-only to curl)
        "User-Agent": "AscendBot/1.0 (OpenGraph fetcher)",
        Accept: "text/html, application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { ogImage: null },
        {
          status: 200,
          headers: { "Cache-Control": "public, max-age=86400" },
        },
      );
    }

    // Read body with size cap
    if (!response.body) {
      return NextResponse.json(
        { ogImage: null },
        {
          status: 200,
          headers: { "Cache-Control": "public, max-age=86400" },
        },
      );
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        reader.cancel();
        break;
      }
      chunks.push(value);
    }

    const html = new TextDecoder().decode(
      Buffer.concat(chunks),
    );

    const ogImage = extractOgImage(html);

    return NextResponse.json(
      { ogImage },
      {
        status: 200,
        headers: { "Cache-Control": "public, max-age=86400" },
      },
    );
  } catch (error) {
    // On SSRF validation errors, fetch failures, or timeouts: return null
    // rather than surfacing the error to the client. The caller just sees
    // "no OG image available" and falls back to the URL text display.
    if (
      error instanceof Error &&
      (error.message.includes("private/loopback") ||
        error.message.includes("Only https:") ||
        error.message.includes("Invalid URL") ||
        error.message.includes("DNS resolution") ||
        error.name === "TimeoutError" ||
        error.name === "AbortError" ||
        error.message.includes("redirect"))
    ) {
      return NextResponse.json(
        { ogImage: null },
        {
          status: 200,
          headers: { "Cache-Control": "public, max-age=86400" },
        },
      );
    }
    return handleApiError(error);
  }
}
