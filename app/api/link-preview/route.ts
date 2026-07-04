import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

export const runtime = 'nodejs';

/**
 * Returns true if an IP literal falls inside a private, loopback, link-local,
 * or otherwise-internal range that a public link preview must never reach.
 * Blocking these prevents SSRF into the cloud metadata endpoint
 * (169.254.169.254), localhost services, and RFC-1918 internal hosts.
 */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    // IPv4-mapped (::ffff:a.b.c.d) — re-check the embedded v4 address.
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isBlockedIp(mapped[1]);
    return false;
  }
  return true; // unknown format — refuse rather than risk it
}

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Validate a single URL hop: only http(s), and its hostname must not resolve to
 * an internal/private address. Returns an error tuple, or null when allowed.
 */
async function checkUrlAllowed(
  target: URL,
): Promise<{ status: number; error: string } | null> {
  if (!['http:', 'https:'].includes(target.protocol)) {
    return { status: 400, error: 'Invalid protocol' };
  }
  try {
    const results = await lookup(target.hostname, { all: true });
    if (results.length === 0 || results.some((r) => isBlockedIp(r.address))) {
      return { status: 400, error: 'Blocked host' };
    }
  } catch {
    return { status: 400, error: 'Could not resolve host' };
  }
  return null;
}

/**
 * Fetch `startUrl`, following up to MAX_REDIRECTS redirects while re-validating
 * every hop against the SSRF blocklist. Following redirects manually (instead of
 * refusing them outright) means shortened / www / http→https links still resolve
 * to a real preview, yet a 3xx pointing at an internal host is still blocked.
 */
async function fetchWithRedirectGuard(
  startUrl: string,
): Promise<{ response?: Response; error?: { status: number; error: string } }> {
  let current: URL;
  try {
    current = new URL(startUrl);
  } catch {
    return { error: { status: 400, error: 'Invalid URL' } };
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = await checkUrlAllowed(current);
    if (blocked) return { error: blocked };

    let response: Response;
    try {
      response = await fetch(current.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Knead/1.0; +https://kneadmag.com)',
          Accept: 'text/html',
        },
        // Handle redirects ourselves so each hop is re-validated before we follow it.
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch {
      return { error: { status: 502, error: 'Failed to fetch preview' } };
    }

    // 3xx → resolve the next hop (relative redirects allowed) and loop, which
    // re-runs the private-IP check on the new target before any request is made.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { error: { status: 502, error: 'Redirect without location' } };
      }
      try {
        current = new URL(location, current);
      } catch {
        return { error: { status: 400, error: 'Invalid redirect target' } };
      }
      continue;
    }

    if (!response.ok) return { error: { status: 502, error: 'Failed to fetch' } };
    return { response };
  }

  return { error: { status: 502, error: 'Too many redirects' } };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL required' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const { response, error } = await fetchWithRedirectGuard(url);
  if (error) {
    return NextResponse.json({ error: error.error }, { status: error.status });
  }

  try {
    const html = await response!.text();

    const getMetaContent = (patterns: RegExp[]): string | null => {
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
      }
      return null;
    };

    const title = getMetaContent([
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([^<]{1,200})<\/title>/i,
    ]);

    const description = getMetaContent([
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    ]);

    const image = getMetaContent([
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ]);

    const siteName = getMetaContent([
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    ]) || parsedUrl.hostname.replace('www.', '');

    return NextResponse.json(
      { title, description, image, siteName, url },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 502 });
  }
}
