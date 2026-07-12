import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Cache misses run summary generation + TTS back to back — needs more than
// Vercel's default function duration
export const maxDuration = 60;
import { client } from '@/sanity/client';
import { generateText, openai } from '@/lib/ai/router';
import { getSupabaseAdmin } from '@/lib/supabase/server';

// Summary text is written by Claude Opus (via lib/ai/router, GPT-5.6 fallback);
// narration stays on OpenAI TTS — Anthropic has no text-to-speech, and the
// GPT-Live voice models OpenAI shipped alongside 5.6 have no developer API yet.
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'nova';

// Generated audio is cached in Supabase (table article_audio + storage bucket
// article-audio, migration 009), keyed by slug + a hash of the article text.
// Cache hits skip both model calls, so each article version is paid for once
// and repeat listens start near-instantly. Republishing an article changes
// the hash and regenerates.
const AUDIO_BUCKET = 'article-audio';

const ARTICLE_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title,
  "author": author->name,
  excerpt,
  body
}`;

function portableTextToPlain(blocks: any[]): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((block) => {
      if (block._type !== 'block' || !block.children) return '';
      return block.children.map((child: any) => child.text || '').join('');
    })
    .filter(Boolean)
    .join('\n\n');
}

function audioResponse(audio: Buffer, summary: string, cache: 'hit' | 'miss') {
  return new NextResponse(audio, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      // Let the summary text ride along in a header for clients that want to show it
      'X-Summary': encodeURIComponent(summary),
      'X-Audio-Cache': cache,
      'Cache-Control': 'no-store',
    },
  });
}

async function readCache(
  slug: string,
  contentHash: string,
): Promise<{ audio: Buffer; summary: string } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('article_audio')
      .select('content_hash, summary, audio_path')
      .eq('slug', slug)
      .maybeSingle();

    if (!row || row.content_hash !== contentHash) return null;

    const { data: file, error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .download(row.audio_path);
    if (error || !file) return null;

    return { audio: Buffer.from(await file.arrayBuffer()), summary: row.summary };
  } catch (err: any) {
    console.error('[Demeter] Audio cache read error:', err?.message);
    return null;
  }
}

async function writeCache(slug: string, contentHash: string, summary: string, audio: Buffer) {
  try {
    const supabase = getSupabaseAdmin();
    const audioPath = `${slug}/${contentHash}.mp3`;

    let { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(audioPath, audio, { contentType: 'audio/mpeg', upsert: true });

    // First deploy on an environment where migration 009 hasn't created the bucket
    if (uploadError && /bucket not found/i.test(uploadError.message)) {
      await supabase.storage.createBucket(AUDIO_BUCKET, { public: false });
      ({ error: uploadError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .upload(audioPath, audio, { contentType: 'audio/mpeg', upsert: true }));
    }
    if (uploadError) throw uploadError;

    await supabase.from('article_audio').upsert(
      {
        slug,
        content_hash: contentHash,
        summary,
        audio_path: audioPath,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    );
  } catch (err: any) {
    // Cache failures must never break playback — the generated audio still ships
    console.error('[Demeter] Audio cache write error:', err?.message);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  }

  try {
    const post = await client.fetch(ARTICLE_QUERY, { slug });
    if (!post) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const articleText = portableTextToPlain(post.body || []) || post.excerpt || '';
    if (!articleText.trim()) {
      return NextResponse.json({ error: 'Article has no readable content' }, { status: 422 });
    }

    const contentHash = createHash('sha256')
      .update(`${post.title}|${post.author ?? ''}|${articleText}`)
      .digest('hex')
      .slice(0, 16);

    // 0. Serve from cache when this article version has already been narrated
    const cached = await readCache(slug, contentHash);
    if (cached) {
      return audioResponse(cached.audio, cached.summary, 'hit');
    }

    // 1. Summarize into spoken-word copy
    const summary = await generateText({
      system:
        "You are Demeter, Knead Magazine's editorial companion — warm, intelligent, never stuffy. " +
        'Write a spoken-word summary of the article to be read aloud as an audio intro. ' +
        'Two to three short paragraphs, about 120–160 words. Conversational and natural. ' +
        'No markdown, no bullet points, no headings, no "in this article" preamble — just begin.',
      prompt: `Article: "${post.title}"${post.author ? ` by ${post.author}` : ''}\n\n${articleText.slice(0, 8000)}`,
      maxTokens: 320,
      logTag: 'Demeter/summary',
    });

    if (!summary) {
      return NextResponse.json({ error: 'Could not generate summary' }, { status: 500 });
    }

    // 2. Narrate the summary
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: summary.slice(0, 4000),
    });

    const audio = Buffer.from(await speech.arrayBuffer());

    // 3. Cache for every future listener
    await writeCache(slug, contentHash, summary, audio);

    return audioResponse(audio, summary, 'miss');
  } catch (err: any) {
    console.error('[Demeter] Article summary audio error:', err.message);
    return NextResponse.json({ error: 'Failed to generate audio summary' }, { status: 500 });
  }
}
