'use client';

/**
 * Probatio Parsley — the console shell.
 *
 * Owns the shared state both tabs read: the rubric, the saved runs, and
 * whichever run is currently open. Keeping it here is what makes the promise
 * in the brief literal — the rubric the Human Evaluation tab edits is the same
 * object the Agent Evaluation tab grades against, not a copy.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalRun, EvalSurface } from '@/lib/eval/types';
import { fetchCriteria, fetchRun, fetchRuns } from './api';
import { Banner } from './shared';
import { RubricTab } from './RubricTab';
import { AgentTab } from './AgentTab';

type TabId = 'human' | 'agent';

const TABS: { id: TabId; label: string; sub: string }[] = [
  {
    id: 'human',
    label: 'Human Evaluation / Rubric Setting',
    sub: 'Define the edge cases. Grade by hand.',
  },
  {
    id: 'agent',
    label: 'Agent Evaluation',
    sub: 'Send a persona through. Judge with an LLM.',
  },
];

export function ProbatioConsole({ account }: { account: Account }) {
  const [tab, setTab] = useState<TabId>('human');
  const [surface, setSurface] = useState<EvalSurface>('article-agent');

  const [criteria, setCriteria] = useState<EvalCriterion[]>([]);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The account is read through a ref so these callbacks stay identity-stable.
  // Depending on the account object directly would re-fire the load effect on
  // every render where thirdweb hands back a fresh object — a signature prompt
  // and two API calls per render.
  const accountRef = useRef(account);
  accountRef.current = account;
  const address = account.address;

  const loadCriteria = useCallback(async () => {
    try {
      setCriteria(await fetchCriteria(accountRef.current));
    } catch (err: any) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the address so a wallet switch refetches; the account itself is read via ref
  }, [address]);

  const loadRuns = useCallback(async () => {
    try {
      setRuns(await fetchRuns(accountRef.current));
    } catch (err: any) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the address so a wallet switch refetches; the account itself is read via ref
  }, [address]);

  const selectRun = useCallback(
    async (id: string | null) => {
      if (!id) return setSelectedRun(null);
      try {
        setSelectedRun(await fetchRun(accountRef.current, id));
      } catch (err: any) {
        setError(err.message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [address],
  );

  const refreshSelected = useCallback(async () => {
    if (selectedRun) await selectRun(selectedRun.id);
  }, [selectRun, selectedRun]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // One wallet signature covers both calls — adminFetch caches the proof.
      await Promise.all([loadCriteria(), loadRuns()]);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [loadCriteria, loadRuns]);

  return (
    <div className="min-h-screen bg-white">
      {/* Masthead */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-adonis text-5xl leading-none">Probatio Parsley</h1>
            <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
              Knead · AI evaluation
            </span>
          </div>
          <p className="mt-3 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
            The rubric defined here is the single source of truth. Agent runs are scored against
            these same edge cases — by you, or by Claude or GPT reading the full logs.
          </p>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-8 -mb-px">
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

      <main className="max-w-6xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6">
            <Banner onDismiss={() => setError(null)}>{error}</Banner>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4" />
            <p className="font-georgia-pro text-gray-500">Loading the rubric…</p>
          </div>
        ) : tab === 'human' ? (
          <RubricTab
            account={account}
            criteria={criteria}
            runs={runs}
            surface={surface}
            onSurfaceChange={setSurface}
            selectedRun={selectedRun}
            onSelectRun={selectRun}
            onRefreshCriteria={loadCriteria}
            onRefreshRuns={loadRuns}
            onRefreshSelected={refreshSelected}
          />
        ) : (
          <AgentTab
            account={account}
            criteria={criteria}
            selectedRun={selectedRun}
            onSelectRun={selectRun}
            onRefreshRuns={loadRuns}
            onRefreshSelected={refreshSelected}
          />
        )}
      </main>
    </div>
  );
}
