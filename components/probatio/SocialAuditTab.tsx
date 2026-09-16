'use client';

/**
 * Social Audit — our post against theirs, read out of pictures.
 *
 * The tab is two stacked tools, and the order is the argument:
 *
 *   ABOVE — the judge. Upload what we posted and what a competitor posted on a
 *   similar subject, and get the rubric scored plus the four dimensions — style,
 *   tone, content, delivery — read side by side, with quotes.
 *
 *   BELOW — the composer. Point it at a story we are publishing and it writes
 *   the next post against what the judge just found. Stacking it here rather
 *   than giving it its own tab is deliberate: a critique nobody acts on is a
 *   critique nobody reads, and the whole value is the second step.
 *
 * Nothing here reports follower counts or engagement. Our accounts are in the
 * hundreds; a reach comparison would measure audience size and call it craft.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Account } from 'thirdweb/wallets';
import type { EvalCriterion, EvalProvider, EvalRun } from '@/lib/eval/types';
import { platformLabel, SOCIAL_PLATFORMS, type SocialPlatform } from '@/lib/eval/types';
import type {
  DifferenceRead,
  PostJudgement,
  Recommendation,
  SocialJudgement,
} from '@/lib/eval/social-judge';
import type { ComposerResult, StoryBrief } from '@/lib/eval/social-composer';
import { base64Bytes, formatBytes, MAX_INLINE_IMAGE_BYTES } from '@/lib/eval/image-fit';
import {
  composeSocialDrafts,
  emptyPostDraft,
  fetchComposerStories,
  postDraftIsEmpty,
  runSocialAudit,
  type SocialAuditResult,
  type SocialPostDraft,
} from './api';
import { SocialPostInput, draftToPayload } from './SocialPostInput';
import { RunDetail } from './RunDetail';
import { Banner, KNEAD_RED, SectionLabel, VerdictPill } from './shared';

const MAX_COMPETITORS = 3;

export function SocialAuditTab({
  account,
  criteria,
  runs,
  selectedRun,
  onSelectRun,
  onRefreshRuns,
  onRefreshSelected,
}: {
  account: Account | null;
  criteria: EvalCriterion[];
  runs: EvalRun[];
  selectedRun: EvalRun | null;
  onSelectRun: (id: string | null) => void;
  onRefreshRuns: () => void;
  onRefreshSelected: () => void;
}) {
  // Runs were being saved from the first version of this tab and there was
  // nowhere to see them: they were only reachable through the Human Evaluation
  // tab's surface picker, which after the rename reads as a place for agent
  // evaluations and nothing else. Anyone who ran an audit, navigated away and
  // came back would reasonably conclude it had not been saved.
  const savedRuns = runs.filter((run) => run.surface === 'social-audit');
  const [platform, setPlatform] = useState<SocialPlatform>('instagram');
  const [provider, setProvider] = useState<EvalProvider>('claude');
  const [subject, setSubject] = useState('');

  const [ours, setOurs] = useState<SocialPostDraft>(() => emptyPostDraft('Knead'));
  const [theirs, setTheirs] = useState<SocialPostDraft[]>([]);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SocialAuditResult | null>(null);

  const anyUploading =
    ours.uploadStatus === 'uploading' ||
    ours.uploadStatus === 'waiting' ||
    theirs.some((t) => t.uploadStatus === 'uploading' || t.uploadStatus === 'waiting');

  // Screenshots travel inline in the request body, which the platform caps.
  // Counted here, against the same constant the route enforces, so an overfull
  // audit is a sentence next to the button rather than a 413 after the wait.
  const inlineBytes = [ours, ...theirs]
    .flatMap((post) => post.images)
    .reduce((total, image) => total + base64Bytes(image.split(',')[1] ?? ''), 0);
  const overBudget = inlineBytes > MAX_INLINE_IMAGE_BYTES;

  async function run() {
    setError(null);
    setRunning(true);
    try {
      const outcome = await runSocialAudit(account, {
        platform,
        provider,
        subject: subject.trim() || undefined,
        ours: draftToPayload(ours),
        theirs: theirs.filter((t) => !postDraftIsEmpty(t)).map(draftToPayload),
      });
      setResult(outcome);
      onRefreshRuns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* ── the judge ──────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <h2 className="font-adonis text-2xl">Ours against theirs</h2>
          <p className="mt-1 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
            Screenshot a post, or film your screen scrolling a grid or tapping through a Story.
            Claude or GPT reads what is in the pictures, scores ours against the rubric, and says
            what theirs does differently on style, tone, content and delivery. Craft only — never
            reach.
          </p>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <label className="block">
            <SectionLabel>Platform</SectionLabel>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as SocialPlatform)}
              disabled={running}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {platformLabel(p)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <SectionLabel>Judge</SectionLabel>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as EvalProvider)}
              disabled={running}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="claude">Claude</option>
              <option value="openai">GPT</option>
            </select>
          </label>

          <label className="block flex-1 min-w-[16rem]">
            <SectionLabel>Subject (optional)</SectionLabel>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={running}
              placeholder="what both posts are about — e.g. the Richard Nadler retrospective"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>
        </div>

        <SocialPostInput
          account={account}
          label="Our post"
          platform={platform}
          draft={ours}
          isOurs
          onChange={setOurs}
          disabled={running}
          accent
        />

        {theirs.map((draft, i) => (
          <SocialPostInput
            key={i}
            account={account}
            label={`Their post ${i + 1}`}
            platform={platform}
            draft={draft}
            isOurs={false}
            onChange={(next) => setTheirs(theirs.map((t, index) => (index === i ? next : t)))}
            onRemove={() => setTheirs(theirs.filter((_, index) => index !== i))}
            disabled={running}
          />
        ))}

        <div className="flex items-center gap-4 flex-wrap">
          {theirs.length < MAX_COMPETITORS && (
            <button
              onClick={() => setTheirs([...theirs, emptyPostDraft(`Competitor ${theirs.length + 1}`)])}
              disabled={running}
              className="text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 border border-gray-300 rounded-md hover:border-gray-900 disabled:opacity-40"
            >
              Add a competitor post
            </button>
          )}

          <button
            onClick={run}
            disabled={running || anyUploading || overBudget || postDraftIsEmpty(ours)}
            className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-40"
          >
            {running ? 'Reading the pictures…' : 'Run the audit'}
          </button>

          {postDraftIsEmpty(ours) && (
            <span className="font-georgia-pro text-[13px] text-gray-400">
              Attach a screenshot or a recording of our post to start.
            </span>
          )}
          {anyUploading && (
            <span className="font-georgia-pro text-[13px] text-gray-400">
              Waiting for a recording to finish processing.
            </span>
          )}
          {overBudget && (
            <span className="font-georgia-pro text-[13px] text-red-700">
              The screenshots total {formatBytes(inlineBytes)}, over the{' '}
              {formatBytes(MAX_INLINE_IMAGE_BYTES)} one request can carry. Remove a few, or upload a
              recording instead — recordings go straight to Mux and are not limited this way.
            </span>
          )}
        </div>

        {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}

        {result && <AuditResult result={result} />}
      </section>

      {/* ── the composer ───────────────────────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-10">
        <Composer account={account} provider={provider} auditRun={result?.run ?? null} />
      </section>

      {/* ── what has been audited before ───────────────────────────────────── */}
      <section className="border-t border-gray-200 pt-10">
        <SavedAudits
          account={account}
          runs={savedRuns}
          criteria={criteria}
          selectedRun={selectedRun}
          onSelectRun={onSelectRun}
          onRefreshRuns={onRefreshRuns}
          onRefreshSelected={onRefreshSelected}
        />
      </section>
    </div>
  );
}

/**
 * Past audits, with their summaries.
 *
 * Shows the summary inline rather than making you open each one: the summary IS
 * the audit as far as re-reading goes — it carries the scoreboard, what fell
 * short and the edits — and a list of bare titles would mean opening four runs
 * to find the one you meant.
 */
function SavedAudits({
  account,
  runs,
  criteria,
  selectedRun,
  onSelectRun,
  onRefreshRuns,
  onRefreshSelected,
}: {
  account: Account | null;
  runs: EvalRun[];
  criteria: EvalCriterion[];
  selectedRun: EvalRun | null;
  onSelectRun: (id: string | null) => void;
  onRefreshRuns: () => void;
  onRefreshSelected: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (selectedRun && selectedRun.surface === 'social-audit') {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="font-adonis text-2xl">{selectedRun.title}</h2>
          <button
            onClick={() => onSelectRun(null)}
            className="text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900"
          >
            Back to all audits
          </button>
        </div>
        <RunDetail
          account={account}
          run={selectedRun}
          criteria={criteria}
          onRefresh={() => {
            onRefreshRuns();
            onRefreshSelected();
          }}
          onClose={() => onSelectRun(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-adonis text-2xl">Audited before</h2>
      <p className="mt-1 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
        Every audit is saved with its verdicts, the text the judge read out of the pictures, and the
        scoreboard. Screenshots are not — they are large, they are your screen, and everything the
        audit concluded from them is in the summary.
      </p>

      {runs.length === 0 ? (
        <p className="mt-6 font-georgia-pro text-[15px] text-gray-400 italic">
          No audits saved yet.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-gray-200 border-t border-gray-200">
          {runs.map((run) => {
            const open = expanded === run.id;
            const score = typeof run.metadata?.score === 'number' ? run.metadata.score : null;
            const board = Array.isArray(run.metadata?.scoreboard) ? run.metadata.scoreboard : [];
            return (
              <div key={run.id} className="py-4">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-mono text-[13px] tabular-nums w-10 text-right">
                    {score ?? '—'}
                  </span>
                  <button
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="font-georgia-pro text-[15px] text-left hover:underline flex-1 min-w-[12rem]"
                  >
                    {run.title}
                  </button>
                  {run.metadata?.platform && (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400">
                      {platformLabel(String(run.metadata.platform))}
                    </span>
                  )}
                  {run.status === 'failed' && (
                    <span className="text-[10px] uppercase tracking-[0.12em] text-red-700">
                      failed
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400 font-mono">
                    {new Date(run.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => onSelectRun(run.id)}
                    className="text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900"
                  >
                    Open
                  </button>
                </div>

                {/* The field at a glance, without opening anything. */}
                {board.length > 1 && (
                  <div className="mt-2 ml-[3.25rem] flex items-center gap-3 flex-wrap">
                    {board.map((entry: any) => (
                      <span
                        key={entry.postId}
                        className={`text-[11px] font-mono ${
                          entry.isOurs ? 'text-gray-900 font-semibold' : 'text-gray-500'
                        }`}
                      >
                        {entry.label} {entry.score ?? '—'}
                      </span>
                    ))}
                  </div>
                )}

                {open && run.summary && (
                  <pre className="mt-3 ml-[3.25rem] font-georgia-pro text-[14px] leading-relaxed whitespace-pre-wrap text-gray-700">
                    {run.summary}
                  </pre>
                )}
                {open && !run.summary && (
                  <p className="mt-3 ml-[3.25rem] font-georgia-pro text-[13px] text-gray-400 italic">
                    This run has no summary — it may have failed before the judge replied.
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

// ─── the judge's findings ─────────────────────────────────────────────────────

/**
 * The findings, as three analyses.
 *
 * OURS, THEIRS, then the CROSS-COMPARISON — in that order, because that is the
 * order the reasoning runs in. Each post is graded on its own evidence first;
 * only then does it mean anything to say one is stronger. An earlier version
 * led with the scoreboard, which put the conclusion before either of the two
 * analyses it rests on and made the individual audits read as appendices.
 *
 * The three are numbered on screen when there is a field to compare. With only
 * our post submitted there is nothing to compare against, so the numbering and
 * the third section both disappear rather than standing there empty.
 */
function AuditResult({ result }: { result: SocialAuditResult }) {
  const { judgement, criteria } = result;
  const ours = judgement.posts.find((p) => p.isOurs) ?? null;
  const theirs = judgement.posts.filter((p) => !p.isOurs);
  const hasField = theirs.length > 0;

  return (
    <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
      <div className="p-5 flex items-baseline gap-4 flex-wrap">
        {ours?.score != null ? (
          <div className="flex items-baseline gap-2">
            <span className="font-adonis text-4xl leading-none">{ours.score}</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-gray-400">
              / 100 · ours, weighted
            </span>
          </div>
        ) : (
          <span className="font-georgia-pro text-[15px] text-gray-500 italic">
            Nothing in the material could be scored.
          </span>
        )}
        <span className="text-[11px] uppercase tracking-[0.14em] text-gray-400 font-mono ml-auto">
          {judgement.model}
        </span>
      </div>

      {judgement.parseError && (
        <div className="p-5">
          <Banner tone="error">
            The judge&rsquo;s reply could not be parsed as JSON, so its prose is kept below rather
            than reported as an empty result. {judgement.parseError}
          </Banner>
        </div>
      )}

      {/* ── 1 · ours ─────────────────────────────────────────────────────── */}
      {ours && (
        <div className="p-5">
          <AnalysisHeading
            index={hasField ? 1 : null}
            title="Our post"
            blurb="Graded against the rubric on its own evidence."
          />
          <PostResult post={ours} criteria={criteria} defaultOpen />
        </div>
      )}

      {/* ── 2 · theirs ───────────────────────────────────────────────────── */}
      {hasField && (
        <div className="p-5">
          <AnalysisHeading
            index={2}
            title={theirs.length === 1 ? 'Their post' : 'Their posts'}
            blurb="The same rubric, the same way — each on its own evidence, never on ours."
          />
          <div className="space-y-6">
            {theirs.map((post) => (
              <PostResult key={post.postId} post={post} criteria={criteria} />
            ))}
          </div>
        </div>
      )}

      {/* ── 3 · the cross-comparison ─────────────────────────────────────── */}
      {hasField && (
        <div className="p-5">
          <AnalysisHeading
            index={3}
            title="Cross-comparison"
            blurb="What the two graded posts say when read against each other."
          />
          <Scoreboard judgement={judgement} />

          {judgement.differences.length > 0 && (
            <div className="mt-6">
              <SectionLabel>Dimension by dimension</SectionLabel>
              <div className="space-y-4">
                {judgement.differences.map((row) => (
                  <DifferenceRow key={row.dimension} row={row} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {judgement.recommendations.length > 0 && (
        <div className="p-5">
          <SectionLabel>Change this</SectionLabel>
          <div className="space-y-3">
            {judgement.recommendations.map((rec, i) => (
              <RecommendationRow key={i} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {judgement.sentiment && (
        <div className="p-5">
          <SectionLabel>
            What the replies said
            {judgement.sentiment.positiveShare !== null
              ? ` · ${judgement.sentiment.positiveShare}% positive`
              : ''}
          </SectionLabel>
          <p className="font-georgia-pro text-[15px] leading-relaxed">
            {judgement.sentiment.summary}
          </p>
          {judgement.sentiment.themes.map((theme, i) => (
            <p key={i} className="mt-2 font-georgia-pro text-[13px] text-gray-600">
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-gray-400 mr-2">
                {theme.valence}
              </span>
              {theme.theme}
              {theme.quote && (
                <span className="italic text-gray-500"> — &ldquo;{theme.quote}&rdquo;</span>
              )}
            </p>
          ))}
          {judgement.sentiment.flags.map((flag, i) => (
            <p key={i} className="mt-2 font-georgia-pro text-[13px]" style={{ color: KNEAD_RED }}>
              {flag}
            </p>
          ))}
        </div>
      )}

      {judgement.warnings.length > 0 && (
        <div className="p-5">
          <SectionLabel>Worth knowing</SectionLabel>
          <ul className="space-y-1">
            {judgement.warnings.map((warning, i) => (
              <li key={i} className="font-georgia-pro text-[13px] text-gray-600">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One of the three analyses, numbered so the structure is legible at a glance. */
function AnalysisHeading({
  index,
  title,
  blurb,
}: {
  index: number | null;
  title: string;
  blurb: string;
}) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      {index !== null && (
        <span className="font-adonis text-2xl leading-none text-gray-300 tabular-nums">
          {index}
        </span>
      )}
      <div>
        <h3 className="font-adonis text-xl leading-none">{title}</h3>
        <p className="mt-1 font-georgia-pro text-[13px] text-gray-500">{blurb}</p>
      </div>
    </div>
  );
}

/**
 * The head-to-head.
 *
 * Ranked by score whoever the post belongs to — a scoreboard that always put
 * ours first would be a chart of nothing. The caveat under it is not decoration:
 * a competitor scored against Knead's rubric is being measured on our standard,
 * and a reader who takes 62 as "their post is a 62" has misread it.
 */
function Scoreboard({ judgement }: { judgement: SocialJudgement }) {
  const ranked = [...judgement.posts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const leader = judgement.posts.find((p) => p.postId === judgement.comparison?.leaderId) ?? null;

  return (
    <div className="p-5">
      <SectionLabel>The field</SectionLabel>

      <div className="space-y-2">
        {ranked.map((post) => (
          <div key={post.postId} className="flex items-center gap-3">
            <div className="w-10 text-right font-mono text-[13px] tabular-nums">
              {post.score ?? '—'}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded-sm overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.max(post.score ?? 0, 2)}%`,
                  backgroundColor: post.isOurs ? KNEAD_RED : '#D4D4D4',
                }}
              />
            </div>
            <div className="w-52 truncate text-[13px]">
              <span className={post.isOurs ? 'font-semibold' : 'text-gray-600'}>{post.label}</span>
              {post.isOurs && (
                <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                  ours
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 font-georgia-pro text-[12px] text-gray-400">
        Scored against Knead&rsquo;s rubric, so a competitor&rsquo;s number reads as &ldquo;how much
        of what we are trying to do does their post already achieve&rdquo; — not as a verdict on
        their work. Craft only; nothing here is about reach.
      </p>

      {judgement.comparison && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          {leader && (
            <p className="font-georgia-pro text-[15px]">
              <span className="text-[11px] uppercase tracking-[0.14em] text-gray-400 mr-2">
                Strongest
              </span>
              <strong>{leader.label}</strong>
              {leader.isOurs && <span className="text-gray-500"> — ours</span>}
            </p>
          )}
          {judgement.comparison.summary && (
            <p className="mt-2 font-georgia-pro text-[15px] leading-relaxed">
              {judgement.comparison.summary}
            </p>
          )}
          {judgement.comparison.toClose.length > 0 && (
            <>
              <div className="mt-3 text-[10px] uppercase tracking-[0.14em] text-gray-400">
                To close the gap
              </div>
              <ul className="mt-1 space-y-1">
                {judgement.comparison.toClose.map((step, i) => (
                  <li key={i} className="font-georgia-pro text-[14px] text-gray-700">
                    • {step}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One post's individual audit — the verdict, then the rubric row by row.
 *
 * Ours opens by default; competitors are collapsed. Their row-by-row grading is
 * real and worth having, but it is reference material — the thing you read
 * every time is their verdict and how they scored, not which of our seventeen
 * rows they happened to pass.
 */
function PostResult({
  post,
  criteria,
  defaultOpen = false,
}: {
  post: PostJudgement;
  criteria: EvalCriterion[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const byId = new Map(criteria.map((c) => [c.id, c]));

  const fellShort = post.scores.filter((s) => {
    const criterion = byId.get(s.criterionId);
    return criterion && s.verdict !== 'na' && s.verdict !== criterion.expectedVerdict;
  }).length;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-baseline gap-3 flex-wrap text-left group mb-2"
      >
        <span className="text-[11px] uppercase tracking-[0.16em] text-gray-500 font-medium">
          {post.label}
        </span>
        {post.score !== null && (
          <span className="text-[11px] font-mono text-gray-500">{post.score}/100</span>
        )}
        {fellShort > 0 && (
          <span className="text-[11px] font-mono text-red-700">{fellShort} fell short</span>
        )}
        <span className="ml-auto text-[11px] uppercase tracking-[0.12em] text-gray-400 group-hover:text-gray-900">
          {open ? 'Hide the rubric' : 'Show the rubric'}
        </span>
      </button>

      {post.verdict && (
        <p className="font-georgia-pro text-[15px] leading-relaxed whitespace-pre-wrap">
          {post.verdict}
        </p>
      )}

      {open && post.scores.length > 0 && (
        <div className="mt-4 space-y-3">
          {post.scores.map((score) => {
            const criterion = byId.get(score.criterionId);
            const short =
              criterion && score.verdict !== 'na' && score.verdict !== criterion.expectedVerdict;
            return (
              <div
                key={score.criterionId}
                className={`border-l-2 pl-3 py-1 ${short ? 'border-red-400' : 'border-gray-200'}`}
              >
                <div className="flex items-start gap-2 flex-wrap">
                  <VerdictPill verdict={score.verdict} />
                  <span className="font-georgia-pro text-[14px] flex-1 min-w-[12rem]">
                    {criterion?.prompt ?? score.criterionId}
                  </span>
                  {criterion && criterion.weight > 1 && (
                    <span className="text-[10px] font-mono text-gray-400">×{criterion.weight}</span>
                  )}
                </div>
                {score.evidence && (
                  <p className="mt-1 font-georgia-pro text-[13px] text-gray-500 italic">
                    &ldquo;{score.evidence}&rdquo;
                  </p>
                )}
                {score.rationale && (
                  <p className="mt-0.5 font-georgia-pro text-[13px] text-gray-600">
                    {score.rationale}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && post.scores.length === 0 && (
        <p className="mt-3 font-georgia-pro text-[13px] text-gray-400 italic">
          The judge returned no scores for this post.
        </p>
      )}
    </div>
  );
}

function DifferenceRow({ row }: { row: DifferenceRead }) {
  const tone =
    row.advantage === 'ours'
      ? 'text-emerald-700'
      : row.advantage === 'theirs'
      ? 'text-red-700'
      : 'text-gray-400';

  return (
    <div className="border border-gray-200 rounded-md p-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.16em] font-medium">{row.dimension}</span>
        <span className={`text-[11px] uppercase tracking-[0.12em] font-mono ${tone}`}>
          advantage: {row.advantage}
        </span>
      </div>
      <p className="mt-2 font-georgia-pro text-[15px] leading-relaxed">{row.difference}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {row.ours && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-0.5">Ours</div>
            <p className="font-georgia-pro text-[13px] text-gray-600">{row.ours}</p>
          </div>
        )}
        {row.theirs && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mb-0.5">
              Theirs
            </div>
            <p className="font-georgia-pro text-[13px] text-gray-600">{row.theirs}</p>
          </div>
        )}
      </div>
      {row.evidence && (
        <p className="mt-2 font-georgia-pro text-[13px] text-gray-500 italic">
          theirs: &ldquo;{row.evidence}&rdquo;
        </p>
      )}
    </div>
  );
}

function RecommendationRow({ rec }: { rec: Recommendation }) {
  const priority =
    rec.priority === 'high'
      ? 'bg-red-50 text-red-800 border-red-200'
      : rec.priority === 'medium'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <div className="flex gap-3">
      <span
        className={`shrink-0 h-fit px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] border rounded-full font-mono ${priority}`}
      >
        {rec.priority}
      </span>
      <div className="flex-1">
        <p className="font-georgia-pro text-[15px] leading-relaxed">{rec.change}</p>
        {rec.rationale && (
          <p className="mt-0.5 font-georgia-pro text-[13px] text-gray-600">{rec.rationale}</p>
        )}
        {/* The effort label is the part that stops a "just reshoot it" landing
            in a list of things somebody thinks they can do before lunch. */}
        <span className="text-[10px] uppercase tracking-[0.12em] text-gray-400 font-mono">
          {rec.effort === 'rewrite'
            ? 'rewrite — the caption alone changes'
            : rec.effort === 'new-asset'
            ? 'new asset — needs a different image or video'
            : 'new reporting — needs a fact we do not have'}
        </span>
      </div>
    </div>
  );
}

// ─── the composer ────────────────────────────────────────────────────────────

function Composer({
  account,
  provider,
  auditRun,
}: {
  account: Account | null;
  provider: EvalProvider;
  auditRun: EvalRun | null;
}) {
  const [stories, setStories] = useState<StoryBrief[]>([]);
  const [slug, setSlug] = useState('');
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([...SOCIAL_PLATFORMS]);
  const [useAudit, setUseAudit] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [auditNote, setAuditNote] = useState<string | null>(null);

  // The account is read through a ref so this callback stays identity-stable —
  // depending on the object directly re-fires on every render where thirdweb
  // hands back a fresh one, which is a signature prompt per render.
  const accountRef = useRef(account);
  accountRef.current = account;
  const address = account?.address ?? 'demo';

  const loadStories = useCallback(async () => {
    try {
      const rows = await fetchComposerStories(accountRef.current);
      setStories(rows);
      setSlug((current) => current || rows[0]?.slug || '');
    } catch (err: any) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the address so a wallet switch refetches; the account itself is read via ref
  }, [address]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  async function compose() {
    setError(null);
    setLoading(true);
    try {
      const outcome = await composeSocialDrafts(accountRef.current, {
        slug,
        provider,
        platforms,
        auditRunId: useAudit ? auditRun?.id ?? null : null,
      });
      setResult(outcome.result);
      setAuditNote(outcome.auditNote);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-adonis text-2xl">Draft the next one</h2>
        <p className="mt-1 font-georgia-pro text-[15px] text-gray-600 max-w-2xl">
          Pick a story we are publishing and it writes a post per platform — against the audit
          above, where one has run. It may only claim what the piece says; anything it wanted to
          say and could not is listed at the bottom.
        </p>
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <label className="block flex-1 min-w-[18rem]">
          <SectionLabel>Story</SectionLabel>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={loading || stories.length === 0}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:opacity-50"
          >
            {stories.length === 0 && <option value="">No published stories found</option>}
            {stories.map((story) => (
              <option key={story.slug} value={story.slug}>
                {story.title}
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={compose}
          disabled={loading || !slug}
          className="px-5 py-2 bg-black text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-40"
        >
          {loading ? 'Drafting…' : 'Write the drafts'}
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {SOCIAL_PLATFORMS.map((p) => {
          const on = platforms.includes(p);
          return (
            <button
              key={p}
              onClick={() =>
                setPlatforms(on ? platforms.filter((x) => x !== p) : [...platforms, p])
              }
              disabled={loading}
              className={`text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 border rounded-md disabled:opacity-40 ${
                on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-500'
              }`}
            >
              {platformLabel(p)}
            </button>
          );
        })}
      </div>

      {auditRun && (
        <label className="flex items-center gap-2 font-georgia-pro text-[14px] text-gray-700">
          <input
            type="checkbox"
            checked={useAudit}
            onChange={(e) => setUseAudit(e.target.checked)}
            disabled={loading}
          />
          Write against the audit above — {auditRun.title}
        </label>
      )}

      {error && <Banner onDismiss={() => setError(null)}>{error}</Banner>}
      {auditNote && <Banner tone="info">{auditNote}</Banner>}

      {result && <ComposerOutput result={result} />}
    </div>
  );
}

function ComposerOutput({ result }: { result: ComposerResult }) {
  return (
    <div className="space-y-4">
      {result.parseError && <Banner tone="error">{result.parseError}</Banner>}

      {result.angle && (
        <div>
          <SectionLabel>The angle</SectionLabel>
          <p className="font-georgia-pro text-[16px] leading-relaxed">{result.angle}</p>
        </div>
      )}

      {result.drafts.map((draft, i) => (
        <div key={i} className="border border-gray-200 rounded-md p-4">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.16em] font-medium">
              {platformLabel(draft.platform)}
            </span>
            {/* 'inferred' is the honest label for a choice that rests on
                convention rather than on anything we measured. */}
            <span
              className={`text-[10px] uppercase tracking-[0.12em] font-mono ${
                draft.confidence === 'grounded' ? 'text-emerald-700' : 'text-gray-400'
              }`}
            >
              {draft.confidence}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(draft.body)}
              className="ml-auto text-[11px] uppercase tracking-[0.12em] text-gray-400 hover:text-gray-900"
            >
              Copy
            </button>
          </div>

          <p className="mt-3 font-georgia-pro text-[15px] leading-relaxed whitespace-pre-wrap">
            {draft.body}
          </p>

          {draft.tags.length > 0 && (
            <p className="mt-2 font-mono text-[12px] text-gray-500">
              {draft.tags.map((t) => `#${t}`).join(' ')}
            </p>
          )}
          {draft.asset && (
            <p className="mt-2 font-georgia-pro text-[13px] text-gray-600">
              <span className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mr-2">
                Asset
              </span>
              {draft.asset}
            </p>
          )}
          {draft.rationale && (
            <p className="mt-1 font-georgia-pro text-[13px] text-gray-600">
              <span className="text-[10px] uppercase tracking-[0.14em] text-gray-400 mr-2">Why</span>
              {draft.rationale}
            </p>
          )}
        </div>
      ))}

      {result.avoided.length > 0 && (
        <div>
          <SectionLabel>Deliberately not claimed</SectionLabel>
          <ul className="space-y-1">
            {result.avoided.map((a, i) => (
              <li key={i} className="font-georgia-pro text-[13px] text-gray-600">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
