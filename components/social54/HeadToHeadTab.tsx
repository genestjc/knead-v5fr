'use client';

/**
 * Head to head — our posts on a subject against the field's.
 *
 * The scoreboard renders per platform and never as one combined ranking. An
 * Instagram like and a Farcaster like are not the same unit, and a merged
 * leaderboard would be measuring which platform gives likes away more freely.
 * The column that decides anything is the rate column; the raw totals are
 * there so a reader can see where the rate came from.
 */
import { useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { AgentProvider } from '@/lib/social/types';
import type { PlatformScoreboard } from '@/lib/social/agents/head-to-head';
import { platformLabel } from '@/lib/social/types';
import { runHeadToHead, type HeadToHeadResult } from './api';
import {
  Banner,
  CaveatPanel,
  Empty,
  MetricCell,
  ParseErrorNotice,
  PriorityPill,
  ProviderPicker,
  RunButton,
  SectionLabel,
  Spinner,
  WindowPicker,
} from './shared';

export function HeadToHeadTab({ account }: { account: Account | null }) {
  const [subject, setSubject] = useState('');
  const [windowDays, setWindowDays] = useState(14);
  const [lookbackDays, setLookbackDays] = useState(45);
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [analyze, setAnalyze] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HeadToHeadResult | null>(null);

  async function run() {
    const trimmed = subject.trim();
    if (!trimmed) {
      setError('A subject is required — the person, show, place, or story every post is about.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await runHeadToHead(account, {
          subject: trimmed,
          windowDays,
          lookbackDays,
          provider,
          analyze,
        }),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl">Head to head</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          One subject, our posts against the field&rsquo;s. Both sides are scored on the metrics
          both sides report, and on engagement rate rather than raw counts — otherwise the outlet
          with the biggest following wins every comparison it enters.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Subject
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && run()}
            disabled={busy}
            placeholder="A person, show, restaurant, release — written as the posts would write it"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
          />
        </label>

        <div className="flex items-end gap-4 flex-wrap">
          <WindowPicker value={windowDays} onChange={setWindowDays} disabled={busy} label="Live window" />
          <WindowPicker
            value={lookbackDays}
            onChange={setLookbackDays}
            disabled={busy}
            label="Archive lookback"
            options={[14, 30, 45, 90]}
          />
          <ProviderPicker value={provider} onChange={setProvider} disabled={busy} />
          <label className="inline-flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={analyze}
              disabled={busy}
              onChange={(e) => setAnalyze(e.target.checked)}
            />
            Run the analyst
          </label>
          <RunButton onClick={run} busy={busy}>
            Compare
          </RunButton>
        </div>
        <p className="font-georgia-pro text-[13px] text-gray-400">
          Turn the analyst off for the scoreboard alone — often the numbers answer the question
          without a model call.
        </p>
      </div>

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && <Spinner label="Matching posts to the subject and scoring both sides…" />}

      {!busy && !result && <Empty>No comparison run yet.</Empty>}

      {result && !busy && (
        <>
          <CaveatPanel caveats={result.caveats} />

          {result.outcome.scoreboards.length === 0 ? (
            <Banner tone="warn">
              <strong className="font-medium">
                Nothing in the collected window matched &ldquo;{result.outcome.subject}&rdquo;
              </strong>{' '}
              — from us or from any competitor. That is a fact about this pull, not about the
              subject&rsquo;s coverage. Widen the lookback, or check the spelling as the posts would
              write it.
            </Banner>
          ) : (
            <>
              {result.outcome.weDidNotCover && (
                <Banner tone="warn">
                  <strong className="font-medium">We published nothing on this subject.</strong> The
                  field covered it {result.outcome.theirPosts.length} time
                  {result.outcome.theirPosts.length === 1 ? '' : 's'} and we did not. That is the
                  finding — there is no post of ours to analyze.
                </Banner>
              )}

              <div className="space-y-5">
                {result.outcome.scoreboards.map((board) => (
                  <Scoreboard key={board.platform} board={board} />
                ))}
              </div>
            </>
          )}

          {result.analystError && <Banner tone="warn">{result.analystError}</Banner>}

          {result.report && (
            <>
              <ParseErrorNotice error={result.report.parseError} />

              {result.report.verdict && (
                <div className="border-l-2 border-black pl-4 py-1">
                  <SectionLabel>Verdict</SectionLabel>
                  <p className="font-georgia-pro text-[16px] text-gray-900 leading-relaxed whitespace-pre-wrap">
                    {result.report.verdict}
                  </p>
                </div>
              )}

              {result.report.parity && (
                <p className="font-georgia-pro text-[14px] text-gray-500 italic border-l-2 border-gray-200 pl-3">
                  How fair is this comparison: {result.report.parity}
                </p>
              )}

              {result.report.advantages.length > 0 && (
                <div>
                  <SectionLabel>What they did that we didn&rsquo;t</SectionLabel>
                  <div className="space-y-3">
                    {result.report.advantages.map((advantage, i) => (
                      <div key={i} className="border border-gray-200 rounded-md p-4">
                        <p className="font-georgia-pro text-[15px] text-gray-900">
                          {advantage.advantage}
                        </p>
                        {advantage.evidence && (
                          <p className="font-georgia-pro text-[14px] text-gray-500 italic mt-2 border-l-2 border-gray-200 pl-3">
                            &ldquo;{advantage.evidence}&rdquo;
                          </p>
                        )}
                        <p className="font-mono text-[11px] text-gray-400 mt-1.5">
                          @{advantage.handle} · {advantage.platform}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.report.recommendations.length > 0 && (
                <div>
                  <SectionLabel>Change this</SectionLabel>
                  <div className="space-y-3">
                    {result.report.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-3 border border-gray-200 rounded-md p-4">
                        <PriorityPill priority={rec.priority} />
                        <div className="flex-1">
                          <p className="font-georgia-pro text-[15px] text-gray-900">{rec.change}</p>
                          {rec.rationale && (
                            <p className="font-georgia-pro text-[14px] text-gray-600 mt-1">
                              {rec.rationale}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] font-mono text-gray-400">read by {result.report.model}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Scoreboard({ board }: { board: PlatformScoreboard }) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
        <h3 className="font-adonis text-lg">{platformLabel(board.platform)}</h3>
        <span className="font-mono text-[10px] text-gray-500">
          scored on {board.comparableOn.join(' + ') || 'nothing comparable'}
        </span>
        {board.deltaRate !== null && (
          <span
            className={`font-mono text-xs ml-auto ${
              board.deltaRate >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {board.deltaRate >= 0 ? '+' : ''}
            {board.deltaRate} pts vs the field
          </span>
        )}
      </div>

      {board.caveat && (
        <p className="px-4 py-2.5 text-[13px] font-georgia-pro text-amber-900 bg-amber-50 border-b border-amber-100">
          {board.caveat}
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-400 border-b border-gray-100">
            <th className="px-3 py-2 text-left font-medium">Post</th>
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-right font-medium">Engagement</th>
            <th className="px-3 py-2 text-right font-medium">Followers</th>
            <th className="px-3 py-2 text-right font-medium">Rate</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {board.posts.map((post) => (
            <tr key={post.ref} className={post.isOurs ? 'bg-gray-50' : ''}>
              <td className="px-3 py-2">
                <span className="font-mono text-[10px] text-gray-400 mr-2">{post.ref}</span>
                <span className="font-mono text-xs text-gray-900">@{post.handle}</span>
                {post.isOurs && (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: '#FF6B6B' }}>
                    ours
                  </span>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-gray-500">
                {post.publishedAt.slice(0, 10)}
              </td>
              <MetricCell
                value={post.total}
                unavailableReason="This post is missing one of the metrics the comparison is scored on"
              />
              <MetricCell value={post.followers} />
              <MetricCell
                value={post.rate}
                suffix="%"
                unavailableReason="No follower count, so a rate cannot be computed"
                emphasis
              />
              <td className="px-3 py-2 text-right">
                {post.url && (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-gray-400 hover:text-gray-900 underline"
                  >
                    open
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
