'use client';

/**
 * Grade one saved run against the rubric.
 *
 * Human verdicts and LLM verdicts are stored separately, so this panel shows
 * both on the same row: your call on the left, the judge's on the right with
 * its reasoning and the quote it rested on. Where they disagree, the row is
 * marked — that disagreement set is the useful output, both for finding model
 * failures and for finding out where the judge itself is unreliable.
 */
import { useEffect, useMemo, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalResult, EvalRun, Verdict } from '@/lib/eval/types';
import { saveHumanVerdicts } from './api';
import { Banner, SectionLabel, VerdictPill, VerdictToggle } from './shared';

export function GradingPanel({
  account,
  run,
  criteria,
  onSaved,
}: {
  account: Account;
  run: EvalRun;
  criteria: EvalCriterion[];
  onSaved: () => void;
}) {
  const surfaceCriteria = useMemo(
    () => criteria.filter((c) => c.surface === run.surface && c.isActive),
    [criteria, run.surface],
  );

  // Seed the form from whatever this human has already recorded.
  const [drafts, setDrafts] = useState<Record<string, { verdict: Verdict; rationale: string }>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next: Record<string, { verdict: Verdict; rationale: string }> = {};
    for (const result of run.results ?? []) {
      if (result.judgedBy === 'human') {
        next[result.criterionId] = {
          verdict: result.verdict,
          rationale: result.rationale ?? '',
        };
      }
    }
    setDrafts(next);
    setSaved(false);
  }, [run.id, run.results]);

  const judgeResults = useMemo(() => {
    const map = new Map<string, EvalResult>();
    for (const r of run.results ?? []) {
      if (r.judgedBy !== 'human') map.set(r.criterionId, r);
    }
    return map;
  }, [run.results]);

  const dirtyCount = Object.keys(drafts).length;
  const disagreements = surfaceCriteria.filter((c) => {
    const mine = drafts[c.id]?.verdict;
    const theirs = judgeResults.get(c.id)?.verdict;
    return mine && theirs && mine !== theirs;
  }).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await saveHumanVerdicts(
        account,
        run.id,
        Object.entries(drafts).map(([criterionId, d]) => ({
          criterionId,
          verdict: d.verdict,
          rationale: d.rationale || null,
        })),
      );
      setSaved(true);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (surfaceCriteria.length === 0) {
    return (
      <Banner tone="info">
        No active rubric rows for this surface. Add some in Rubric Setting above.
      </Banner>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div>
          <SectionLabel>Grade against the rubric</SectionLabel>
          <p className="font-georgia-pro text-sm text-gray-600">
            {dirtyCount} of {surfaceCriteria.length} scored
            {disagreements > 0 && (
              <span className="text-red-700">
                {' '}
                · {disagreements} disagree{disagreements === 1 ? 's' : ''} with the judge
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save my grading'}
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <Banner onDismiss={() => setError(null)}>{error}</Banner>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
        {surfaceCriteria.map((criterion, index) => {
          const draft = drafts[criterion.id];
          const judged = judgeResults.get(criterion.id);
          const disagrees = draft?.verdict && judged && draft.verdict !== judged.verdict;

          return (
            <div key={criterion.id} className={`p-4 ${disagrees ? 'bg-amber-50/50' : ''}`}>
              <div className="flex gap-4">
                <span className="text-xs font-mono text-gray-400 pt-1 w-6 shrink-0">
                  {index + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-georgia-pro text-[15px] text-gray-900 leading-snug">
                    {criterion.prompt}
                    {criterion.expectedVerdict === 'fail' && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-amber-700 font-sans">
                        inverted
                      </span>
                    )}
                  </p>

                  {criterion.guidance && (
                    <p className="mt-1 text-[13px] text-gray-500 font-georgia-pro leading-snug">
                      {criterion.guidance}
                    </p>
                  )}

                  <div className="mt-3 flex items-start gap-4 flex-wrap">
                    <VerdictToggle
                      value={draft?.verdict ?? null}
                      onChange={(verdict) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [criterion.id]: { verdict, rationale: prev[criterion.id]?.rationale ?? '' },
                        }))
                      }
                    />

                    {judged && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400">
                          {judged.judgedBy === 'claude' ? 'Claude' : 'GPT'} judged
                        </span>
                        <VerdictPill verdict={judged.verdict} />
                        {disagrees && (
                          <span className="text-[10px] uppercase tracking-[0.12em] text-amber-700 font-medium">
                            disagreement
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {draft && (
                    <input
                      value={draft.rationale}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [criterion.id]: { ...prev[criterion.id], rationale: e.target.value },
                        }))
                      }
                      placeholder="Why? (optional — quote the turn that decided it)"
                      className="mt-3 w-full text-sm font-georgia-pro border-b border-gray-200 focus:border-black outline-none py-1 bg-transparent"
                    />
                  )}

                  {judged?.rationale && (
                    <div className="mt-3 border-l-2 border-gray-200 pl-3">
                      <p className="text-[13px] text-gray-600 font-georgia-pro leading-snug">
                        {judged.rationale}
                      </p>
                      {judged.evidence && (
                        <p className="mt-1 text-[12px] text-gray-500 font-mono leading-snug">
                          “{judged.evidence}”
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
