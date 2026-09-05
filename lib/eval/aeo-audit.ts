/**
 * The AEO Audit run — Knead against the field.
 *
 * Takes one subject URL plus a list of competitor URLs, audits each, and turns
 * the findings into eval turns the existing judge and console already know how
 * to read. Nothing about the storage, grading, or results UI is special-cased
 * for this surface: a turn is a turn.
 *
 * The comparison is the point. A publisher's absolute score is hard to act on
 * — 61/100 means nothing on its own. "61 against a field median of 44, but
 * last of five on byline entities" tells an editor what to do on Monday.
 */
import { auditUrl, renderSignalReport, type AeoSignals } from './aeo-signals';

export interface AuditTarget {
  url: string;
  /** The publication being audited on its own behalf, vs. a comparison set. */
  isSubject: boolean;
}

export interface AuditTurnDraft {
  turnIndex: number;
  role: 'event' | 'agent';
  content: string;
  latencyMs: number | null;
  metadata: Record<string, any>;
}

export interface AuditOutcome {
  signals: AeoSignals[];
  turns: AuditTurnDraft[];
  subjectScore: number | null;
  fieldMedian: number | null;
  anyReachable: boolean;
}

/** Audit every target, sequentially — this is polite to the sites being read. */
export async function runAeoAudit(targets: AuditTarget[]): Promise<AuditOutcome> {
  const signals: AeoSignals[] = [];
  const bySubject = new Map<string, boolean>();

  for (const target of targets) {
    try {
      const result = await auditUrl(target.url);
      signals.push(result);
      bySubject.set(result.url, target.isSubject);
    } catch (err: any) {
      // A malformed or refused URL is a finding, not a crash — record it and
      // keep auditing the rest of the field.
      const failed: AeoSignals = {
        url: target.url,
        finalUrl: target.url,
        ok: false,
        httpStatus: null,
        fetchMs: 0,
        error: err?.message ?? 'audit failed',
        title: null,
        metaDescription: null,
        ogType: null,
        ogSiteName: null,
        canonical: null,
        jsonLdBlocks: 0,
        jsonLdInvalid: 0,
        schemaTypes: [],
        organization: {
          found: false,
          isNewsMedia: false,
          sameAs: [],
          knowsAbout: [],
          hasPublishingPrinciples: false,
        },
        article: {
          found: false,
          typedAsNews: false,
          hasAuthor: false,
          authorIsEntity: false,
          hasDatePublished: false,
          declaresPaywall: false,
          hasAbout: false,
        },
        feeds: [],
        visibleWords: 0,
        scriptTextRatio: 0,
        robots: { exists: false, blocksAiCrawlers: [], declaresSitemap: false },
        sitemapExists: false,
        llmsTxtExists: false,
        checks: [
          {
            id: 'reachable',
            label: 'Page is reachable',
            status: 'fail',
            detail: err?.message ?? 'audit failed',
            weight: 1,
          },
        ],
        score: 0,
      };
      signals.push(failed);
      bySubject.set(target.url, target.isSubject);
    }
  }

  const reachable = signals.filter((s) => s.ok);
  const subject = signals.find((s) => bySubject.get(s.url)) ?? null;
  const competitors = signals.filter((s) => !bySubject.get(s.url) && s.ok);

  const subjectScore = subject && subject.ok ? subject.score : null;
  const fieldMedian = competitors.length ? median(competitors.map((c) => c.score)) : null;

  const turns: AuditTurnDraft[] = [];
  let index = 0;

  for (const s of signals) {
    const isSubject = bySubject.get(s.url) === true;
    const label = isSubject ? 'SUBJECT' : 'COMPARISON';

    // The 'event' turn carries the machine-readable findings; the judge reads
    // metadata for anything measurable rather than re-deriving it from prose.
    turns.push({
      turnIndex: index++,
      role: 'event',
      content: `${label} · GET ${s.url}`,
      latencyMs: s.fetchMs,
      metadata: {
        status: s.httpStatus,
        isSubject,
        url: s.url,
        finalUrl: s.finalUrl,
        score: s.score,
        schemaTypes: s.schemaTypes,
        organization: s.organization,
        article: s.article,
        visibleWords: s.visibleWords,
        scriptTextRatio: s.scriptTextRatio,
        feeds: s.feeds,
        robots: s.robots,
        sitemapExists: s.sitemapExists,
        llmsTxtExists: s.llmsTxtExists,
        checks: s.checks,
        ...(s.error ? { error: s.error } : {}),
      },
    });

    // The 'agent' turn is the human- and judge-readable report.
    turns.push({
      turnIndex: index++,
      role: 'agent',
      content: renderSignalReport(s),
      latencyMs: null,
      metadata: { isSubject, score: s.score, url: s.url },
    });
  }

  // A closing turn so the judge grades the subject in context rather than
  // scoring whichever site it read last.
  turns.push({
    turnIndex: index++,
    role: 'event',
    content: renderComparison(signals, bySubject, subjectScore, fieldMedian),
    latencyMs: null,
    metadata: { comparison: true, subjectScore, fieldMedian },
  });

  return {
    signals,
    turns,
    subjectScore,
    fieldMedian,
    anyReachable: reachable.length > 0,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

/**
 * The scoreboard, plus the per-check comparison that makes it actionable.
 *
 * The judge is told explicitly which row is the subject, because "grade the
 * subject" is otherwise ambiguous in a transcript containing five sites.
 */
function renderComparison(
  signals: AeoSignals[],
  bySubject: Map<string, boolean>,
  subjectScore: number | null,
  fieldMedian: number | null,
): string {
  const lines: string[] = ['FIELD COMPARISON', ''];

  const ranked = [...signals].sort((a, b) => b.score - a.score);
  for (const [i, s] of ranked.entries()) {
    const mark = bySubject.get(s.url) ? ' ← SUBJECT' : '';
    const host = safeHost(s.finalUrl || s.url);
    lines.push(`${String(i + 1).padStart(2)}. ${String(s.score).padStart(3)}/100  ${host}${mark}${s.ok ? '' : '  (unreachable)'}`);
  }

  lines.push('');
  if (subjectScore !== null && fieldMedian !== null) {
    const delta = subjectScore - fieldMedian;
    lines.push(
      `Subject scores ${subjectScore}; comparison-set median is ${fieldMedian} (${delta >= 0 ? '+' : ''}${delta}).`,
    );
  } else if (subjectScore !== null) {
    lines.push(`Subject scores ${subjectScore}. No reachable comparison sites, so there is no field to rank against.`);
  }

  // Where the subject loses to the field, check by check.
  const subject = signals.find((s) => bySubject.get(s.url));
  const others = signals.filter((s) => !bySubject.get(s.url) && s.ok);
  if (subject?.ok && others.length) {
    const losing: string[] = [];
    const winning: string[] = [];
    for (const check of subject.checks) {
      if (check.weight === 0) continue;
      const peers = others
        .map((o) => o.checks.find((c) => c.id === check.id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));
      if (!peers.length) continue;
      const peersPassing = peers.filter((p) => p.status === 'pass').length;
      const subjectPasses = check.status === 'pass';
      if (!subjectPasses && peersPassing > peers.length / 2) {
        losing.push(`${check.label} — ${peersPassing}/${peers.length} of the field passes, subject does not`);
      }
      if (subjectPasses && peersPassing === 0) {
        winning.push(`${check.label} — subject passes, none of the field does`);
      }
    }
    if (losing.length) {
      lines.push('', 'BEHIND THE FIELD ON:');
      losing.forEach((l) => lines.push(`  • ${l}`));
    }
    if (winning.length) {
      lines.push('', 'AHEAD OF THE FIELD ON:');
      winning.forEach((l) => lines.push(`  • ${l}`));
    }
    if (!losing.length && !winning.length) {
      lines.push('', 'No check separates the subject from the field.');
    }
  }

  return lines.join('\n');
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
