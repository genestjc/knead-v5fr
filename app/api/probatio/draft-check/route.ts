/**
 * Check a draft before it publishes.
 *
 * Reads the document straight from Sanity — including drafts, which is the
 * whole point, so this uses a token'd client with `perspective: 'previewDrafts'`
 * rather than the CDN client the site renders from.
 *
 * The advisor pass is optional. The deterministic half costs nothing but a
 * Sanity read and is usually enough to see the problem; the model call is for
 * when you want the fields drafted rather than listed.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from 'next-sanity'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { requireProbatioAdmin } from '@/lib/eval/require-admin'
import { checkDraft, renderDraftReport, type DraftDocument } from '@/lib/eval/draft-check'
import { adviseDraft, type DraftAdvice } from '@/lib/eval/draft-advisor'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DRAFT_QUERY = `*[_type == "post" && (_id == $id || _id == "drafts." + $id || slug.current == $id)][0]{
  _id,
  title,
  excerpt,
  body,
  subjects[]{name, type},
  keyFacts[]{fact, when, sourceUrl},
  "categories": categories[]->title,
  "author": author->{_id, name, bio}
}`

export async function POST(req: NextRequest) {
  const auth = await requireProbatioAdmin(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 })

  const limit = await rateLimit('probatio-draft-check', auth.address ?? getClientIp(req), {
    limit: 30,
    windowSeconds: 600,
  })
  if (!limit.success) {
    return NextResponse.json({ error: 'Rate limit reached. Try again shortly.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '').trim()
  const provider = body?.provider === 'openai' ? 'openai' : 'claude'
  const shouldAdvise = body?.advise !== false

  if (!id) {
    return NextResponse.json({ error: 'Pass a document id or slug.' }, { status: 400 })
  }

  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  if (!projectId) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_SANITY_PROJECT_ID is not set.' }, { status: 500 })
  }

  try {
    // Drafts are invisible to the CDN client the site uses. A read token plus
    // previewDrafts is what makes checking-before-publishing possible at all;
    // without SANITY_API_READ_TOKEN this still works for published documents.
    const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_WRITE_TOKEN
    const sanity = createClient({
      projectId,
      dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
      apiVersion: '2024-01-01',
      useCdn: false,
      ...(token ? { token, perspective: 'previewDrafts' as const } : {}),
    })

    const doc = await sanity.fetch<DraftDocument | null>(DRAFT_QUERY, { id })
    if (!doc) {
      return NextResponse.json(
        {
          error: token
            ? `No post found for "${id}". Pass the document id or the slug.`
            : `No published post found for "${id}". To check unpublished drafts, set SANITY_API_READ_TOKEN.`,
        },
        { status: 404 },
      )
    }

    const report = checkDraft(doc)
    const reportText = renderDraftReport(report)

    let advice: DraftAdvice | null = null
    if (shouldAdvise) {
      try {
        advice = await adviseDraft({
          provider,
          report,
          reportText,
          precedent: await gatherPrecedent(),
        })
      } catch (err: any) {
        // The deterministic half is always valid — never lose it to a model
        // call that failed.
        console.error('[probatio] draft advisor:', err.message)
        advice = null
      }
    }

    return NextResponse.json({
      documentId: doc._id,
      isDraft: Boolean(doc._id?.startsWith('drafts.')),
      report: { ...report, bodyText: undefined },
      reportText,
      advice,
    })
  } catch (err: any) {
    console.error('[probatio] draft-check:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/**
 * What past story comparisons found, as context for the advisor.
 *
 * This is grounding, not training data. Each entry is a real finding from a
 * completed story audit — what a competitor carried that we did not — so the
 * advisor knows what tends to win on this beat instead of guessing. It gets
 * better as more audits run, with no retraining involved.
 *
 * Failing to read them is not an error: the advisor works without precedent,
 * just with less context.
 */
async function gatherPrecedent(): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('eval_runs')
      .select('summary')
      .eq('surface', 'aeo-story')
      .eq('status', 'complete')
      .not('summary', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3)

    return (data ?? [])
      .map((row: any) => String(row.summary ?? '').trim())
      .filter(Boolean)
      // Keep each one short — this is context, not the task.
      .map((s: string) => s.slice(0, 1_200))
  } catch (err) {
    console.error('[probatio] precedent lookup failed:', err)
    return []
  }
}
