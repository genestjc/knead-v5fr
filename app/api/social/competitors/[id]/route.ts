/**
 * One competitor: edit their handles and note, deactivate them, or remove them.
 *
 * Deactivating is the softer option and the one the console offers first —
 * an inactive competitor stops being collected but keeps their archived posts,
 * so a comparison run against last month still resolves. Deleting the row does
 * not delete the archive either; social_posts is keyed by handle, not by
 * roster id, precisely so removing a competitor never rewrites history.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireSocialAdmin } from '@/lib/social/require-admin';
import { deleteCompetitor, normalizeHandles, updateCompetitor } from '@/lib/social/store';
import { normalizeFeedInput } from '@/lib/social/editorial';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  const body = await req.json().catch(() => null);
  const patch: Parameters<typeof updateCompetitor>[1] = {};

  if (typeof body?.name === 'string') {
    const name = body.name.trim().slice(0, 120);
    if (!name) return NextResponse.json({ error: 'The name cannot be empty.' }, { status: 400 });
    patch.name = name;
  }
  if (body?.note !== undefined) {
    patch.note = String(body.note ?? '').trim().slice(0, 500) || null;
  }
  if (body?.handles !== undefined) {
    patch.handles = normalizeHandles(body.handles);
  }
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive;

  // Takes a homepage or a feed. Clearing it is an explicit empty string.
  let feedNote = '';
  if (body?.feedUrl !== undefined) {
    const raw = String(body.feedUrl ?? '').trim();
    if (!raw) {
      patch.feedUrl = null;
    } else {
      const resolved = await normalizeFeedInput(raw);
      if (!resolved.feedUrl) {
        return NextResponse.json({ error: resolved.note }, { status: 400 });
      }
      patch.feedUrl = resolved.feedUrl;
      feedNote = resolved.note;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  // Checked against the merged result rather than the patch alone: clearing
  // the handles is fine on an entry that has a feed, and clearing the feed is
  // fine on one that has handles. Neither is fine on its own.
  try {
    const competitor = await updateCompetitor(params.id, patch);
    if (competitor.handles.length === 0 && !competitor.feedUrl) {
      // Put it back rather than leaving a roster entry nothing will ever read.
      await updateCompetitor(params.id, {
        handles: body?.handles !== undefined ? normalizeHandles(body.handles) : undefined,
        feedUrl: competitor.feedUrl,
        isActive: false,
      });
      return NextResponse.json(
        {
          error:
            'That would leave the entry with no handles and no feed, so nothing would ever collect it. It has been deactivated instead — give it a handle or a feed URL to bring it back.',
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ competitor, feedNote });
  } catch (err: any) {
    console.error('[social54] competitor PATCH:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSocialAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status ?? 401 });

  try {
    await deleteCompetitor(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[social54] competitor DELETE:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
