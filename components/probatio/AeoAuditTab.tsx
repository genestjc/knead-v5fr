'use client';

/**
 * AEO Audit — how citable is this publication, against the field?
 *
 * Every other tab in Probatio grades Knead's own AI products. This one grades
 * *websites*: Knead's, and the publications it competes with for a citation.
 *
 * The comparison is the whole design. An absolute score is hard to act on —
 * 61/100 means nothing alone. "61 against a field median of 44, and last of
 * five on byline entities" tells an editor what to do next.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalProvider, EvalRun } from '@/lib/eval/types';
import type { AeoSignals, CheckStatus } from '@/lib/eval/aeo-signals';
import type { StoryAnalysis } from '@/lib/eval/aeo-analyst';
import { startAeoAudit, startStoryAudit, type StorySignalsLite } from './api';
import { Banner, KNEAD_RED, SectionLabel } from './shared';
import { RunDetail } from './RunDetail';

type Mode = 'site' | 'story';

/** A starting field. Editable — these are just the sites worth beating. */
const DEFAULT_COMPETITORS = [
  'https://www.itsnicethat.com',
  'https://www.thecreativeindependent.com',
  'https://hyperallergic.com',
  'https://www.colossal.com',
].join('\n');

export function AeoAuditTab({
  account,
  criteria,
  selectedRun,
  onSelectRun,
  onRefreshRuns,
  onRefreshSelected,
}: {
  account: Account | null;
  criteria: EvalCriterion[];
  selectedRun: EvalRun | null;
  onSelectRun: (id: string | null) => void;
  onRefreshRuns: () => void;
  onRefreshSelected: () => void;
}) {
  const [mode, setMode] = useState<Mode>('site');

  // Site mode
  const [subjectUrl, setSubjectUrl] = useState('https://www.kneadmag.com');
  const [competitors, setCompetitors] = useState(DEFAULT_COMPETITORS);

  // Story mode
  const [storySubject, setStorySubject] = useState('');
  const [ourUrl, setOurUrl] = useState('');
  const [storyCompetitors, setStoryCompetitors] = useState('');
  const [provider, setProvider] = useState<EvalProvider>('claude');
  const [analyze, setAnalyze] = useState(true);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<AeoSignals[] | null>(null);
  const [storySignals, setStorySignals] = useState<StorySignalsLite[] | null>(null);
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [subjectScore, setSubjectScore] = useState<number | null>(null);
  const [fieldMedian, setFieldMedian] = useState<number | null>(null);

  const activeSurface = mode === 'site' ? 'aeo-audit' : 'aeo-story';
  const auditCriteria = criteria.filter((c) => c.surface === activeSurface && c.isActive);

  function resetResults() {
    setError(null);
    setSignals(null);
    setStorySignals(null);
    setAnalysis(null);
    onSelectRun(null);
  }

  async function launchSite() {
    resetResults();
    setRunning(true);
    try {
      const competitorUrls = splitUrls(competitors);
      const out = await startAeoAudit(account, { subjectUrl: subjectUrl.trim(), competitorUrls });
      setSignals(out.signals);
      setSubjectScore(out.subjectScore);
      setFieldMedian(out.fieldMedian);
      onRefreshRuns();
      await onSelectRun(out.run.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  async function launchStory() {
    resetResults();
    setRunning(true);
    try {
      const out = await startStoryAudit(account, {
        subject: storySubject.trim(),
        ourUrl: ourUrl.trim(),
        competitorUrls: splitUrls(storyCompetitors),
        provider,
        analyze,
      });
      setStorySignals(out.signals);
      setAnalysis(out.analysis);
      setSubjectScore(out.subjectScore);
      setFieldMedian(out.fieldMedian);
      onRefreshRuns();
      await onSelectRun(out.run.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  const siteCount = 1 + splitUrls(competitors).length;
  const storyCount = 1 + splitUrls(storyCompetitors).length;

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>What are we auditing?</SectionLabel>
        <div className="mt-3 inline-flex rounded-md border border-gray-300 overflow-hidden">
          {(
            [
              ['site', 'Publication', 'Can an engine tell what we are?'],
              ['story', 'Story vs story', 'Who wins the citation on one subject?'],
            ] as const
          ).map(([id, label, sub]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              disabled={running}
              className={`px-4 py-2.5 text-left transition-colors ${
                mode === id ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className={`text-[11px] ${mode === id ? 'text-gray-300' : 'text-gray-500'}`}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {mode === 'site' ? (
        <>
          <p className="font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
            Fetches each site and grades what an answer engine actually receives — whether it can
            tell this is a publication, whether bylines resolve to people, and whether the prose
            survives extraction. Every finding is deterministic.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                Subject — the publication under test
              </label>
              <input
                type="url"
                value={subjectUrl}
                onChange={(e) => setSubjectUrl(e.target.value)}
                placeholder="https://www.kneadmag.com"
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-[13px] focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                The field — one URL per line
              </label>
              <textarea
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                rows={5}
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-[13px] focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={launchSite}
              disabled={running || !subjectUrl.trim()}
              className="px-5 py-2.5 rounded text-white text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: KNEAD_RED }}
            >
              {running ? `Auditing ${siteCount} site${siteCount === 1 ? '' : 's'}…` : 'Run audit'}
            </button>
            <span className="text-[13px] text-gray-500">
              {siteCount} site{siteCount === 1 ? '' : 's'} · up to 8
            </span>
            <RubricWarning count={auditCriteria.length} />
          </div>
        </>
      ) : (
        <>
          <p className="font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
            Pick a subject we&rsquo;ve covered and the competitors who covered it too. Every piece is
            scored on subject resolution and retrievability, then an analyst reads the actual prose
            and says what theirs has that ours doesn&rsquo;t — with a quote for every claim.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                  Subject — who or what every piece is about
                </label>
                <input
                  type="text"
                  value={storySubject}
                  onChange={(e) => setStorySubject(e.target.value)}
                  placeholder="Richard Nadler"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-[14px] focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                  Our story
                </label>
                <input
                  type="url"
                  value={ourUrl}
                  onChange={(e) => setOurUrl(e.target.value)}
                  placeholder="https://www.kneadmag.com/posts/…"
                  className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-[13px] focus:outline-none focus:border-black"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                Their stories on the same subject — one URL per line
              </label>
              <textarea
                value={storyCompetitors}
                onChange={(e) => setStoryCompetitors(e.target.value)}
                rows={7}
                placeholder={'https://hyperallergic.com/…\nhttps://www.itsnicethat.com/…'}
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-[13px] focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              onClick={launchStory}
              disabled={running || !storySubject.trim() || !ourUrl.trim() || storyCount < 2}
              className="px-5 py-2.5 rounded text-white text-sm font-medium disabled:opacity-40"
              style={{ backgroundColor: KNEAD_RED }}
            >
              {running ? `Comparing ${storyCount} stories…` : 'Compare stories'}
            </button>

            <label className="flex items-center gap-2 text-[13px] text-gray-700">
              <input
                type="checkbox"
                checked={analyze}
                onChange={(e) => setAnalyze(e.target.checked)}
                disabled={running}
              />
              Run the analyst
            </label>

            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as EvalProvider)}
              disabled={running || !analyze}
              className="text-[13px] border border-gray-300 rounded px-2 py-1.5 bg-white disabled:opacity-40"
            >
              <option value="claude">Claude</option>
              <option value="openai">GPT</option>
            </select>

            <span className="text-[13px] text-gray-500">
              {storyCount} stor{storyCount === 1 ? 'y' : 'ies'} · up to 6
            </span>
            <RubricWarning count={auditCriteria.length} />
          </div>
        </>
      )}

      {running && (
        <div className="py-10 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-black mx-auto mb-3" />
          <p className="font-georgia-pro text-gray-500">
            {mode === 'site'
              ? 'Fetching each site plus its robots.txt, sitemap.xml and llms.txt…'
              : analyze
              ? 'Fetching each story, then reading them side by side…'
              : 'Fetching each story…'}
          </p>
        </div>
      )}

      {signals && signals.length > 0 && (
        <Scoreboard signals={signals} subjectScore={subjectScore} fieldMedian={fieldMedian} />
      )}

      {storySignals && storySignals.length > 0 && (
        <>
          <Scoreboard
            signals={storySignals as unknown as AeoSignals[]}
            subjectScore={subjectScore}
            fieldMedian={fieldMedian}
            subjectLabel="ours"
          />
          <CoverageTable signals={storySignals} subject={storySubject} />
        </>
      )}

      {analysis && <AnalystPanel analysis={analysis} />}

      {selectedRun && (
        <div className="pt-4 border-t border-gray-200">
          <RunDetail
            account={account}
            run={selectedRun}
            criteria={criteria}
            onRefresh={() => {
              onRefreshRuns();
              onRefreshSelected();
            }}
            onClose={() => onSelectRun(null)}
          />
        </div>
      )}
    </div>
  );
}

function splitUrls(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function RubricWarning({ count }: { count: number }) {
  if (count > 0) return null;
  return (
    <span className="text-[13px] text-amber-700">
      No active rubric rows for this mode — add them in Rubric Setting before judging.
    </span>
  );
}

function Scoreboard({
  signals,
  subjectScore,
  fieldMedian,
  subjectLabel = 'subject',
}: {
  signals: AeoSignals[];
  subjectScore: number | null;
  fieldMedian: number | null;
  subjectLabel?: string;
}) {
  const ranked = [...signals].sort((a, b) => b.score - a.score);
  // Union of check ids so the matrix has a row per signal even when one site
  // failed its fetch and produced only the reachability check.
  const checkIds = Array.from(new Set(signals.flatMap((s) => s.checks.map((c) => c.id))));
  const labelFor = (id: string) =>
    signals.flatMap((s) => s.checks).find((c) => c.id === id)?.label ?? id;

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Scoreboard</SectionLabel>
        {subjectScore !== null && fieldMedian !== null && (
          <p className="mt-2 font-georgia-pro text-[15px] text-gray-700">
            <span className="capitalize">{subjectLabel}</span> scores <strong>{subjectScore}</strong>;
            the field median is <strong>{fieldMedian}</strong>{' '}
            <span className={subjectScore >= fieldMedian ? 'text-green-700' : 'text-red-700'}>
              ({subjectScore >= fieldMedian ? '+' : ''}
              {subjectScore - fieldMedian})
            </span>
            .
          </p>
        )}
        <div className="mt-4 space-y-2">
          {ranked.map((s) => (
            <div key={s.url} className="flex items-center gap-3">
              <div className="w-12 text-right font-mono text-[13px] tabular-nums">{s.score}</div>
              <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(s.score, 2)}%`,
                    backgroundColor: isSubject(s, signals) ? KNEAD_RED : '#D4D4D4',
                  }}
                />
              </div>
              <div className="w-64 truncate text-[13px]">
                <span className={isSubject(s, signals) ? 'font-semibold' : 'text-gray-600'}>
                  {hostOf(s.finalUrl || s.url)}
                </span>
                {!s.ok && <span className="ml-2 text-red-600 text-[12px]">unreachable</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Check by check</SectionLabel>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                <th className="text-left font-medium text-gray-500 pb-2 pr-4 whitespace-nowrap">
                  Signal
                </th>
                {ranked.map((s) => (
                  <th
                    key={s.url}
                    className="pb-2 px-2 font-medium text-gray-500 text-[11px] whitespace-nowrap"
                    title={s.finalUrl || s.url}
                  >
                    {hostOf(s.finalUrl || s.url).replace(/^www\./, '').slice(0, 16)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checkIds.map((id) => (
                <tr key={id} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-800">{labelFor(id)}</td>
                  {ranked.map((s) => {
                    const check = s.checks.find((c) => c.id === id);
                    return (
                      <td key={s.url} className="py-2 px-2 text-center">
                        <StatusDot status={check?.status} detail={check?.detail} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-gray-500">
          Hover any mark for what was actually found. Grey means the check did not apply to the page
          that was fetched.
        </p>
      </div>
    </div>
  );
}

/**
 * Subject resolution, side by side.
 *
 * Broken out from the check matrix because it is the thing that most often
 * explains a lost citation and is the easiest to fix: a piece that never names
 * its subject in the title or the lede is not going to be retrieved for that
 * subject however well it is reported.
 */
function CoverageTable({ signals, subject }: { signals: StorySignalsLite[]; subject: string }) {
  const cols: { key: keyof StorySignalsLite['coverage']; label: string }[] = [
    { key: 'inTitle', label: 'Title' },
    { key: 'inDescription', label: 'Description' },
    { key: 'inSchemaAbout', label: 'schema.about' },
    { key: 'inOpening', label: 'Lede' },
    { key: 'matchedFullName', label: 'Full name' },
  ];

  return (
    <div>
      <SectionLabel>Where &ldquo;{subject || 'the subject'}&rdquo; appears</SectionLabel>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-gray-500 pb-2 pr-4">Story</th>
              {cols.map((c) => (
                <th key={String(c.key)} className="pb-2 px-2 font-medium text-gray-500 text-[11px] whitespace-nowrap">
                  {c.label}
                </th>
              ))}
              <th className="pb-2 px-2 font-medium text-gray-500 text-[11px]">Mentions</th>
              <th className="pb-2 px-2 font-medium text-gray-500 text-[11px]">Quotes</th>
              <th className="pb-2 px-2 font-medium text-gray-500 text-[11px]">Words</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s, i) => (
              <tr key={s.url} className="border-t border-gray-100">
                <td className="py-2 pr-4">
                  <span className={i === 0 ? 'font-semibold' : 'text-gray-600'}>
                    {hostOf(s.finalUrl || s.url).replace(/^www\./, '')}
                  </span>
                  {i === 0 && <span className="ml-2 text-[11px] uppercase tracking-wider text-gray-400">ours</span>}
                </td>
                {cols.map((c) => (
                  <td key={String(c.key)} className="py-2 px-2 text-center">
                    <StatusDot status={s.coverage[c.key] ? 'pass' : 'fail'} detail={c.label} />
                  </td>
                ))}
                <td className="py-2 px-2 text-center tabular-nums">{s.coverage.mentions}</td>
                <td className="py-2 px-2 text-center tabular-nums">{s.quotedPassages}</td>
                <td className="py-2 px-2 text-center tabular-nums">{s.visibleWords}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The editorial half — judgement, labelled as judgement. */
function AnalystPanel({ analysis }: { analysis: StoryAnalysis }) {
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const recs = [...analysis.recommendations].sort((a, b) => rank[a.priority] - rank[b.priority]);
  const tone: Record<string, string> = {
    high: 'bg-red-50 border-red-200 text-red-900',
    medium: 'bg-amber-50 border-amber-200 text-amber-900',
    low: 'bg-gray-50 border-gray-200 text-gray-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Analyst</SectionLabel>
        <p className="mt-1 text-[12px] text-gray-500">
          Read by {analysis.model}. This half is judgement, not measurement — every competitor claim
          carries a quote so you can check it.
        </p>
        {analysis.verdict && (
          <p className="mt-3 font-georgia-pro text-[16px] leading-relaxed text-gray-800 max-w-3xl">
            {analysis.verdict}
          </p>
        )}
      </div>

      {analysis.advantages.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-3">
            What competitors have
          </h4>
          <div className="space-y-3">
            {analysis.advantages.map((a, i) => (
              <div key={i} className="border-l-2 border-gray-300 pl-4">
                <p className="text-[14px] text-gray-800">{a.advantage}</p>
                {a.evidence && (
                  <p className="mt-1 font-georgia-pro text-[14px] italic text-gray-600">
                    &ldquo;{a.evidence}&rdquo;
                  </p>
                )}
                {a.url && (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[12px] text-gray-500 underline"
                  >
                    {hostOf(a.url)}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-3">
            Recommended edits
          </h4>
          <div className="space-y-2">
            {recs.map((r, i) => (
              <div key={i} className={`border rounded px-4 py-3 ${tone[r.priority] ?? tone.low}`}>
                <div className="flex items-start gap-3">
                  <span className="text-[10px] uppercase tracking-[0.12em] font-semibold mt-0.5 shrink-0">
                    {r.priority}
                  </span>
                  <div>
                    <p className="text-[14px] font-medium">{r.change}</p>
                    {r.rationale && <p className="mt-1 text-[13px] opacity-80">{r.rationale}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status, detail }: { status?: CheckStatus; detail?: string }) {
  const map: Record<CheckStatus, { bg: string; ch: string }> = {
    pass: { bg: '#15803D', ch: '✓' },
    warn: { bg: '#B45309', ch: '!' },
    fail: { bg: '#B91C1C', ch: '✕' },
    na: { bg: '#D4D4D4', ch: '–' },
  };
  const style = map[status ?? 'na'];
  return (
    <span
      title={detail ?? 'Not measured'}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[11px] leading-none"
      style={{ backgroundColor: style.bg }}
    >
      {style.ch}
    </span>
  );
}

/**
 * The audit returns signals in target order with the subject first, so the
 * subject is identifiable after the display sort re-orders by score.
 */
function isSubject(s: AeoSignals, all: AeoSignals[]): boolean {
  return all.length > 0 && all[0].url === s.url;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
