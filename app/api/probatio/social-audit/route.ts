/**
 * Run a social audit — our post against theirs, graded from pictures.
 *
 * Two kinds of evidence arrive here, and they take different routes for a
 * reason:
 *
 *   SCREENSHOTS come inline, as base64 in this request body. That is fine for
 *   a handful of stills and terrible for anything larger — the platform caps a
 *   request body at a few megabytes, and base64 inflates a file by a third. So
 *   the inline budget is enforced here, with an error that points at the other
 *   route rather than a 413 nobody can act on.
 *
 *   RECORDINGS come by Mux upload ID. The file went straight from the browser
 *   to Mux and never touched this server; what arrives is an ID, and the frames
 *   are pulled from image.mux.com at judge time. A sixty-second screen
 *   recording is viable this way and impossible the other.
 *
 * Both end up as images in one request to the judge, which is the point: a
 * Story sequence filmed on a phone and a screenshot of a competitor's caption
 * are the same kind of evidence once they are pixels.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireProbatioAdmin } from '@/lib/eval/require-admin';
import { appendTurns, listCriteria, mapRun, mapTurn, upsertResults } from '@/lib/eval/store';
import {
  criteriaFor,
  judgeSocial,
  oursOf,
  renderSocialSummary,
  type SocialSubmission,
} from '@/lib/eval/social-judge';
import {
  DEFAULT_FRAME_COUNT,
  extractFrames,
  resolveAsset,
} from '@/lib/eval/social-media';
import {
  isSocialPlatform,
  platformLabel,
  type EvalTurn,
  type SocialPlatform,
} from '@/lib/eval/types';
import { MAX_IMAGE_BYTES, type ImageInput } from '@/lib/ai/router';
// The same constant the browser checks against, so the two can never disagree
// about what fits. See its comment for the arithmetic.
import { formatBytes, MAX_INLINE_IMAGE_BYTES } from '@/lib/eval/image-fit';
import { auditUrl } from '@/lib/eval/aeo-signals';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_COMPETITORS = 3;

interface SubmissionPayload {
  label?: string;
  handle?: string;
  url?: string;
  storyUrl?: string;
  notes?: string;
  text?: string;
  comments?: string;
  /** data: URLs from the browser. */
  images?: string[];
  /** A Mux upload, filmed instead of screenshotted. */
  uploadId?: string;
  frameCount?: number;
}

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  // Every run is a model call with up to twenty images attached, which is the
  // most expensive request this console makes.
  const limit = await rateLimit('probatio-social-audit', auth.address ?? getClientIp(req), {
    limit: 15,
    windowSeconds: 600,
  });
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Rate limit reached for social audits. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

  const platform: SocialPlatform = isSocialPlatform(body.platform) ? body.platform : 'instagram';
  const provider = body.provider === 'openai' ? 'openai' : 'claude';
  const subject = String(body.subject ?? '').trim().slice(0, 200) || null;

  const oursPayload: SubmissionPayload = body.ours ?? {};
  const theirsPayload: SubmissionPayload[] = Array.isArray(body.theirs)
    ? body.theirs.slice(0, MAX_COMPETITORS)
    : [];

  // ── inline images ────────────────────────────────────────────────────────
  let inlineBytes = 0;
  const decodeInline = (payload: SubmissionPayload, who: string): ImageInput[] => {
    const out: ImageInput[] = [];
    for (const raw of payload.images ?? []) {
      const image = decodeDataUrl(String(raw ?? ''));
      if (!image) continue;
      inlineBytes += Math.floor((image.data.length * 3) / 4);
      out.push(image);
    }
    if (out.length === 0 && (payload.images ?? []).length > 0) {
      throw new Error(`${who}: the attached screenshots were not readable image data.`);
    }
    return out;
  };

  let ourImages: ImageInput[];
  let theirImages: ImageInput[][];
  try {
    ourImages = decodeInline(oursPayload, 'Our post');
    theirImages = theirsPayload.map((p, i) => decodeInline(p, p.label || `Competitor ${i + 1}`));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  if (inlineBytes > MAX_INLINE_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error:
          `The attached screenshots total ${formatBytes(inlineBytes)}, over the ` +
          `${formatBytes(MAX_INLINE_IMAGE_BYTES)} this request can carry. Either attach fewer, or ` +
          'record the screen instead — a recording uploads straight to Mux and is not limited this way.',
      },
      { status: 413 },
    );
  }

  try {
    const allCriteria = await listCriteria();
    const criteria = criteriaFor(allCriteria, platform);

    if (criteria.length === 0) {
      return NextResponse.json(
        {
          error: `No active rubric rows apply to ${platformLabel(platform)}. Add one under Social Audit on the Human Evaluation tab.`,
        },
        { status: 400 },
      );
    }

    // ── recordings ─────────────────────────────────────────────────────────
    // Frames are pulled before the run row is written, so a recording that is
    // still transcoding fails as a 409 the console can retry rather than as a
    // saved run with nothing in it.
    const warnings: string[] = [];
    const attachFrames = async (
      payload: SubmissionPayload,
      images: ImageInput[],
      who: string,
    ): Promise<{ images: ImageInput[]; timestamps: number[] }> => {
      if (!payload.uploadId) return { images, timestamps: [] };

      const state = await resolveAsset(String(payload.uploadId));
      if (state.status === 'errored') {
        throw new Error(`${who}: ${state.error ?? 'the recording could not be processed by Mux.'}`);
      }
      if (state.status !== 'ready' || !state.playbackId) {
        throw new Error(
          `${who}: the recording is still being processed. Wait for it to finish and run the audit again.`,
        );
      }

      const frames = await extractFrames({
        playbackId: state.playbackId,
        durationSeconds: state.durationSeconds,
        count: Number(payload.frameCount) || DEFAULT_FRAME_COUNT,
      });
      warnings.push(...frames.warnings.map((w) => `${who}: ${w}`));

      // Frames come first: they are in time order, and a screenshot appended
      // afterwards reads as the end of the sequence rather than a separate
      // thing. The prompt says which are which.
      return { images: [...frames.images, ...images], timestamps: frames.timestamps };
    };

    let ours: SocialSubmission;
    let theirs: SocialSubmission[];
    try {
      const ourLabel = String(oursPayload.label ?? 'Knead').slice(0, 200);
      const ourFrames = await attachFrames(oursPayload, ourImages, 'Our post');
      ours = {
        label: ourLabel,
        handle: cleanHandle(oursPayload.handle),
        url: String(oursPayload.url ?? '').trim() || null,
        storyUrl: String(oursPayload.storyUrl ?? '').trim() || null,
        story: await fetchStory(oursPayload.storyUrl, ourLabel, warnings),
        notes: String(oursPayload.notes ?? ''),
        text: String(oursPayload.text ?? ''),
        comments: String(oursPayload.comments ?? ''),
        images: ourFrames.images,
        frameTimestamps: ourFrames.timestamps,
      };

      theirs = [];
      for (const [i, payload] of theirsPayload.entries()) {
        const label = String(payload.label ?? `Competitor ${i + 1}`).slice(0, 200);
        const frames = await attachFrames(payload, theirImages[i], label);
        // A competitor with nothing to look at cannot be graded. It used to be
        // skipped silently, which — together with the browser filtering the same
        // row out — meant a failed upload produced a solo audit and no
        // explanation for where the competitor went. Skipped, but never quietly.
        if (frames.images.length === 0 && !String(payload.text ?? '').trim()) {
          warnings.push(
            `${label} was left out of this audit: no screenshot, recording or caption reached the server for it.`,
          );
          continue;
        }
        theirs.push({
          label,
          handle: cleanHandle(payload.handle),
          url: String(payload.url ?? '').trim() || null,
          storyUrl: String(payload.storyUrl ?? '').trim() || null,
          story: await fetchStory(payload.storyUrl, label, warnings),
          notes: String(payload.notes ?? ''),
          text: String(payload.text ?? ''),
          comments: String(payload.comments ?? ''),
          images: frames.images,
          frameTimestamps: frames.timestamps,
        });
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    const supabase = getSupabaseAdmin();

    const { data: run, error: runError } = await supabase
      .from('eval_runs')
      .insert({
        mode: 'agent',
        surface: 'social-audit',
        persona: null,
        driver_provider: provider,
        driver_model: null,
        title:
          String(body.title ?? '').trim() ||
          `${platformLabel(platform)} — ${subject ?? ours.label}${theirs.length ? ` vs ${theirs.length}` : ''}`,
        status: 'running',
        created_by: auth.address ?? null,
        metadata: {
          platform,
          subject,
          ours: { label: ours.label, handle: ours.handle, url: ours.url, storyUrl: ours.storyUrl },
          theirs: theirs.map((t) => ({
            label: t.label,
            handle: t.handle,
            url: t.url,
            storyUrl: t.storyUrl,
          })),
        },
      })
      .select()
      .single();

    if (runError) throw new Error(runError.message);

    // Attach the recordings to the run now that there is one to attach them to.
    const uploadIds = [oursPayload.uploadId, ...theirsPayload.map((p) => p.uploadId)].filter(
      (id): id is string => Boolean(id),
    );
    if (uploadIds.length) {
      const { error } = await supabase
        .from('eval_social_media')
        .update({ run_id: run.id, updated_at: new Date().toISOString() })
        .in('mux_upload_id', uploadIds);
      // Losing the link is a bookkeeping problem, not a reason to lose the
      // audit that was just paid for.
      if (error) warnings.push(`The recordings could not be linked to this run: ${error.message}`);
    }

    try {
      const judgement = await judgeSocial({ provider, platform, criteria, ours, theirs, subject });
      const summary = renderSocialSummary(judgement, criteria);

      // Images are never stored. They are large, they are somebody's private
      // screen, and everything the audit concluded from them is in the text
      // below — which is the part anyone re-reading the run actually wants.
      const turns: Omit<EvalTurn, 'id' | 'runId' | 'createdAt'>[] = [
        {
          turnIndex: 0,
          role: 'event',
          content: describeEvidence(ours, theirs, platform),
          latencyMs: null,
          metadata: {
            platform,
            subject,
            ourImages: ours.images?.length ?? 0,
            ourFrames: ours.frameTimestamps?.length ?? 0,
            theirs: theirs.map((t) => ({
              label: t.label,
              images: t.images?.length ?? 0,
              frames: t.frameTimestamps?.length ?? 0,
            })),
          },
        },
        // One turn per post, so reopening a run shows what the judge read out
        // of each one — not just out of ours.
        ...judgement.posts.map((post, i) => ({
          turnIndex: 1 + i,
          role: 'agent' as const,
          content: [
            `${post.label}${post.isOurs ? ' (ours)' : ''}${
              post.score === null ? '' : ` — ${post.score}/100`
            }`,
            '',
            post.verdict || '(no verdict returned for this post)',
            '',
            post.extracted.text ? `CAPTION AS READ:\n${post.extracted.text}` : '',
            post.extracted.comments ? `\nREPLIES AS READ:\n${post.extracted.comments}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
          latencyMs: null,
          metadata: {
            postId: post.postId,
            label: post.label,
            isOurs: post.isOurs,
            score: post.score,
            // Stored as well as written into the turn body, so reopening this
            // run rebuilds the panel from a field rather than by parsing prose
            // back out of a rendered block. See lib/eval/social-replay.ts.
            verdict: post.verdict,
            extracted: post.extracted,
            model: judgement.model,
            // Competitors' verdicts live here rather than in eval_results. That
            // table means "verdicts about our work, overridable by hand", and a
            // competitor's score is context — nobody is going to hand-grade
            // Hyperallergic against our house voice row by row.
            ...(post.isOurs ? {} : { scores: post.scores }),
          },
        })),
        {
          turnIndex: 1 + judgement.posts.length,
          role: 'agent',
          content: summary,
          latencyMs: null,
          metadata: {
            model: judgement.model,
            scoreboard: judgement.posts.map((p) => ({
              postId: p.postId,
              label: p.label,
              isOurs: p.isOurs,
              score: p.score,
            })),
            comparison: judgement.comparison,
            differences: judgement.differences,
            recommendations: judgement.recommendations,
            sentiment: judgement.sentiment,
            ...(judgement.parseError ? { parseError: judgement.parseError } : {}),
          },
        },
      ];

      if (judgement.warnings.length || warnings.length) {
        turns.push({
          turnIndex: 2 + judgement.posts.length,
          role: 'system',
          content: [...warnings, ...judgement.warnings].map((w) => `• ${w}`).join('\n'),
          latencyMs: null,
          metadata: { warnings: [...warnings, ...judgement.warnings] },
        });
      }

      await appendTurns(run.id, turns);

      // OUR verdicts land in eval_results like any other surface, so the Human
      // Evaluation tab can override them by hand and the two sit side by side.
      // Competitors' are on their turn's metadata — see the comment there.
      const saveable = (oursOf(judgement)?.scores ?? []).filter((s) => s.verdict);
      if (saveable.length) {
        await upsertResults(
          run.id,
          provider,
          judgement.model,
          saveable.map((s) => ({
            criterionId: s.criterionId,
            verdict: s.verdict,
            rationale: s.rationale,
            evidence: s.evidence,
          })),
        );
      }

      await supabase
        .from('eval_runs')
        .update({
          status: 'complete',
          completed_at: new Date().toISOString(),
          summary,
          summary_author: provider,
          metadata: {
            platform,
            subject,
            // Our score stays top-level: it is what the run list sorts and
            // shows at a glance, and it is the number the composer reads back.
            score: oursOf(judgement)?.score ?? null,
            // The whole field, so a saved run can render its scoreboard without
            // re-reading every turn.
            scoreboard: judgement.posts.map((p) => ({
              postId: p.postId,
              label: p.label,
              isOurs: p.isOurs,
              score: p.score,
            })),
            comparison: judgement.comparison,
            ours: { label: ours.label, handle: ours.handle, url: ours.url, storyUrl: ours.storyUrl },
            theirs: theirs.map((t) => ({
              label: t.label,
              handle: t.handle,
              url: t.url,
              storyUrl: t.storyUrl,
            })),
            differences: judgement.differences,
            recommendations: judgement.recommendations,
          },
        })
        .eq('id', run.id);

      const { data: saved } = await supabase
        .from('eval_turns')
        .select('*')
        .eq('run_id', run.id)
        .order('turn_index', { ascending: true });

      return NextResponse.json({
        run: { ...mapRun(run), status: 'complete', summary },
        turns: (saved ?? []).map(mapTurn),
        judgement: { ...judgement, warnings: [...warnings, ...judgement.warnings] },
        criteria,
        summary,
      });
    } catch (err: any) {
      // The run row already exists; mark it failed rather than leaving a
      // 'running' row that never resolves.
      await supabase
        .from('eval_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), summary: err.message })
        .eq('id', run.id);
      throw err;
    }
  } catch (err: any) {
    console.error('[probatio] social-audit:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * base64 out of a data: URL, with the media type the providers accept.
 *
 * Returns null rather than throwing on anything unrecognised: one unreadable
 * paste should not lose the other three screenshots.
 */
function decodeDataUrl(value: string): ImageInput | null {
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|gif|webp));base64,(.+)$/i);
  if (!match) return null;

  const mediaType = (match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()) as
    | 'image/png'
    | 'image/jpeg'
    | 'image/gif'
    | 'image/webp';

  const data = match[2];
  if (!data) return null;
  if (Math.floor((data.length * 3) / 4) > MAX_IMAGE_BYTES) return null;
  return { data, mediaType };
}

/**
 * The article a post points at, fetched so the judge can check the caption
 * against it.
 *
 * Without this, "does every claim in the post hold up against the story it
 * points at" abstains every single time — which is the judge correctly
 * reporting that nobody ever gave it the piece. Fetching turns one of the
 * heaviest rubric rows from noise into a verdict.
 *
 * Reuses auditUrl rather than a bare fetch, for its SSRF guard: this takes a
 * URL from the client and fetches it server-side, and that is a request-forgery
 * primitive if left open — more so while PROBATIO_DEMO_MODE bypasses auth.
 * `skipSiblings` keeps it to the one request; robots.txt and sitemap.xml say
 * nothing about whether a caption overstates its article.
 *
 * A failure is a WARNING, never an error. A paywalled or bot-blocked competitor
 * piece is completely normal, and losing an audit someone has just filmed a
 * screen recording for because their competitor runs Cloudflare would be
 * absurd. The judge is told the difference between "no link" and "link that
 * could not be read".
 */
async function fetchStory(
  raw: string | undefined,
  who: string,
  warnings: string[],
): Promise<{ title: string | null; text: string; url: string } | null> {
  const url = String(raw ?? '').trim();
  if (!url) return null;

  try {
    const signals = await auditUrl(url, { keepText: true, skipSiblings: true });

    if (!signals.ok) {
      warnings.push(
        `${who}: the story at ${url} returned ${signals.httpStatus ?? 'no response'}, so the post's claims could not be checked against it.`,
      );
      return null;
    }
    if (!signals.extractedText.trim()) {
      warnings.push(
        `${who}: the story at ${url} loaded but no body text could be extracted — it is probably client-rendered or gated. The post's claims could not be checked against it.`,
      );
      return null;
    }

    return {
      title: signals.title,
      text: signals.extractedText,
      url: signals.finalUrl || url,
    };
  } catch (err: any) {
    warnings.push(`${who}: the story at ${url} could not be fetched (${err.message}).`);
    return null;
  }
}

function cleanHandle(value: unknown): string | null {
  const handle = String(value ?? '').trim().replace(/^@/, '').slice(0, 80);
  return handle || null;
}

type EvidenceSide = {
  label: string;
  images?: unknown[];
  frameTimestamps?: number[];
  storyUrl?: string | null;
  story?: { url: string } | null;
};

function describeEvidence(
  ours: EvidenceSide,
  theirs: EvidenceSide[],
  platform: SocialPlatform,
): string {
  const describe = (s: EvidenceSide) => {
    const frames = s.frameTimestamps?.length ?? 0;
    const total = s.images?.length ?? 0;
    const stills = total - frames;
    const parts = [
      frames ? `${frames} frame(s) from a recording` : '',
      stills > 0 ? `${stills} screenshot(s)` : '',
      // Whether the linked article was actually read is the difference between
      // a real accuracy verdict and an abstention, so it belongs in the record
      // of what the run was given.
      s.story ? `the linked story (${s.story.url})` : s.storyUrl ? 'a story link that could not be fetched' : '',
    ].filter(Boolean);
    return `  ${s.label}: ${parts.join(' + ') || 'text only'}`;
  };

  return [
    `EVIDENCE — ${platformLabel(platform)}`,
    describe(ours),
    ...theirs.map(describe),
    '',
    theirs.length === 0
      ? 'No competitor post was submitted, so this run scores our post against the rubric without a comparison.'
      : `Compared against ${theirs.length} competitor post(s) on craft only — never on reach.`,
  ].join('\n');
}
