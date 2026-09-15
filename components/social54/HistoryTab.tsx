'use client';

/**
 * Saved analyses.
 *
 * This tab is the reason a trend claim is checkable at all. "Their cadence is
 * rising" means nothing on its own and everything next to the run from three
 * weeks ago that said it was flat — so every analysis is kept, and the
 * rendered summary is stored alongside the structured payload so an old run
 * still reads correctly after the renderers change.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import { SOCIAL_RUN_KINDS, type SocialRun, type SocialRunKind } from '@/lib/social/types';
import { deleteRun, fetchRun, fetchRuns } from './api';
import { Banner, Empty, ReportBlock, SectionLabel, Spinner } from './shared';

export function HistoryTab({ account }: { account: Account | null }) {
  const [kind, setKind] = useState<SocialRunKind | 'all'>('all');
  const [runs, setRuns] = useState<SocialRun[]>([]);
  const [selected, setSelected] = useState<SocialRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRuns(await fetchRuns(account, kind === 'all' ? undefined : kind));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- account is stable for a session; the filter is what refetches
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    try {
      setSelected(await fetchRun(account, id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this run? The archived posts it read are kept.')) return;
    try {
      await deleteRun(account, id);
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-adonis text-2xl">History</h2>
          <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
            Every saved analysis. A trend claim is only checkable against the last one that made it.
          </p>
        </div>
        <label className="inline-flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SocialRunKind | 'all')}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono"
          >
            <option value="all">all</option>
            {SOCIAL_RUN_KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {loading ? (
        <Spinner label="Loading runs…" />
      ) : runs.length === 0 ? (
        <Empty>No saved runs yet.</Empty>
      ) : (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100 bg-gray-50">
                <th className="px-3 py-2 text-left font-medium">Kind</th>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Model</th>
                <th className="px-3 py-2 text-left font-medium">When</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={`hover:bg-gray-50 cursor-pointer ${
                    selected?.id === run.id ? 'bg-gray-50' : ''
                  }`}
                  onClick={() => open(run.id)}
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                      {run.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-georgia-pro text-[14px] text-gray-900">
                    {run.title}
                    {run.status === 'failed' && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-red-600">
                        failed
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                    {run.model ?? '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-400">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(run.id);
                      }}
                      className="text-[11px] uppercase tracking-[0.12em] text-gray-300 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <div>
              <SectionLabel>{selected.kind}</SectionLabel>
              <h3 className="font-adonis text-xl">{selected.title}</h3>
              <p className="font-mono text-[11px] text-gray-400 mt-0.5">
                {new Date(selected.createdAt).toLocaleString()}
                {selected.model ? ` · ${selected.model}` : ''}
                {selected.createdBy ? ` · ${selected.createdBy}` : ''}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900"
            >
              Close
            </button>
          </div>
          {selected.summary ? (
            <ReportBlock text={selected.summary} />
          ) : (
            <Empty>This run recorded no summary.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
