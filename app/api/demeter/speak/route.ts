import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Demeter's narration voice. `nova` is warm and conversational — matches the
// editorial-companion persona. Swap `voice`/`model` here to retune.
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'nova';

// OpenAI's TTS input cap is 4096 chars; keep a little headroom.
const MAX_CHARS = 4000;

export async function POST(req: NextRequest) {
  // Uncached TTS — each call costs money. Rate limit per IP.
  const { success } = await rateLimit('demeter-speak', getClientIp(req), {
    limit: 20,
    windowSeconds: 60,
  });
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  try {
    const speech = await openai.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text.slice(0, MAX_CHARS),
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[Demeter] TTS error:', err.message);
    return NextResponse.json({ error: 'Failed to generate audio' }, { status: 500 });
  }
}
