/**
 * Supabase access for Social 54.
 *
 * Row → camelCase mapping lives here so the API routes stay thin, the same way
 * lib/eval/store.ts works for Probatio. Two things are worth reading before
 * changing anything:
 *
 *  • The post archive is an UPSERT on (platform, post_id), not an insert.
 *    Engagement keeps accruing for days after publication, so the same post is
 *    collected many times and the newest read wins — except for first_seen_at,
 *    which is deliberately never overwritten. When we first saw a post is the
 *    only way to tell a competitor's new post from one that was always there
 *    and has just now entered our window.
 *
 *  • Seeding the competitor roster is guarded on the table being EMPTY, not on
 *    each name being absent. A roster an admin has curated — removed two
 *    publications, added three — must not have the seed's five reappear on the
 *    next page load. An empty table means a fresh environment; a table with one
 *    row in it means somebody made a decision.
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { COMPETITOR_SEED } from './config';
import type { EditorialItem } from './editorial';
import type {
  AgentProvider,
  Competitor,
  CompetitorHandle,
  SocialPlatform,
  SocialPost,
  SocialRun,
  SocialRunKind,
} from './types';
import { SOCIAL_PLATFORMS } from './types';

// ─── competitors ──────────────────────────────────────────────────────────

export function mapCompetitor(row: any): Competitor {
  return {
    id: row.id,
    name: row.name,
    note: row.note ?? null,
    handles: normalizeHandles(row.handles),
    feedUrl: row.feed_url ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Coerce stored handles into the typed shape.
 *
 * The column is jsonb, so a hand-edited row can contain anything. An unknown
 * platform is dropped rather than carried through: it would reach the
 * collector as a request for a provider that does not exist.
 */
export function normalizeHandles(raw: unknown): CompetitorHandle[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CompetitorHandle[] = [];
  for (const entry of raw) {
    const platform = String((entry as any)?.platform ?? '').toLowerCase() as SocialPlatform;
    const handle = String((entry as any)?.handle ?? '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase();
    if (!handle || !SOCIAL_PLATFORMS.includes(platform)) continue;
    const key = `${platform}:${handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ platform, handle });
  }
  return out;
}

export interface CompetitorLoad {
  competitors: Competitor[];
  /** Set when the first-run seed was rejected and the table is still empty. */
  seedError: string | null;
}

export async function loadCompetitors(): Promise<CompetitorLoad> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from('social_competitors')
    .select('*')
    .order('name', { ascending: true });

  if (readError) throw new Error(`Could not read the competitor roster: ${readError.message}`);

  if ((existing ?? []).length > 0) {
    return { competitors: (existing ?? []).map(mapCompetitor), seedError: null };
  }

  const { error: seedError } = await supabase.from('social_competitors').insert(
    COMPETITOR_SEED.map((c) => ({
      name: c.name,
      note: c.note,
      handles: c.handles,
      // The seed carries homepages, not feeds. sweepEditorial notices the URL
      // is a page, discovers the real feed from it, and the trends route
      // writes that back — so the guess-free path costs one extra fetch, once.
      feed_url: c.siteUrl ?? null,
      is_active: true,
    })),
  );

  // Re-read rather than trusting our own insert: two admins opening the
  // console at once means one of these inserts loses the unique-name race,
  // and the loser should still see the rows the winner wrote.
  const { data: after, error: afterError } = await supabase
    .from('social_competitors')
    .select('*')
    .order('name', { ascending: true });

  if (afterError) throw new Error(`Could not read the competitor roster: ${afterError.message}`);

  const competitors = (after ?? []).map(mapCompetitor);
  return {
    competitors,
    seedError:
      seedError && competitors.length === 0
        ? `Could not seed the competitor roster: ${seedError.message}. These rows are defined in lib/social/config.ts — the database rejected the insert rather than the roster being unwritten.`
        : null,
  };
}

export async function createCompetitor(input: {
  name: string;
  note?: string | null;
  handles: CompetitorHandle[];
  feedUrl?: string | null;
}): Promise<Competitor> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_competitors')
    .insert({
      name: input.name,
      note: input.note ?? null,
      handles: normalizeHandles(input.handles),
      feed_url: input.feedUrl ?? null,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not add the competitor: ${error.message}`);
  return mapCompetitor(data);
}

export async function updateCompetitor(
  id: string,
  patch: Partial<{
    name: string;
    note: string | null;
    handles: CompetitorHandle[];
    feedUrl: string | null;
    isActive: boolean;
  }>,
): Promise<Competitor> {
  const supabase = getSupabaseAdmin();
  const row: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.handles !== undefined) row.handles = normalizeHandles(patch.handles);
  if (patch.feedUrl !== undefined) row.feed_url = patch.feedUrl;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;

  const { data, error } = await supabase
    .from('social_competitors')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Could not update the competitor: ${error.message}`);
  return mapCompetitor(data);
}

export async function deleteCompetitor(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('social_competitors').delete().eq('id', id);
  if (error) throw new Error(`Could not remove the competitor: ${error.message}`);
}

// ─── post archive ─────────────────────────────────────────────────────────

export function mapPost(row: any): SocialPost {
  return {
    platform: row.platform,
    id: row.post_id,
    url: row.url ?? '',
    authorHandle: row.author_handle,
    authorName: row.author_name ?? null,
    isOurs: row.is_ours ?? false,
    text: row.body ?? '',
    mediaType: row.media_type ?? 'unknown',
    publishedAt: row.published_at,
    metrics: row.metrics ?? {},
    authorFollowers: row.author_followers ?? null,
    tags: row.tags ?? [],
    links: row.links ?? [],
  };
}

/**
 * Archive a batch of collected posts.
 *
 * Best-effort by design: a snapshot is worth showing even if it could not be
 * persisted, and the caller renders what it collected either way. The error is
 * returned rather than thrown so the route can surface it beside the data
 * instead of in place of it.
 */
export async function archivePosts(posts: SocialPost[]): Promise<{ saved: number; error: string | null }> {
  if (posts.length === 0) return { saved: 0, error: null };
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const rows = posts
    .filter((p) => p.id && p.publishedAt)
    .map((p) => ({
      platform: p.platform,
      post_id: p.id,
      url: p.url,
      author_handle: p.authorHandle,
      author_name: p.authorName,
      is_ours: p.isOurs,
      body: p.text,
      media_type: p.mediaType,
      published_at: p.publishedAt,
      metrics: p.metrics,
      author_followers: p.authorFollowers,
      tags: p.tags,
      links: p.links,
      last_seen_at: now,
      // first_seen_at is intentionally absent: the column default sets it on
      // insert, and an upsert that omitted it leaves the stored value alone.
      // Sending `now` here would reset every post's discovery date on every
      // collection and erase the only "this is new" signal the archive has.
    }));

  const { error, count } = await supabase
    .from('social_posts')
    .upsert(rows, { onConflict: 'platform,post_id', count: 'exact' });

  if (error) {
    console.error('[social54] archive failed:', error.message);
    return { saved: 0, error: `Collected data was not archived: ${error.message}` };
  }
  return { saved: count ?? rows.length, error: null };
}

/**
 * Read archived posts for a window.
 *
 * This is what the macro trend pass runs on, and the reason it can look back
 * further than any platform API allows.
 */
export async function readArchivedPosts(opts: {
  days: number;
  platforms?: SocialPlatform[];
  handles?: string[];
  limit?: number;
}): Promise<SocialPost[]> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString();

  let query = supabase
    .from('social_posts')
    .select('*')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(opts.limit ?? 800);

  if (opts.platforms?.length) query = query.in('platform', opts.platforms);
  if (opts.handles?.length) query = query.in('author_handle', opts.handles.map((h) => h.toLowerCase()));

  const { data, error } = await query;
  if (error) throw new Error(`Could not read the post archive: ${error.message}`);
  return (data ?? []).map(mapPost);
}

/** How far back the archive actually reaches — the honest limit on a trend claim. */
export async function archiveCoverage(): Promise<{ earliest: string | null; posts: number }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_posts')
    .select('published_at')
    .order('published_at', { ascending: true })
    .limit(1);
  if (error) return { earliest: null, posts: 0 };

  const { count } = await supabase
    .from('social_posts')
    .select('post_id', { count: 'exact', head: true });

  return { earliest: data?.[0]?.published_at ?? null, posts: count ?? 0 };
}

// ─── editorial archive ────────────────────────────────────────────────────

/**
 * Archive what the field published.
 *
 * Same reasoning as archivePosts: no feed serves more than its recent entries,
 * so a coverage-gap claim is only checkable against what was there last time.
 * Best-effort — a sweep is worth showing even when it could not be persisted.
 *
 * first_seen_at is left to the column default and never sent on update, so
 * re-sweeping a piece keeps the date we discovered it. That is what separates
 * "they just published this" from "this was always in the feed and has only
 * now entered our window".
 */
export async function archiveEditorial(
  items: EditorialItem[],
): Promise<{ saved: number; error: string | null }> {
  const rows = items.filter((i) => i.url);
  if (rows.length === 0) return { saved: 0, error: null };

  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { error, count } = await supabase.from('social_editorial_items').upsert(
    rows.map((i) => ({
      url: i.url,
      source: i.source,
      host: i.host,
      title: i.title,
      summary: i.summary,
      categories: i.categories,
      published_at: i.publishedAt,
      last_seen_at: now,
    })),
    { onConflict: 'url', count: 'exact' },
  );

  if (error) {
    console.error('[social54] editorial archive failed:', error.message);
    return { saved: 0, error: `Published pieces were not archived: ${error.message}` };
  }
  return { saved: count ?? rows.length, error: null };
}

export async function readArchivedEditorial(opts: {
  days: number;
  limit?: number;
}): Promise<EditorialItem[]> {
  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - opts.days * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from('social_editorial_items')
    .select('*')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(opts.limit ?? 400);

  if (error) throw new Error(`Could not read the editorial archive: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    url: row.url,
    source: row.source,
    host: row.host ?? '',
    title: row.title ?? '',
    summary: row.summary ?? '',
    categories: row.categories ?? [],
    publishedAt: row.published_at ?? null,
  }));
}

// ─── runs ─────────────────────────────────────────────────────────────────

export function mapRun(row: any): SocialRun {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    subject: row.subject ?? null,
    status: row.status,
    provider: row.provider ?? null,
    model: row.model ?? null,
    summary: row.summary ?? null,
    payload: row.payload ?? {},
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

export async function createRun(input: {
  kind: SocialRunKind;
  title: string;
  subject?: string | null;
  provider?: AgentProvider | null;
  createdBy?: string | null;
}): Promise<SocialRun> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_runs')
    .insert({
      kind: input.kind,
      title: input.title,
      subject: input.subject ?? null,
      provider: input.provider ?? null,
      status: 'running',
      created_by: input.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not start the run: ${error.message}`);
  return mapRun(data);
}

export async function completeRun(
  id: string,
  input: {
    status: 'complete' | 'failed';
    summary?: string | null;
    payload?: Record<string, any>;
    model?: string | null;
  },
): Promise<SocialRun | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('social_runs')
    .update({
      status: input.status,
      summary: input.summary ?? null,
      payload: input.payload ?? {},
      model: input.model ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  // A run that produced its analysis but could not record it is still a
  // success from the caller's point of view — the result is in hand and gets
  // returned. Losing the whole run over a write failure would be worse.
  if (error) {
    console.error('[social54] could not complete run:', error.message);
    return null;
  }
  return mapRun(data);
}

export async function listRuns(kind?: SocialRunKind, limit = 50): Promise<SocialRun[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('social_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw new Error(`Could not read runs: ${error.message}`);
  return (data ?? []).map(mapRun);
}

export async function getRun(id: string): Promise<SocialRun | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('social_runs').select('*').eq('id', id).single();
  if (error) return null;
  return mapRun(data);
}

export async function deleteRun(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('social_runs').delete().eq('id', id);
  if (error) throw new Error(`Could not delete the run: ${error.message}`);
}
