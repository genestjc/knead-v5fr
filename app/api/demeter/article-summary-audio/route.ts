import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/sanity/client';
import { generateText, openai } from '@/lib/ai/router';

// Summary text is written by Claude Opus (via lib/ai/router, GPT-5 fallback);
// narration stays on OpenAI TTS — Anthropic has no text-to-speech.
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'nova';

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

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        // Let the summary text ride along in a header for clients that want to show it
        'X-Summary': encodeURIComponent(summary),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[Demeter] Article summary audio error:', err.message);
    return NextResponse.json({ error: 'Failed to generate audio summary' }, { status: 500 });
  }
}
