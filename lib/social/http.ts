/**
 * The one HTTP call every social connector makes.
 *
 * Connectors talk to five APIs with five different failure manners, and the
 * collector fans out across all of them at once. Two properties matter more
 * than anything else here:
 *
 *   • A call must not hang. Every provider gets the same timeout and the same
 *     abort, because one slow endpoint must not hold the whole pull past the
 *     route's maxDuration and lose the four platforms that answered.
 *   • A failure must carry the API's own words. "Instagram request failed"
 *     sends someone to check a network; "(190) Error validating access token:
 *     Session has expired" sends them to the right place. Error bodies are
 *     small and are read on purpose.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;

export interface JsonResult<T> {
  ok: boolean;
  status: number | null;
  data: T | null;
  error: string | null;
  ms: number;
}

/** Trim a provider error body to something a UI can show on one line. */
function summarizeError(status: number, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return `HTTP ${status}`;

  // Most of these APIs return { error: { message } } or { errors: [{ detail }] }.
  try {
    const parsed = JSON.parse(trimmed);
    const message =
      parsed?.error?.message ??
      parsed?.error_description ??
      parsed?.message ??
      parsed?.errors?.[0]?.detail ??
      parsed?.errors?.[0]?.message ??
      (typeof parsed?.error === 'string' ? parsed.error : null);
    if (message) return `HTTP ${status}: ${String(message).slice(0, 300)}`;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return `HTTP ${status}: ${trimmed.slice(0, 300)}`;
}

/**
 * GET JSON with a timeout and a byte cap.
 *
 * Non-2xx is returned as `ok: false` with the body summarized, never thrown:
 * a 429 from X is a fact about X that the console should display next to X,
 * not an exception that empties the other four panels.
 */
export async function getJson<T = any>(
  url: string,
  init: RequestInit = {},
): Promise<JsonResult<T>> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KneadSocial54/1.0 (+https://kneadmag.com; editorial monitoring)',
        ...(init.headers ?? {}),
      },
    });

    const text = await readCapped(res);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: summarizeError(res.status, text),
        ms: Date.now() - started,
      };
    }

    try {
      return {
        ok: true,
        status: res.status,
        data: JSON.parse(text) as T,
        error: null,
        ms: Date.now() - started,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Response was not JSON (${text.slice(0, 120)})`,
        ms: Date.now() - started,
      };
    }
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: null,
      data: null,
      error: aborted ? `Timed out after ${TIMEOUT_MS / 1000}s` : (err?.message ?? 'Request failed'),
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET text — feeds and HTML pages, which the editorial sweep reads.
 *
 * Separate from getJson because a feed that fails to parse must not be
 * reported as a transport failure: the difference between "the server did not
 * answer" and "the server answered with something that is not a feed" is the
 * difference between retrying and fixing the URL.
 *
 * Sends an Accept that prefers feed types, and identifies honestly — a
 * publication that wants to block us should be able to.
 */
export async function getText(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number | null; text: string; error: string | null; ms: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept:
          'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5',
        'User-Agent': 'KneadSocial54/1.0 (+https://kneadmag.com; editorial monitoring)',
        ...(init.headers ?? {}),
      },
    });

    const text = await readCapped(res);

    return {
      ok: res.ok,
      status: res.status,
      text,
      error: res.ok ? null : summarizeError(res.status, text),
      ms: Date.now() - started,
    };
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: null,
      text: '',
      error: aborted ? `Timed out after ${TIMEOUT_MS / 1000}s` : (err?.message ?? 'Request failed'),
      ms: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** POST JSON — used by the GraphQL connectors. */
export async function postJson<T = any>(
  url: string,
  body: unknown,
  init: RequestInit = {},
): Promise<JsonResult<T>> {
  return getJson<T>(url, {
    ...init,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  });
}

/**
 * Read a response body without letting a hostile or broken endpoint stream us
 * out of memory. Bodies here are expected to be tens of kilobytes.
 */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (bytes >= MAX_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  out += decoder.decode();
  return out;
}

/** ISO string for `days` ago, which is how every provider wants its window. */
export function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export function withinWindow(publishedAt: string, days: number): boolean {
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - days * 86_400_000;
}
