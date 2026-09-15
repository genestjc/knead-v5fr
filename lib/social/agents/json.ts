/**
 * Tolerant JSON extraction for the social agents.
 *
 * Every agent here asks for strict JSON and most of the time gets it. The rest
 * of the time a model wraps it in a ```json fence, prefixes "Here's the
 * analysis:", or appends a closing sentence — none of which are worth losing a
 * run over, which is the same reasoning behind lib/eval/judge-json.ts.
 *
 * The one rule this file will not bend: an unparseable response is never
 * silently converted into an empty result. An empty sentiment report reads as
 * "nobody said anything", and an empty trends report reads as "nothing is
 * happening" — both are confident claims about the world, and neither is what
 * happened. Callers get `ok: false` and the raw prose so they can show it.
 */

export interface ParseResult<T> {
  ok: boolean;
  data: T | null;
  /** The model's text, kept whenever parsing failed. */
  raw: string;
  error: string | null;
}

/**
 * Pull the first complete JSON object or array out of a model response.
 *
 * Scans for a balanced span rather than taking indexOf('{') to
 * lastIndexOf('}'): a reply that contains prose with a brace in it, or two
 * objects, would otherwise produce a span that spans both and parses as
 * nothing. Quotes and escapes are tracked so a brace inside a string does not
 * move the depth counter.
 */
export function extractJsonSpan(text: string): string | null {
  const opens = ['{', '['];
  const closes: Record<string, string> = { '{': '}', '[': ']' };

  for (let start = 0; start < text.length; start++) {
    const open = text[start];
    if (!opens.includes(open)) continue;

    const close = closes[open];
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

export function parseAgentJson<T = any>(raw: string): ParseResult<T> {
  const text = (raw ?? '').trim();
  if (!text) {
    return { ok: false, data: null, raw: '', error: 'The model returned nothing.' };
  }

  // A fenced block, when present, is the most reliable signal of where the
  // JSON starts and ends — prefer it over scanning the whole reply.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1]?.trim(), extractJsonSpan(text), text].filter(
    (c): c is string => Boolean(c),
  );

  for (const candidate of candidates) {
    try {
      return { ok: true, data: JSON.parse(candidate) as T, raw: text, error: null };
    } catch {
      // Try the next candidate.
    }
  }

  return {
    ok: false,
    data: null,
    raw: text,
    error: 'The model did not return parseable JSON. Its reply is preserved above rather than reported as an empty result.',
  };
}

/** Coerce to a string, trimmed, with a cap so one bad field can't flood a row. */
export function str(value: unknown, max = 2_000): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

/** Coerce to one of a known set, falling back to a default. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = String(value ?? '').toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Coerce to an array of mapped items, dropping anything that maps to null. */
export function arrayOf<T>(value: unknown, map: (item: any) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(map).filter((v): v is T => v !== null);
}

/**
 * A number in a range, or null.
 *
 * Null rather than a clamped default: a sentiment score the model declined to
 * give is not a neutral 0, and rendering it as one invents a reading.
 */
export function numberInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}
