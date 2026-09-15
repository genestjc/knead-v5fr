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
import { PulseTab } from './PulseTab';
import { CoverageTab } from './CoverageTab';
import { SentimentTab } from './SentimentTab';
import { TrendsTab } from './TrendsTab';
import { HeadToHeadTab } from './HeadToHeadTab';
import { ComposerTab } from './ComposerTab';
import { CompetitorsTab } from './CompetitorsTab';
import { HistoryTab } from './HistoryTab';

type TabId =
  | 'pulse'
  | 'coverage'
  | 'sentiment'
  | 'trends'
  | 'head-to-head'
  | 'composer'
  | 'competitors'
  | 'history';

const TABS: { id: TabId; label: string; sub: string }[] = [
  { id: 'pulse', label: 'Pulse', sub: 'Every platform, right now.' },
  { id: 'coverage', label: 'Coverage', sub: 'What they published. No keys.' },
  { id: 'sentiment', label: 'Sentiment', sub: 'What the replies say.' },
  { id: 'trends', label: 'Trends', sub: 'Macro drift, micro spikes.' },
  { id: 'head-to-head', label: 'Head to Head', sub: 'Our post vs theirs.' },
  { id: 'composer', label: 'Composer', sub: 'Drafts for what we publish.' },
  { id: 'competitors', label: 'Competitors', sub: 'Who we measure against.' },
  { id: 'history', label: 'History', sub: 'Every saved analysis.' },
];

export function SocialConsole({ account }: { account: Account | null }) {
  const [tab, setTab] = useState<TabId>('pulse');

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
            Instagram, X, Farcaster, Zora and LinkedIn in one place, with agents that read the
            replies, track what the field is doing, and compare our posts against the competition on
            the subjects we are writing about.
          </p>
          {!loading && (
            <p className="mt-2 text-[11px] font-mono text-gray-400">
              {reachable} of {platforms.length} platforms reachable · {competitors.length}{' '}
              competitors on the roster · {archive.posts} posts archived
            </p>
          )}
        </div>

        <div className="max-w-6xl mx-auto px-6 overflow-x-auto">
          <div className="flex gap-7 -mb-px min-w-max">
            {TABS.map((t) => {
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
