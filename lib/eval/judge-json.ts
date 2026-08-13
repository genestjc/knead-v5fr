/**
 * Parsing the judge's response back into verdicts.
 *
 * Split out from judge.ts because it is pure string work with no model or
 * database behind it — which makes it the one part of the judging path that
 * can be tested directly against the malformed responses that actually broke
 * it in production.
 */

/**
 * A verdict as it arrives from the model — the id is the only field worth
 * trusting on sight; the rest is coerced by the caller.
 */
export interface RawJudgeVerdict {
  criterionId: string;
  verdict?: unknown;
  rationale?: unknown;
  evidence?: unknown;
}

export interface ParsedJudgeResponse {
  verdicts?: RawJudgeVerdict[];
  summary?: string;
}

function isRawJudgeVerdict(value: unknown): value is RawJudgeVerdict {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  // A complete outer document would carry a criterionId somewhere too, so
  // require the shape of a single verdict rather than a wrapper around many.
  return typeof record.criterionId === 'string' && !Array.isArray(record.verdicts);
}

/**
 * Models sometimes wrap JSON in fences or add a lead-in sentence despite being
 * told not to. Strip fences, then fall back to the outermost braces, then
 * salvage whatever complete verdict objects the response contains.
 *
 * The salvage pass exists because the common failure here isn't malformed
 * JSON, it's TRUNCATED JSON: the response hits the token ceiling partway
 * through row eleven, and both strict parses fail on a document that holds ten
 * perfectly good verdicts. Throwing all of them away over the eleventh is how
 * a long rubric turned into "Could not parse the judge response as JSON" with
 * nothing scored at all.
 */
export function parseJudgeJSON(raw: string): ParsedJudgeResponse {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(cleaned);
  } catch {
    /* fall through */
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }

  const salvaged = salvageVerdicts(cleaned);
  if (salvaged.length > 0) {
    console.error(
      `[probatio/judge] response was not valid JSON; salvaged ${salvaged.length} complete verdict(s) from ${cleaned.length} chars`,
    );
    return { verdicts: salvaged, summary: salvageSummary(cleaned) };
  }

  throw new Error(
    `Could not parse the judge response as JSON (${cleaned.length} chars, no complete verdicts found). Response began: ${cleaned.slice(0, 200)}`,
  );
}

/**
 * Pull every complete, balanced JSON object carrying a criterionId out of a
 * partial document. Quote- and escape-aware, so a brace inside a quoted
 * rationale doesn't end an object early.
 */
export function salvageVerdicts(text: string): RawJudgeVerdict[] {
  const found: RawJudgeVerdict[] = [];
  // Verdict objects sit nested inside the (unterminated) outer object, so this
  // has to close objects at every depth, not just the top level.
  const openStack: number[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      openStack.push(i);
      continue;
    }
    if (ch === '}') {
      const objectStart = openStack.pop();
      if (objectStart === undefined) continue;

      const candidate = text.slice(objectStart, i + 1);
      if (!candidate.includes('"criterionId"')) continue;

      try {
        const parsed: unknown = JSON.parse(candidate);
        if (isRawJudgeVerdict(parsed)) found.push(parsed);
      } catch {
        /* incomplete or malformed — skip this one, keep scanning */
      }
    }
  }

  return found;
}

/** Best-effort summary recovery from a truncated document. */
export function salvageSummary(text: string): string {
  const match = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}
