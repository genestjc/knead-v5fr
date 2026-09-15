'use client';

/**
 * Social 54 — the console shell.
 *
 * Owns the state every tab reads: which platforms this environment can
 * actually reach, the competitor roster, and how deep the post archive is.
 * Keeping it here means the roster the Competitors tab edits is the same
 * object every comparison runs against, not a copy — the same arrangement
 * ProbatioConsole uses for the rubric.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { PlatformStatus } from '@/lib/social/config';
import { SOCIAL54_DEMO_MODE } from '@/lib/social/demo-mode';
import type { Competitor } from '@/lib/social/types';
import { fetchConsoleState } from './api';
import { Banner, Spinner } from './shared';
import { JudgeTab } from './JudgeTab';
import { RubricTab } from './RubricTab';
import { PulseTab } from './PulseTab';
import { CoverageTab } from './CoverageTab';
import { SentimentTab } from './SentimentTab';
import { TrendsTab } from './TrendsTab';
import { HeadToHeadTab } from './HeadToHeadTab';
import { ComposerTab } from './ComposerTab';
import { CompetitorsTab } from './CompetitorsTab';
import { HistoryTab } from './HistoryTab';

type TabId =
  | 'judge'
  | 'rubric'
  | 'composer'
  | 'coverage'
  | 'competitors'
  | 'history'
  | 'pulse'
  | 'sentiment'
  | 'trends'
  | 'head-to-head';

/**
 * Judge first, then the rubric it grades against.
 *
 * The order is the argument. This console began as five metric connectors and
 * a dashboard, and at a few hundred followers those numbers could not carry a
 * conclusion — lib/social/scale.ts exists to say so. What a post DOES is
 * readable from the post, needs no credential, and is the part that can change
 * on Thursday. So the agent layer leads and the collection sits behind it.
 */
const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'judge', label: 'Judge', sub: 'Paste or screenshot. Graded.' },
  { id: 'rubric', label: 'Rubric', sub: 'What good looks like.' },
  { id: 'composer', label: 'Composer', sub: 'Drafts for what we publish.' },
  { id: 'coverage', label: 'Coverage', sub: 'What they published. No keys.' },
  { id: 'competitors', label: 'Competitors', sub: 'Who we measure against.' },
  { id: 'history', label: 'History', sub: 'Every saved analysis.' },
];

/**
 * The metric surfaces, kept but moved out of the way.
 *
 * They work, and on a day when Instagram has a token they are worth opening.
 * They are not what the console is for, so they sit behind a disclosure rather
 * than competing with the judge for the first click.
 */
const METRIC_TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'pulse', label: 'Pulse', sub: 'Platform metrics, where we have them.' },
  { id: 'sentiment', label: 'Sentiment', sub: 'Replies, pulled by API.' },
  { id: 'trends', label: 'Trends', sub: 'Macro drift, micro spikes.' },
  { id: 'head-to-head', label: 'Head to Head', sub: 'Scored, not judged.' },
];

export function SocialConsole({ account }: { account: Account | null }) {
  const [tab, setTab] = useState<TabId>('judge');
  const [showMetrics, setShowMetrics] = useState(false);

  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [archive, setArchive] = useState<{ earliest: string | null; posts: number }>({
    earliest: null,
    posts: 0,
  });
  const [seedError, setSeedError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read through a ref so the loader stays identity-stable: depending on the
  // account object directly re-fires the effect on every render where thirdweb
  // hands back a fresh object, which is a signature prompt per render.
  const accountRef = useRef(account);
  accountRef.current = account;
  const address = account?.address ?? 'demo';

  const load = useCallback(async () => {
    try {
      const state = await fetchConsoleState(accountRef.current);
      setPlatforms(state.platforms);
      setCompetitors(state.competitors);
      setArchive(state.archive);
      setSeedError(state.seedError);
    } catch (err: any) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the address so a wallet switch refetches; the account is read via ref
  }, [address]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      await load();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const reachable = platforms.filter((p) => p.configured || p.publicReadable).length;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-adonis text-5xl leading-none">Social 54</h1>
            <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
              Knead · social monitoring
            </span>
          </div>
          <p className="mt-3 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
            Agents that read our posts the way an editor would — graded against a rubric you
            control, with the quote behind every verdict and the edits worth making. Paste a
            caption or screenshot it; no platform credentials required.
          </p>
          {!loading && (
            <p className="mt-2 text-[11px] font-mono text-gray-400">
              {reachable} of {platforms.length} platforms reachable · {competitors.length}{' '}
              competitors on the roster · {archive.posts} posts archived
            </p>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <div className="flex gap-7 -mb-px min-w-max items-end">
            {(showMetrics ? [...TABS, ...METRIC_TABS] : TABS).map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`pb-3 border-b-2 text-left transition-colors ${
                    active ? 'border-black' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <div
                    className={`font-adonis text-lg leading-tight ${
                      active ? 'text-black' : 'text-gray-400'
                    }`}
                  >
                    {t.label}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{t.sub}</div>
                </button>
              );
            })}
            <button
              onClick={() => setShowMetrics((v) => !v)}
              className="pb-3 text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900 transition-colors"
              title="Platform metrics. They need credentials, and at our audience size they carry less than the judge does."
            >
              {showMetrics ? '− metrics' : '+ metrics'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* These routes spend model budget and return unpublished editorial
            strategy, so the bypass is loud whenever it is on. */}
        {SOCIAL54_DEMO_MODE && (
          <div className="border border-red-300 bg-red-50 rounded-md px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-red-700 font-medium">
              Demo mode · authentication disabled
            </p>
            <p className="mt-1 font-georgia-pro text-sm text-red-900">
              Wallet auth is bypassed on this page and every{' '}
              <span className="font-mono text-[13px]">/api/social/*</span> route. Anyone with the URL
              can read the monitoring data, start analyses against your API keys, and edit the
              roster. Set <span className="font-mono text-[13px]">SOCIAL54_DEMO_MODE = false</span>{' '}
              in <span className="font-mono text-[13px]">lib/social/demo-mode.ts</span> to restore
              it.
            </p>
          </div>
        )}

        {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

        {loading ? (
          <Spinner label="Checking what this console can reach…" />
        ) : tab === 'judge' ? (
          <JudgeTab account={account} />
        ) : tab === 'rubric' ? (
          <RubricTab account={account} />
        ) : tab === 'pulse' ? (
          <PulseTab account={account} platforms={platforms} archive={archive} />
        ) : tab === 'coverage' ? (
          <CoverageTab account={account} />
        ) : tab === 'sentiment' ? (
          <SentimentTab account={account} />
        ) : tab === 'trends' ? (
          <TrendsTab account={account} />
        ) : tab === 'head-to-head' ? (
          <HeadToHeadTab account={account} />
        ) : tab === 'composer' ? (
          <ComposerTab account={account} />
        ) : tab === 'competitors' ? (
          <CompetitorsTab
            account={account}
            competitors={competitors}
            seedError={seedError}
            onChanged={load}
          />
        ) : (
          <HistoryTab account={account} />
        )}
      </main>
    </div>
  );
}
