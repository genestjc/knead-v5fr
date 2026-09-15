'use client';

/**
 * Judge — the console's centre of gravity.
 *
 * Paste a post or screenshot it, get it graded against the rubric with the
 * quote behind every verdict, and a list of edits. Add competitor posts and it
 * says what theirs did that ours didn't.
 *
 * No credentials anywhere in this path. That is the whole point: the metric
 * connectors need tokens that expire or cost money, and at a few hundred
 * followers the numbers they return could not have told us much. What a post
 * DOES is readable from the post, and it is the part we can change.
 */
import { useEffect, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { AgentProvider, SocialPlatform } from '@/lib/social/types';
import { SOCIAL_PLATFORMS, platformLabel } from '@/lib/social/types';
import type { JudgeCriterion, CriterionScore, Recommendation } from '@/lib/social/judge/types';
import { fetchRubric, runJudge, type JudgeRunResult } from './api';
import { EMPTY_DRAFT, PostInput, draftIsEmpty, draftToPayload, type PostDraft } from './PostInput';
import {
  Banner,
  Empty,
  ParseErrorNotice,
  PlatformPill,
  PriorityPill,
  ProviderPicker,
  RunButton,
  SectionLabel,
  Spinner,
} from './shared';

export function JudgeTab({ account }: { account: Account | null }) {
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [subject, setSubject] = useState('');
  const [ours, setOurs] = useState<PostDraft>(EMPTY_DRAFT);
  const [theirs, setTheirs] = useState<PostDraft[]>([]);

  const [criteria, setCriteria] = useState<JudgeCriterion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JudgeRunResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { criteria: rows } = await fetchRubric(account);
        if (alive) setCriteria(rows.filter((c) => c.isActive));
      } catch (err: any) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one load per mount
  }, []);

  const applicable = criteria.filter((c) => c.platform === null || c.platform === platform);

  async function run() {
    if (draftIsEmpty(ours)) {
      setError('Paste the caption or attach a screenshot first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(
        await runJudge(account, {
          platform,
          provider,
          subject: subject.trim() || undefined,
          ours: draftToPayload(ours),
          theirs: theirs.filter((d) => !draftIsEmpty(d)).map(draftToPayload),
        }),
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-adonis text-2xl">Judge</h2>
        <p className="font-georgia-pro text-[15px] text-gray-600 mt-1 max-w-xl">
          Paste a post or screenshot it. It gets graded against the rubric, with the quote behind
          every verdict and the edits worth making. Add a competitor&rsquo;s post and it says what
          theirs did that ours didn&rsquo;t. <strong>No credentials needed.</strong>
        </p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Platform</span>
          <select
            value={platform}
            disabled={busy}
            onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
            className="border border-gray-300 rounded-md px-2 py-1 text-xs font-mono disabled:opacity-50"
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1 min-w-[220px]">
          <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 block mb-1">
            Subject (optional)
          </span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={busy}
            placeholder="What the post is about"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-georgia-pro disabled:opacity-50"
          />
        </label>

        <ProviderPicker value={provider} onChange={setProvider} disabled={busy} />
        <RunButton onClick={run} busy={busy}>
          Judge it
        </RunButton>
      </div>

      <p className="font-mono text-[11px] text-gray-400">
        {applicable.length} criteria apply to {platformLabel(platform)} —{' '}
        {applicable.filter((c) => c.platform === null).length} universal,{' '}
        {applicable.filter((c) => c.platform !== null).length} platform-specific
      </p>

      <PostInput
        label="Our post"
        platform={platform}
        draft={ours}
        onChange={setOurs}
        disabled={busy}
        accent
      />

      {theirs.map((draft, i) => (
        <PostInput
          key={i}
          label={`Competitor post ${i + 1}`}
          platform={platform}
          draft={draft}
          onChange={(next) => setTheirs(theirs.map((d, index) => (index === i ? next : d)))}
          onRemove={() => setTheirs(theirs.filter((_, index) => index !== i))}
          disabled={busy}
          showComments={false}
        />
      ))}

      {theirs.length < 4 && (
        <button
          onClick={() => setTheirs([...theirs, { ...EMPTY_DRAFT }])}
          disabled={busy}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:opacity-40 transition-colors"
        >
          Add a competitor post
        </button>
      )}

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

      {busy && <Spinner label="Reading the post and grading it against the rubric…" />}

      {!busy && !result && <Empty>Nothing judged yet.</Empty>}

      {result && !busy && <JudgeResult result={result} />}
    </div>
  );
}

function JudgeResult({ result }: { result: JudgeRunResult }) {
  const { output, criteria } = result;
  const byId = new Map(criteria.map((c) => [c.id, c]));

  // "Fell short" means the verdict disagrees with the criterion's expected
  // outcome — not simply that it says "fail". A few criteria are inverted.
  const shortfalls = output.scores.filter((s) => {
    const criterion = byId.get(s.criterionId);
    return criterion && s.verdict !== 'na' && s.verdict !== criterion.expectedVerdict;
  });
  const held = output.scores.filter((s) => {
    const criterion = byId.get(s.criterionId);
    return criterion && s.verdict !== 'na' && s.verdict === criterion.expectedVerdict;
  });
  const unjudged = output.scores.filter((s) => s.verdict === 'na');

  return (
    <div className="space-y-6">
      {result.saveFailed && (
        <Banner tone="warn">
          This judgement could not be saved to the archive, so it will not appear in History. The
          result below is unaffected.
        </Banner>
      )}

      {output.warnings.map((warning, i) => (
        <Banner key={i} tone="warn">
          {warning}
        </Banner>
      ))}

      <ParseErrorNotice error={output.parseError} />

      <div className="flex items-start gap-6 flex-wrap">
        <div className="shrink-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400">Score</div>
          <div className="font-mono text-4xl text-gray-900">
            {output.score === null ? '—' : output.score}
          </div>
          <div className="font-mono text-[11px] text-gray-400">
            {output.score === null ? 'nothing scorable' : 'weighted'}
          </div>
        </div>
        <div className="flex-1 min-w-[280px]">
          <p className="font-georgia-pro text-[16px] text-gray-900 leading-relaxed whitespace-pre-wrap">
            {output.verdict}
          </p>
        </div>
      </div>

      {output.recommendations.length > 0 && (
        <div>
          <SectionLabel>Change this</SectionLabel>
          <div className="space-y-3">
            {output.recommendations.map((rec, i) => (
              <RecommendationCard key={i} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {shortfalls.length > 0 && (
        <ScoreSection title="Fell short" scores={shortfalls} byId={byId} tone="fail" />
      )}
      {held.length > 0 && <ScoreSection title="Held up" scores={held} byId={byId} tone="pass" />}
      {unjudged.length > 0 && (
        <ScoreSection
          title="Could not be judged"
          blurb="The post gave no way to answer these. They are excluded from the score rather than counted against it."
          scores={unjudged}
          byId={byId}
          tone="na"
        />
      )}

      {output.comparison && (
        <div>
          <SectionLabel>Against the field</SectionLabel>
          <p className="font-georgia-pro text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap">
            {output.comparison.verdict}
          </p>
          {output.comparison.advantages.map((advantage, i) => (
            <div key={i} className="border border-gray-200 rounded-md p-4 mt-3">
              <p className="font-georgia-pro text-[15px] text-gray-900">{advantage.advantage}</p>
              {advantage.evidence && (
                <p className="font-georgia-pro text-[14px] text-gray-500 italic mt-2 border-l-2 border-gray-200 pl-3">
                  &ldquo;{advantage.evidence}&rdquo;
                </p>
              )}
              <p className="font-mono text-[11px] text-gray-400 mt-1.5">@{advantage.handle}</p>
            </div>
          ))}
          {output.comparison.oursStronger.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1">
                Where ours is stronger
              </p>
              <ul className="space-y-1">
                {output.comparison.oursStronger.map((item, i) => (
                  <li key={i} className="font-georgia-pro text-[15px] text-gray-800">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {output.sentiment && (
        <div>
          <SectionLabel>What the replies said</SectionLabel>
          <p className="font-georgia-pro text-[15px] text-gray-900">{output.sentiment.summary}</p>
          {output.sentiment.positiveShare !== null && (
            <p className="font-mono text-[12px] text-gray-500 mt-1">
              {Math.round(output.sentiment.positiveShare)}% positive
            </p>
          )}
          {output.sentiment.themes.map((theme, i) => (
            <div key={i} className="mt-2 border-l-2 border-gray-200 pl-3">
              <p className="font-georgia-pro text-[14px] text-gray-800">
                {theme.theme}{' '}
                <span className="font-mono text-[10px] uppercase text-gray-400">
                  {theme.valence}
                </span>
              </p>
              {theme.quote && (
                <p className="font-georgia-pro text-[13px] text-gray-500 italic">
                  &ldquo;{theme.quote}&rdquo;
                </p>
              )}
            </div>
          ))}
          {output.sentiment.flags.map((flag, i) => (
            <p key={i} className="font-georgia-pro text-[14px] text-amber-900 mt-2">
              ⚠ {flag}
            </p>
          ))}
        </div>
      )}

      <p className="text-[11px] font-mono text-gray-400">judged by {output.model}</p>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const effortLabel = {
    rewrite: 'caption rewrite',
    'new-asset': 'needs a different asset',
    'new-reporting': 'needs new reporting',
  }[rec.effort];

  return (
    <div className="flex items-start gap-3 border border-gray-200 rounded-md p-4">
      <PriorityPill priority={rec.priority} />
      <div className="flex-1">
        <p className="font-georgia-pro text-[15px] text-gray-900">{rec.change}</p>
        {rec.rationale && (
          <p className="font-georgia-pro text-[14px] text-gray-600 mt-1">{rec.rationale}</p>
        )}
        {/* Effort is shown because "rewrite the caption" and "re-shoot this"
            are wildly different asks wearing the same sentence. */}
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-400 mt-1.5">
          {effortLabel}
        </p>
      </div>
    </div>
  );
}

function ScoreSection({
  title,
  blurb,
  scores,
  byId,
  tone,
}: {
  title: string;
  blurb?: string;
  scores: CriterionScore[];
  byId: Map<string, JudgeCriterion>;
  tone: 'pass' | 'fail' | 'na';
}) {
  const [open, setOpen] = useState(tone === 'fail');

  const accents = {
    pass: 'border-emerald-200',
    fail: 'border-red-200',
    na: 'border-gray-200',
  };

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] uppercase tracking-[0.18em] text-gray-500 hover:text-gray-900 transition-colors mb-2"
      >
        {title} ({scores.length}) {open ? '−' : '+'}
      </button>
      {blurb && <p className="font-georgia-pro text-[13px] text-gray-400 mb-2">{blurb}</p>}
      {open && (
        <div className="space-y-2">
          {scores.map((score) => {
            const criterion = byId.get(score.criterionId);
            return (
              <div
                key={score.criterionId}
                className={`border-l-2 pl-3 py-1 ${accents[tone]}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-georgia-pro text-[15px] text-gray-900">
                    {criterion?.prompt ?? score.criterionId}
                  </p>
                  {criterion?.platform && <PlatformPill platform={criterion.platform} />}
                  {criterion && criterion.weight > 1 && (
                    <span
                      className="font-mono text-[10px] text-gray-400"
                      title="Weighted more heavily in the score"
                    >
                      ×{criterion.weight}
                    </span>
                  )}
                </div>
                {score.rationale && (
                  <p className="font-georgia-pro text-[14px] text-gray-600 mt-0.5">
                    {score.rationale}
                  </p>
                )}
                {score.evidence && (
                  <p className="font-georgia-pro text-[13px] text-gray-500 italic mt-1">
                    &ldquo;{score.evidence}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
