'use client';

/**
 * A saved run, opened: header and provenance, the judge's summary, the full
 * transcript with behavior logs, and the grading panel.
 *
 * Both tabs use this. A run started in Agent Evaluation and a transcript
 * pasted in Human Evaluation are the same object once saved — same rubric,
 * same grading, same history.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalProvider, EvalRun } from '@/lib/eval/types';
import { surfaceLabel } from '@/lib/eval/types';
import { getPersona } from '@/lib/eval/personas';
import { judge as runJudge } from './api';
import { Banner, KNEAD_RED, SectionLabel, TranscriptView } from './shared';
import { GradingPanel } from './GradingPanel';

export function RunDetail({
  account,
  run,
  criteria,
  onRefresh,
  onClose,
}: {
  account: Account | null;
  run: EvalRun;
  criteria: EvalCriterion[];
  onRefresh: () => void;
  onClose?: () => void;
}) {
  const [judging, setJudging] = useState<EvalProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleJudge(provider: EvalProvider) {
    setJudging(provider);
    setError(null);
    setNotice(null);
    try {
      const result = await runJudge(account, run.id, provider);
      setNotice(
        `${provider === 'claude' ? 'Claude' : 'GPT'} scored ${result.results.length} row${
          result.results.length === 1 ? '' : 's'
        }${result.unscored ? `, left ${result.unscored} as n/a` : ''} — ${result.judgeModel}.`,
      );
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJudging(null);
    }
  }

  const persona = getPersona(run.persona ?? '');
  const turns = run.turns ?? [];

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-adonis text-2xl leading-tight">{run.title}</h3>
            <div className="mt-2 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] uppercase tracking-[0.12em] text-gray-500">
              <span>{surfaceLabel(run.surface)}</span>
              <span className="text-gray-300">/</span>
              <span>{run.mode === 'agent' ? 'Agent run' : 'Human run'}</span>
              {persona && (
                <>
                  <span className="text-gray-300">/</span>
                  <span>{persona.name}</span>
                </>
              )}
              {run.driverModel && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="font-mono normal-case tracking-normal">{run.driverModel}</span>
                </>
              )}
              <span className="text-gray-300">/</span>
              <span
                className={
                  run.status === 'failed'
                    ? 'text-red-600'
                    : run.status === 'running'
                    ? 'text-amber-600'
                    : ''
                }
              >
                {run.status}
              </span>
              <span className="text-gray-300">/</span>
              <span className="normal-case tracking-normal">
                {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
            {run.metadata?.slug && (
              <p className="mt-1 text-xs font-mono text-gray-400">/posts/{run.metadata.slug}</p>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-[0.12em] text-gray-400 hover:text-black shrink-0"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="px-6 py-5 border-b border-gray-200">
        <SectionLabel>Full conversation · {turns.length} turns</SectionLabel>
        <TranscriptView turns={turns} />
      </div>

      {/* Judge controls — the conversation is done, so this is the moment the
          run gets scored. Sits directly above human grading so the two graders
          read as one step: hand it to a model, or do it yourself. */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/60">
        <div className="flex items-center gap-3 flex-wrap">
          <SectionLabel>LLM as a judge</SectionLabel>
          <div className="flex gap-2 -mt-2">
            <button
              onClick={() => handleJudge('claude')}
              disabled={judging !== null || turns.length === 0}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md bg-white hover:border-black disabled:opacity-40 transition-colors"
            >
              {judging === 'claude' ? 'Claude is reading…' : 'Judge with Claude'}
            </button>
            <button
              onClick={() => handleJudge('openai')}
              disabled={judging !== null || turns.length === 0}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md bg-white hover:border-black disabled:opacity-40 transition-colors"
            >
              {judging === 'openai' ? 'GPT is reading…' : 'Judge with GPT'}
            </button>
          </div>
        </div>

        {(error || notice) && (
          <div className="mt-3">
            {error ? (
              <Banner onDismiss={() => setError(null)}>{error}</Banner>
            ) : (
              <Banner tone="success" onDismiss={() => setNotice(null)}>
                {notice}
              </Banner>
            )}
          </div>
        )}

        {run.summary && (
          <div className="mt-4 border-l-2 pl-4" style={{ borderColor: KNEAD_RED }}>
            <SectionLabel>
              Summary
              {run.summaryAuthor && run.summaryAuthor !== 'human'
                ? ` · ${run.summaryAuthor === 'claude' ? 'Claude' : 'GPT'}`
                : ' · human'}
            </SectionLabel>
            <p className="font-georgia-pro text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">
              {run.summary}
            </p>
          </div>
        )}
      </div>

      {/* Grading */}
      <div className="px-6 py-5">
        <GradingPanel account={account} run={run} criteria={criteria} onSaved={onRefresh} />
      </div>
    </div>
  );
}
