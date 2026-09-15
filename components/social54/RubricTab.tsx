'use client';

/**
 * The rubric — what the judge grades against, and the reason any of this is
 * repeatable.
 *
 * An LLM asked "is this a good caption" answers differently every time and
 * none of the answers are checkable. The same model asked a specific question
 * with a stated bar gives an answer you can disagree with, and disagree with
 * the same way twice. Editing these rows is how the console's definition of
 * good stays yours rather than a model's.
 *
 * Guidance is required, not optional. Vague criteria are exactly where
 * LLM-as-judge scores drift, and a row with no stated bar is worse than no row
 * at all — it produces a verdict nobody can argue with.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import { SOCIAL_PLATFORMS, platformLabel, type SocialPlatform } from '@/lib/social/types';
import type { JudgeCriterion } from '@/lib/social/judge/types';
import { addCriterion, fetchRubric, patchCriterion, removeCriterion } from './api';
import { Banner, Empty, PlatformPill, SectionLabel, Spinner } from './shared';

export function RubricTab({ account }: { account: Account | null }) {
  const [criteria, setCriteria] = useState<JudgeCriterion[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SocialPlatform | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const { criteria: rows, seedError: seed } = await fetchRubric(account);
      setCriteria(rows);
      setSeedError(seed);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one load per mount
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(criterion: JudgeCriterion) {
    setBusyId(criterion.id);
    try {
      await patchCriterion(account, criterion.id, { isActive: !criterion.isActive });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(criterion: JudgeCriterion) {
    if (
      !window.confirm(
        `Delete "${criterion.prompt}"? Past judgements that scored against it keep their verdicts, but nothing new will be graded on it. Deactivating instead keeps it reversible.`,
      )
    ) {
      return;
    }
    setBusyId(criterion.id);
    try {
      await removeCriterion(account, criterion.id);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const shown =
    filter === 'all'
      ? criteria
      : criteria.filter((c) => c.platform === null || c.platform === filter);

  const universal = criteria.filter((c) => c.platform === null).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-adonis text-2xl">Rubric</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          What the judge grades against, and the reason its answers are repeatable rather than a
          fresh opinion each run. Every criterion asks about <strong>craft</strong> — something
          readable from the post itself, which is why none of this needs a platform credential.
        </p>
      </div>

      {seedError && <Banner tone="warn">{seedError}</Banner>}
      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      <AddCriterionForm account={account} onAdded={load} onError={setError} />

      <div className="flex items-center gap-2 flex-wrap">
        <SectionLabel>
          {criteria.length} criteria · {universal} universal
        </SectionLabel>
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </FilterChip>
          {SOCIAL_PLATFORMS.map((p) => (
            <FilterChip key={p} active={filter === p} onClick={() => setFilter(p)}>
              {platformLabel(p)}
            </FilterChip>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading the rubric…" />
      ) : shown.length === 0 ? (
        <Empty>No criteria here yet.</Empty>
      ) : (
        <div className="space-y-3">
          {shown.map((criterion) => (
            <div
              key={criterion.id}
              className={`border rounded-md p-4 ${
                criterion.isActive ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {criterion.platform ? (
                      <PlatformPill platform={criterion.platform} />
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono bg-gray-50 text-gray-600 border-gray-200">
                        all platforms
                      </span>
                    )}
                    <span
                      className="font-mono text-[10px] text-gray-400"
                      title="Weight in the score, 1-3"
                    >
                      ×{criterion.weight}
                    </span>
                    {/* An inverted criterion is called out: reading one as
                        normal is how a rubric quietly scores backwards. */}
                    {criterion.expectedVerdict === 'fail' && (
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-700"
                        title="Inverted: doing the thing this asks about is the FAILURE."
                      >
                        inverted
                      </span>
                    )}
                    {!criterion.isActive && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400">
                        not graded
                      </span>
                    )}
                  </div>

                  <p
                    className={`font-georgia-pro text-[15px] ${
                      criterion.isActive ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {criterion.prompt}
                  </p>
                  {criterion.guidance && (
                    <p className="font-georgia-pro text-[13px] text-gray-500 mt-1 leading-snug">
                      {criterion.guidance}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(criterion)}
                    disabled={busyId === criterion.id}
                    className="text-[11px] uppercase tracking-[0.12em] text-gray-500 hover:text-gray-900 disabled:opacity-40 transition-colors"
                  >
                    {criterion.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button
                    onClick={() => remove(criterion)}
                    disabled={busyId === criterion.id}
                    className="text-[11px] uppercase tracking-[0.12em] text-red-600 hover:text-red-800 disabled:opacity-40 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
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

function AddCriterionForm({
  account,
  onAdded,
  onError,
}: {
  account: Account | null;
  onAdded: () => void | Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [guidance, setGuidance] = useState('');
  const [platform, setPlatform] = useState<SocialPlatform | ''>('');
  const [expectedVerdict, setExpectedVerdict] = useState<'pass' | 'fail'>('pass');
  const [weight, setWeight] = useState(1);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!prompt.trim()) return onError('The criterion needs a question.');
    if (!guidance.trim()) {
      return onError(
        'Guidance is required — it is what stops the judge drifting between runs.',
      );
    }

    setBusy(true);
    try {
      await addCriterion(account, {
        platform: platform || null,
        prompt: prompt.trim(),
        guidance: guidance.trim(),
        expectedVerdict,
        weight,
      });
      setPrompt('');
      setGuidance('');
      setPlatform('');
      setExpectedVerdict('pass');
      setWeight(1);
      setOpen(false);
      await onAdded();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 transition-colors"
      >
        Add a criterion
      </button>
    );
  }

  return (
    <div className="border border-gray-900 rounded-md p-4 space-y-4">
      <SectionLabel>New criterion</SectionLabel>

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
          The question — something a grader answers yes or no
        </span>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={busy}
          placeholder="Does the opening line carry a specific fact?"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
        />
      </label>

      <label className="block">
        <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
          What counts as a pass
        </span>
        <textarea
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          disabled={busy}
          rows={3}
          placeholder="Be specific enough that two people would mostly agree. Say what a PASS looks like and what a FAIL looks like."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
        />
        <span className="font-georgia-pro text-[13px] text-gray-400 block mt-1">
          This is the single thing that keeps scores stable between runs. A vague bar means the
          same post scores differently on Tuesday.
        </span>
      </label>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Platform</span>
          <select
            value={platform}
            disabled={busy}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform | '')}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono disabled:opacity-50"
          >
            <option value="">All platforms</option>
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Weight</span>
          <select
            value={weight}
            disabled={busy}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono disabled:opacity-50"
          >
            <option value={1}>1 · minor</option>
            <option value={2}>2 · matters</option>
            <option value={3}>3 · decisive</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={expectedVerdict === 'fail'}
            disabled={busy}
            onChange={(e) => setExpectedVerdict(e.target.checked ? 'fail' : 'pass')}
          />
          <span className="text-xs text-gray-600">
            Inverted — doing this is the <em>failure</em>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={busy}
          className="px-5 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={busy}
          className="text-[11px] uppercase tracking-[0.12em] text-gray-500 hover:text-gray-900 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
