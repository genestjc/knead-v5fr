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
import type { EvalCriterion, EvalRun } from '@/lib/eval/types';
import type { AeoSignals, CheckStatus } from '@/lib/eval/aeo-signals';
import { startAeoAudit } from './api';
import { Banner, KNEAD_RED, SectionLabel } from './shared';
import { RunDetail } from './RunDetail';

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
  const [subjectUrl, setSubjectUrl] = useState('https://www.kneadmag.com');
  const [competitors, setCompetitors] = useState(DEFAULT_COMPETITORS);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<AeoSignals[] | null>(null);
  const [subjectScore, setSubjectScore] = useState<number | null>(null);
  const [fieldMedian, setFieldMedian] = useState<number | null>(null);

  const auditCriteria = criteria.filter((c) => c.surface === 'aeo-audit' && c.isActive);

  async function launch() {
    setError(null);
    setSignals(null);
    onSelectRun(null);
    setRunning(true);
    try {
      const competitorUrls = competitors
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);

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

  const targetCount = 1 + competitors.split(/[\n,]/).filter((s) => s.trim()).length;

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Run an audit</SectionLabel>
        <p className="mt-2 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
          Fetches each site and grades what an answer engine actually receives — whether it can tell
          this is a publication, whether bylines resolve to people, and whether the prose survives
          extraction. Every finding is deterministic; the judge grades the rubric against them.
        </p>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

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
          onClick={launch}
          disabled={running || !subjectUrl.trim()}
          className="px-5 py-2.5 rounded text-white text-sm font-medium disabled:opacity-40"
          style={{ backgroundColor: KNEAD_RED }}
        >
          {running ? `Auditing ${targetCount} site${targetCount === 1 ? '' : 's'}…` : 'Run audit'}
        </button>
        <span className="text-[13px] text-gray-500">
          {targetCount} site{targetCount === 1 ? '' : 's'} · up to 8 · each takes a few seconds
        </span>
        {auditCriteria.length === 0 && (
          <span className="text-[13px] text-amber-700">
            No active AEO rubric rows — add them in Rubric Setting before judging.
          </span>
        )}
      </div>

      {running && (
        <div className="py-10 text-center">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-black mx-auto mb-3" />
          <p className="font-georgia-pro text-gray-500">
            Fetching each site plus its robots.txt, sitemap.xml and llms.txt…
          </p>
        </div>
      )}

      {signals && signals.length > 0 && (
        <Scoreboard signals={signals} subjectScore={subjectScore} fieldMedian={fieldMedian} />
      )}

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

function Scoreboard({
  signals,
  subjectScore,
  fieldMedian,
}: {
  signals: AeoSignals[];
  subjectScore: number | null;
  fieldMedian: number | null;
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
            Subject scores <strong>{subjectScore}</strong>; the field median is{' '}
            <strong>{fieldMedian}</strong>{' '}
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
