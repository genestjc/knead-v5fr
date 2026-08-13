/**
 * Last-line defense for text that leaves the server for a user to read:
 * fetched repo source, vendor source, and starter-kit ZIP entries.
 *
 * The /open-source gates are path-based — they decide which FILES may leave.
 * That only holds while every file containing a credential is on a list
 * somebody remembered to update, and it silently stopped holding once
 * (a blocked path pointed at a file that had moved). This scans the BYTES
 * instead, so a key committed by accident into an otherwise-teachable file
 * does not walk out verbatim.
 *
 * Redaction is deliberately loud: the replacement names what was caught, so a
 * builder reading the transcript sees a redaction rather than silently broken
 * code, and the server logs the hit so a real committed secret gets noticed.
 */

interface SecretPattern {
  kind: string;
  pattern: RegExp;
}

// Patterns are anchored on vendor-issued prefixes wherever one exists, which
// keeps them off ordinary source. The two without a prefix — JWTs and 32-byte
// hex — are shaped tightly enough that a false positive is rare and cheap: a
// redacted example beats a live key in a download.
const SECRET_PATTERNS: SecretPattern[] = [
  // OpenAI + Anthropic (sk-, sk-proj-, sk-ant-…)
  { kind: 'ai-api-key', pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g },
  // Stripe secret and restricted keys
  { kind: 'stripe-key', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  // Stripe webhook signing secret
  { kind: 'stripe-webhook-secret', pattern: /\bwhsec_[A-Za-z0-9]{16,}/g },
  // Supabase anon/service-role keys and any other JWT
  { kind: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  // GitHub personal access / OAuth / refresh tokens
  { kind: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { kind: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: 'private-key-block', pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g },
  // A bare 32-byte hex value is the shape of an EVM private key. Knead runs
  // funded server wallets and a key-sharer bot, so this one is worth the
  // occasional redacted transaction hash.
  { kind: 'hex-private-key', pattern: /\b0x[a-fA-F0-9]{64}\b/g },
];

export interface SecretScanResult {
  /** The text with every match replaced by a labelled marker. */
  clean: string;
  /** Kinds that matched, deduped — empty when the text was clean. */
  findings: string[];
}

/**
 * Replace anything credential-shaped with a labelled marker.
 *
 * Returns the original string untouched when nothing matches, so the common
 * case costs a scan and no allocation.
 */
export function redactSecrets(text: string): SecretScanResult {
  if (!text) return { clean: text, findings: [] };

  const findings = new Set<string>();
  let clean = text;

  for (const { kind, pattern } of SECRET_PATTERNS) {
    // Fresh lastIndex per call — these regexes are module-level and global.
    pattern.lastIndex = 0;
    clean = clean.replace(pattern, () => {
      findings.add(kind);
      return `[REDACTED:${kind}]`;
    });
  }

  return { clean, findings: [...findings] };
}

/**
 * Redact and log in one step, for the paths where a hit means a real secret is
 * sitting in the repository and someone needs to hear about it.
 */
export function redactAndLog(text: string, context: string): string {
  const { clean, findings } = redactSecrets(text);
  if (findings.length > 0) {
    console.error(
      `[secret-scan] redacted ${findings.join(', ')} from ${context} — check whether a real credential is committed`,
    );
  }
  return clean;
}
