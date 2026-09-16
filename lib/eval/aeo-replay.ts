/**
 * Rebuilding an AEO/SEO audit's charts from what was saved.
 *
 * THE PROBLEM THIS FIXES. The scoreboard, the check matrix, the coverage table
 * and the analyst panel were all rendered from React state that only a LIVE run
 * ever filled. Reopening a saved audit dropped you into the raw transcript
 * instead — the same findings, in the worst form they take. Every number was
 * still on screen, spread across twenty log lines nobody reads.
 *
 * WHY REBUILD RATHER THAN STORE A SNAPSHOT. The findings are already in the
 * turns: the route writes each target's checks, score, coverage and extraction
 * diagnosis onto the `event` turn for that fetch, because the LLM judge reads
 * them there. Adding a parallel copy on the run row would duplicate 50-100KB of
 * check detail per run and give two records that can disagree. Reading the
 * turns back has the additional property that it works for runs that were
 * already saved before this existed, which a snapshot could never do.
 *
 * WHAT CANNOT BE REBUILT is stated rather than faked. A field the route never
 * wrote comes back as its empty value and the caller is told the reconstruction
 * is partial, so a saved run can never quietly render a chart of zeroes that
 * looks like a measurement.
 */
import type { AeoSignals, SignalCheck } from './aeo-signals';
import { emptySeoSignals } from './seo-signals';
import type { StorySignals, SubjectCoverage } from './aeo-story';
import type { StoryAnalysis } from './aeo-analyst';
import type { EvalRun, EvalTurn } from './types';

export interface ReplayedRun {
  subject: string;
  /** Targets in audit order — ours first, then the field. */
  signals: StorySignals[];
  subjectScore: number | null;
  fieldMedian: number | null;
  /** Null when the analyst pass was skipped, failed, or was never run. */
  analysis: StoryAnalysis | null;
  /**
   * The analyst's prose, for a run saved before its verdict was stored
   * structurally. Rendered in place of the verdict rather than dropped.
   */
  analystText: string | null;
  /** Why the analyst is absent, when the route recorded a reason. */
  analystError: string | null;
  /**
   * False when a turn was missing something the charts want. The tab says so
   * rather than presenting a partial rebuild as the whole audit.
   */
  complete: boolean;
}

function emptyCoverage(): SubjectCoverage {
  return {
    inTitle: false,
    inDescription: false,
    inSchemaAbout: false,
    inOpening: false,
    mentions: 0,
    matchedFullName: false,
  };
}

/** A check array survives the round trip through jsonb; validate its shape anyway. */
function readChecks(value: unknown): SignalCheck[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any) => {
      const id = String(row?.id ?? '');
      if (!id) return null;
      const status = ['pass', 'fail', 'warn', 'na'].includes(row?.status) ? row.status : 'na';
      return {
        id,
        label: String(row?.label ?? id),
        status,
        detail: String(row?.detail ?? ''),
        weight: Number.isFinite(Number(row?.weight)) ? Number(row.weight) : 0,
      } as SignalCheck;
    })
    .filter((c): c is SignalCheck => c !== null);
}

/**
 * Rebuild one target from the `event` turn the route wrote for its fetch.
 *
 * The turn carries everything the charts read. What it does not carry — the
 * title, the description, the on-page SEO facts — is absent because no view
 * needed it, so it comes back empty rather than invented.
 */
function readSignal(turn: EvalTurn): StorySignals | null {
  const m = turn.metadata ?? {};
  const url = String(m.url ?? '');
  if (!url) return null;

  const status = typeof m.status === 'number' ? m.status : null;

  return {
    url,
    finalUrl: String(m.finalUrl ?? url),
    // `ok` was never stored. HTTP status is the same fact: the route only
    // records a status at all when a response came back, and an `error` on the
    // turn means the fetch never completed.
    ok: !m.error && status !== null && status >= 200 && status < 400,
    httpStatus: status,
    fetchMs: typeof turn.latencyMs === 'number' ? turn.latencyMs : 0,
    ...(m.error ? { error: String(m.error) } : {}),

    title: null,
    metaDescription: null,
    ogType: null,
    ogSiteName: null,
    canonical: null,

    jsonLdBlocks: 0,
    jsonLdInvalid: 0,
    schemaTypes: Array.isArray(m.schemaTypes) ? m.schemaTypes.map(String) : [],
    organization:
      m.organization && typeof m.organization === 'object'
        ? m.organization
        : {
            found: false,
            isNewsMedia: false,
            sameAs: [],
            knowsAbout: [],
            hasPublishingPrinciples: false,
          },
    article:
      m.article && typeof m.article === 'object'
        ? m.article
        : {
            found: false,
            typedAsNews: false,
            hasAuthor: false,
            authorIsEntity: false,
            hasDatePublished: false,
            declaresPaywall: false,
            hasAbout: false,
          },

    feeds: Array.isArray(m.feeds) ? m.feeds.map(String) : [],
    seo: emptySeoSignals(),
    visibleWords: Number(m.visibleWords ?? 0) || 0,
    scriptTextRatio: Number(m.scriptTextRatio ?? 0) || 0,
    // Never stored, and deliberately so — it is the whole article body, and
    // keeping a copy of someone else's piece on every run row is not something
    // a chart needs.
    extractedText: '',

    robots:
      m.robots && typeof m.robots === 'object'
        ? m.robots
        : { exists: false, blocksAiCrawlers: [], declaresSitemap: false },
    sitemapExists: Boolean(m.sitemapExists),
    llmsTxtExists: Boolean(m.llmsTxtExists),

    checks: readChecks(m.checks),
    score: Number(m.score ?? 0) || 0,

    // Story-scoped.
    coverage:
      m.coverage && typeof m.coverage === 'object'
        ? { ...emptyCoverage(), ...m.coverage }
        : emptyCoverage(),
    quotedPassages: Number(m.quotedPassages ?? 0) || 0,
    specificityMarkers: Number(m.specificityMarkers ?? 0) || 0,
    extractionFailed: Boolean(m.extractionFailed),
    extractionDiagnosis: m.extractionDiagnosis ? String(m.extractionDiagnosis) : null,
  };
}

/**
 * Rebuild a saved AEO or AEO/SEO story run into the shape its charts want.
 *
 * Works on both surfaces: the site audit writes `isSubject` on its fetch turns
 * and the story audit writes `isOurs`, and both write the checks the matrix
 * reads. Where the site audit has no subject coverage, the coverage table is
 * simply not rendered for it.
 */
export function replayAeoRun(run: EvalRun, turns: EvalTurn[]): ReplayedRun {
  const metadata = run.metadata ?? {};

  // A fetch turn is the one carrying a url and a check list. Ordering follows
  // turn_index, which is audit order — ours first — and the charts rely on
  // index 0 being ours.
  const fetchTurns = [...turns]
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .filter((t) => t.role === 'event' && t.metadata?.url);

  const signals: StorySignals[] = [];
  let complete = true;
  for (const turn of fetchTurns) {
    const signal = readSignal(turn);
    if (!signal) {
      complete = false;
      continue;
    }
    if (signal.checks.length === 0 && signal.ok) complete = false;
    signals.push(signal);
  }

  const analystTurn = turns.find((t) => t.metadata?.analyst === true);
  const errorTurn = turns.find((t) => t.metadata?.analystError || t.metadata?.analystSkipped);

  let analysis: StoryAnalysis | null = null;
  let analystText: string | null = null;

  if (analystTurn) {
    const m = analystTurn.metadata ?? {};
    const verdict = typeof m.verdict === 'string' ? m.verdict : '';
    analysis = {
      verdict,
      advantages: Array.isArray(m.advantages) ? m.advantages : [],
      recommendations: Array.isArray(m.recommendations) ? m.recommendations : [],
      model: String(m.model ?? ''),
    };
    // Runs saved before the verdict was stored structurally still have the
    // analyst's prose in the turn body. Shown rather than dropped — it is the
    // part a person actually reads.
    if (!verdict) analystText = analystTurn.content || null;
  }

  return {
    subject: String(metadata.subject ?? ''),
    signals,
    subjectScore: typeof metadata.subjectScore === 'number' ? metadata.subjectScore : null,
    fieldMedian: typeof metadata.fieldMedian === 'number' ? metadata.fieldMedian : null,
    analysis,
    analystText,
    analystError: errorTurn
      ? String(errorTurn.metadata?.analystError ?? errorTurn.content ?? '')
      : null,
    complete: complete && signals.length > 0,
  };
}

/** Whether a run is one this module knows how to rebuild. */
export function isReplayable(run: EvalRun): boolean {
  return run.surface === 'aeo-story' || run.surface === 'aeo-audit';
}
