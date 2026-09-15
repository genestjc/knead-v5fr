'use client';

/**
 * Coverage — what the field published, with no credentials of any kind.
 *
 * This is the tab to open first on an environment with no platform tokens,
 * and it is deliberately the cheapest screen in the console: a fetch, a parse
 * and a sort, with no model call anywhere.
 *
 * It exists because the capability was invisible. The feed sweep only ran
 * inside a Trends analysis, so a console with no Instagram or X token showed
 * three "set a token" notices and nothing else, and looked entirely gated —
 * while the one source that needs no credentials was working the whole time
 * with nowhere to appear.
 *
 * The framing matters as much as the data: this is COVERAGE, not performance.
 * Nothing here is an engagement number, and the tab says so rather than
 * letting a dense list of headlines read as a popularity ranking.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EditorialItem, EditorialSweep } from '@/lib/social/editorial';
import { fetchCoverage, runCoverageSweep, type CoverageState } from './api';
import { Banner, Empty, RunButton, SectionLabel, Spinner, WindowPicker } from './shared';

export function CoverageTab({ account }: { account: Account | null }) {
  const [days, setDays] = useState(30);
  const [state, setState] = useState<CoverageState | null>(null);
  const [sweep, setSweep] = useState<EditorialSweep | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | 'all'>('all');

  const load = useCallback(async () => {
    try {
      setState(await fetchCoverage(account, days));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- account is stable for a session; the window is what refetches
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const result = await runCoverageSweep(account, { windowDays: days });
      setSweep(result.sweep);
      if (result.archiveError) setError(result.archiveError);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // The sweep's own items when one has just run, the archive otherwise. The
  // sweep is fresher; the archive is what survives a page reload.
  const items = sweep?.items ?? state?.items ?? [];
  const sources = [...new Set(items.map((i) => i.source))].sort();
  const shown = source === 'all' ? items : items.filter((i) => i.source === source);

  const roster = state?.roster ?? [];
  const withFeed = roster.filter((r) => r.feedUrl).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h2 className="font-adonis text-2xl">Coverage</h2>
          <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
            What the field published, read from their own feeds. <strong>No credentials, no API
            keys, no spend</strong> — and it is the one comparison that stays fair however much
            bigger their audience is. What they chose to cover, and how often.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <WindowPicker value={days} onChange={setDays} disabled={busy} options={[14, 30, 60, 90]} />
          <RunButton onClick={refresh} busy={busy}>
            Sweep feeds
          </RunButton>
        </div>
      </div>

      {/* Stated once, plainly. A dense list of headlines reads as a ranking
          unless something says it isn't one. */}
      <div className="border-l-2 border-gray-300 pl-4 py-1">
        <p className="font-georgia-pro text-[14px] text-gray-500">
          This is coverage, not performance. Nothing here is an engagement number — a piece
          appearing on this list says only that it was published.
        </p>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {roster.length > 0 && withFeed < roster.length && (
        <Banner tone="warn">
          <strong className="font-medium">
            {withFeed} of {roster.length} publications on the roster have a feed.
          </strong>{' '}
          The rest contribute nothing here — add their homepage in the Competitors tab and the feed
          is discovered from it. Their absence below is a missing feed, not editorial silence.
        </Banner>
      )}

      {loading ? (
        <Spinner label="Reading the archive…" />
      ) : busy ? (
        <Spinner label="Fetching feeds, one publication at a time…" />
      ) : items.length === 0 ? (
        <Empty>
          Nothing archived yet. Hit Sweep feeds — it needs no credentials and takes about a minute.
        </Empty>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <SectionLabel>
              {shown.length} piece{shown.length === 1 ? '' : 's'} · last {days} days
            </SectionLabel>
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              <FilterChip active={source === 'all'} onClick={() => setSource('all')}>
                All
              </FilterChip>
              {sources.map((name) => (
                <FilterChip key={name} active={source === name} onClick={() => setSource(name)}>
                  {name}
                </FilterChip>
              ))}
            </div>
          </div>

          {sweep && <SweepReport sweep={sweep} />}

          <div className="border border-gray-200 rounded-md divide-y divide-gray-50">
            {shown.map((item) => (
              <ItemRow key={item.url} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
        active
          ? 'bg-black text-white border-black'
          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

function ItemRow({ item }: { item: EditorialItem }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-mono text-[11px] text-gray-500">{item.source}</span>
        <span className="font-mono text-[11px] text-gray-400">
          {item.publishedAt?.slice(0, 10) ?? 'undated'}
        </span>
        {item.categories.slice(0, 3).map((category) => (
          <span
            key={category}
            className="font-mono text-[10px] text-gray-400 border border-gray-200 rounded-full px-1.5"
          >
            {category}
          </span>
        ))}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-400 hover:text-gray-900 underline ml-auto"
          >
            open
          </a>
        )}
      </div>
      <p className="font-georgia-pro text-[15px] text-gray-900 mt-0.5 leading-snug">{item.title}</p>
      {item.summary && (
        <p className="font-georgia-pro text-[13px] text-gray-500 mt-1 leading-snug">
          {item.summary.slice(0, 220)}
          {item.summary.length > 220 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Per-source outcome of the last sweep.
 *
 * Shown because a publication contributing nothing has two very different
 * causes — no feed, or a feed that failed — and the item list cannot
 * distinguish them. Cadence sits here too: it is the number on this screen
 * that is genuinely comparable to ours.
 */
function SweepReport({ sweep }: { sweep: EditorialSweep }) {
  const [open, setOpen] = useState(false);
  const failed = sweep.results.filter((r) => r.error).length;

  return (
    <div className="border border-gray-200 rounded-md">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.16em] text-gray-500 hover:text-gray-900 transition-colors"
      >
        {open ? 'Hide the sweep report' : `Sweep report — ${sweep.results.length} sources`}
        {failed > 0 && <span className="text-amber-700"> · {failed} could not be read</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          {sweep.results.map((result) => {
            const perWeek = ((result.items.length / sweep.windowDays) * 7).toFixed(1);
            return (
              <div key={result.source} className="flex items-baseline gap-3 flex-wrap">
                <span className="font-mono text-xs text-gray-900 min-w-[8rem]">{result.source}</span>
                {result.items.length > 0 ? (
                  <span className="font-mono text-[11px] text-gray-600">
                    {result.items.length} pieces · {perWeek}/wk
                  </span>
                ) : result.searchNotes ? (
                  <span className="font-mono text-[11px] text-amber-700">
                    no feed — read via web search, weaker evidence
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-gray-400">nothing collected</span>
                )}
                {result.error && (
                  <span className="font-georgia-pro text-[12px] text-gray-500 flex-1">
                    {result.error}
                  </span>
                )}
                {result.discoveredFeedUrl && (
                  <span
                    className="font-mono text-[11px] text-emerald-700"
                    title={result.discoveredFeedUrl}
                  >
                    feed discovered · saved
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
