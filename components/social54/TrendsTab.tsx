'use client';

/**
 * Trends — macro drift and micro spikes, kept apart.
 *
 * The two horizons are rendered in separate sections with different weight,
 * because the failure this tab exists to prevent is a micro observation being
 * read as a strategic finding. The archive depth sits above both, since it is
 * the thing that decides whether a macro claim is possible at all.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { AgentProvider } from '@/lib/social/types';
import type { Trend } from '@/lib/social/agents/trends';
import { platformLabel } from '@/lib/social/types';
import { runTrends, type TrendsResult } from './api';
import {
  Banner,
  CaveatPanel,
  Empty,
  MetricCell,
  ParseErrorNotice,
  ProviderPicker,
  RunButton,
  SectionLabel,
  Spinner,
  WindowPicker,
} from './shared';

/** Under three weeks of archive, nothing here can be a multi-week trend. */
const MACRO_MINIMUM_DAYS = 21;

export function TrendsTab({ account }: { account: Account | null }) {
  const [windowDays, setWindowDays] = useState(14);
  const [lookbackDays, setLookbackDays] = useState(60);
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrendsResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await runTrends(account, { windowDays, lookbackDays, provider }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const macro = result?.report.trends.filter((t) => t.horizon === 'macro') ?? [];
  const micro = result?.report.trends.filter((t) => t.horizon === 'micro') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl">Trends</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          Reads the field over a live window plus the stored archive. Macro findings are structural
          and survive the next post; micro findings are this week and expire. They are never
          presented as the same thing.
        </p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <WindowPicker value={windowDays} onChange={setWindowDays} disabled={busy} label="Live window" />
        <WindowPicker
          value={lookbackDays}
          onChange={setLookbackDays}
          disabled={busy}
          label="Archive lookback"
          options={[30, 60, 90]}
        />
        <ProviderPicker value={provider} onChange={setProvider} disabled={busy} />
        <RunButton onClick={run} busy={busy}>
          Read the field
        </RunButton>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && <Spinner label="Pulling the field, computing the statistics, then reading them…" />}

      {!busy && !result && <Empty>No trend run yet.</Empty>}

      {result && !busy && (
        <>
          <CaveatPanel caveats={result.caveats} />

          {result.archiveDays !== null && result.archiveDays < MACRO_MINIMUM_DAYS && (
            <Banner tone="warn">
              <strong className="font-medium">
                The archive holds {result.archiveDays} day{result.archiveDays === 1 ? '' : 's'} of
                posts.
              </strong>{' '}
              That is under three weeks, so nothing here can support a multi-week trend claim yet.
              Keep pulling — the archive deepens with every run, and macro findings become possible
              once it passes {MACRO_MINIMUM_DAYS} days.
            </Banner>
          )}

          <div className="border-l-2 border-black pl-4 py-1">
            <SectionLabel>Where we stand</SectionLabel>
            <p className="font-georgia-pro text-lg text-gray-900">{result.headline}</p>
          </div>

          <ParseErrorNotice error={result.report.parseError} />

          {result.report.verdict && (
            <p className="font-georgia-pro text-[16px] text-gray-900 leading-relaxed whitespace-pre-wrap">
              {result.report.verdict}
            </p>
          )}

          {result.report.historyNote && (
            <p className="font-georgia-pro text-[14px] text-gray-500 italic border-l-2 border-gray-200 pl-3">
              {result.report.historyNote}
            </p>
          )}

          {result.report.actions.length > 0 && (
            <div className="border border-gray-900 rounded-md p-4">
              <SectionLabel>This week</SectionLabel>
              <ul className="space-y-2">
                {result.report.actions.map((action, i) => (
                  <li key={i} className="font-georgia-pro text-[15px] text-gray-900">
                    → {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <TrendSection
            title="Macro — structural, multi-week"
            blurb="These change what we commission."
            trends={macro}
            emphasis
          />
          <TrendSection
            title="Micro — this week, expires"
            blurb="These change what we post on Thursday."
            trends={micro}
          />

          {result.report.gaps.length > 0 && (
            <div>
              <SectionLabel>Coverage gaps</SectionLabel>
              <div className="space-y-3">
                {result.report.gaps.map((gap, i) => (
                  <div key={i} className="border border-gray-200 rounded-md p-4">
                    <p className="font-georgia-pro text-[15px] text-gray-900">{gap.subject}</p>
                    <p className="font-mono text-[11px] text-gray-400 mt-0.5">
                      covered by {gap.whoCovered}
                    </p>
                    {gap.fit && (
                      <p className="font-georgia-pro text-[14px] text-gray-600 mt-1">{gap.fit}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <FieldTable result={result} />

          <p className="text-[11px] font-mono text-gray-400">read by {result.report.model}</p>
        </>
      )}
    </div>
  );
}

function TrendSection({
  title,
  blurb,
  trends,
  emphasis,
}: {
  title: string;
  blurb: string;
  trends: Trend[];
  emphasis?: boolean;
}) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      <p className="font-georgia-pro text-[13px] text-gray-400 -mt-1 mb-3">{blurb}</p>
      {trends.length === 0 ? (
        <p className="font-georgia-pro text-[14px] text-gray-400 italic">
          Nothing reported at this horizon.
        </p>
      ) : (
        <div className="space-y-3">
          {trends.map((trend, i) => (
            <div
              key={i}
              className={`border rounded-md p-4 ${emphasis ? 'border-gray-900' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] uppercase tracking-[0.12em] font-mono text-gray-400">
                  {trend.confidence}
                </span>
                {trend.accounts.map((handle) => (
                  <span key={handle} className="font-mono text-[11px] text-gray-500">
                    {handle}
                  </span>
                ))}
              </div>
              <p className="font-adonis text-lg text-gray-900">{trend.headline}</p>
              {trend.detail && (
                <p className="font-georgia-pro text-[15px] text-gray-700 mt-1 leading-relaxed">
                  {trend.detail}
                </p>
              )}
              {trend.evidence && (
                <p className="font-mono text-[11px] text-gray-400 mt-2">{trend.evidence}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The computed statistics behind the prose, so any claim can be checked. */
function FieldTable({ result }: { result: TrendsResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.16em] text-gray-500 hover:text-gray-900 transition-colors"
      >
        {open ? 'Hide the numbers' : 'Show the numbers these findings rest on'}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-5">
          {result.stats.platforms.map((platform) => (
            <div key={platform.platform}>
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h4 className="font-adonis text-base">{platformLabel(platform.platform)}</h4>
                <span className="font-mono text-[10px] text-gray-400">
                  compared on {platform.comparableOn.join(' + ') || 'nothing comparable'}
                </span>
              </div>
              {platform.comparisonBlocked && (
                <p className="font-georgia-pro text-[13px] text-amber-800 mb-1">
                  {platform.comparisonBlocked}
                </p>
              )}
              {platform.competitors.length > 0 && !platform.comparability.rateIsMeaningful && (
                <p className="font-georgia-pro text-[13px] text-amber-800 mb-1">
                  <strong className="font-medium">Rate isn&rsquo;t comparable here.</strong>{' '}
                  {platform.comparability.explanation}
                </p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
                    <th className="px-3 py-1.5 text-left font-medium">Account</th>
                    <th className="px-3 py-1.5 text-right font-medium">Followers</th>
                    <th className="px-3 py-1.5 text-right font-medium">Posts/wk</th>
                    <th className="px-3 py-1.5 text-right font-medium">Median eng.</th>
                    <th className="px-3 py-1.5 text-right font-medium">Median rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[platform.ours, ...platform.competitors]
                    .filter((a) => a !== null)
                    .map((account) => (
                      <tr key={account!.handle} className={account!.isOurs ? 'bg-gray-50' : ''}>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          @{account!.handle}
                          {account!.isOurs && (
                            <span className="ml-2 text-[10px] uppercase" style={{ color: '#FF6B6B' }}>
                              ours
                            </span>
                          )}
                        </td>
                        <MetricCell value={account!.followers} />
                        <MetricCell value={account!.postsPerWeek} />
                        <MetricCell value={account!.medianEngagement} emphasis={account!.isOurs} />
                        <MetricCell value={account!.medianRate} suffix="%" emphasis={account!.isOurs} />
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}

          {result.stats.tagDeltas.length > 0 && (
            <div>
              <SectionLabel>Tag divergence</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {result.stats.tagDeltas.slice(0, 20).map((delta) => (
                  <span
                    key={delta.tag}
                    title={`ours ${delta.oursCount} · field ${delta.theirsCount}`}
                    className="font-mono text-[11px] border border-gray-200 rounded-full px-2 py-0.5 text-gray-600"
                  >
                    #{delta.tag}{' '}
                    <span className={delta.theirsCount > delta.oursCount ? 'text-red-600' : 'text-emerald-700'}>
                      {delta.oursCount}/{delta.theirsCount}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
