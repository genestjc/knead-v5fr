import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from 'next-sanity';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const sanity = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2023-05-03',
  useCdn: true,
});

const ARTICLE_QUERY = `*[_type == "post" && slug.current == $slug][0]{
  title,
  "author": author->name,
  publishedAt,
  "categories": categories[]->title,
  excerpt,
  body
}`;

/** Convert Portable Text blocks to plain readable text */
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
  if (!body?.message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const { message, slug, history = [] } = body as {
    message: string;
    slug?: string;
    history: { role: 'user' | 'assistant'; content: string }[];
  };

  // Build article context if a slug is provided
  let articleContext = '';
  let articleTitle = '';
  if (slug) {
    try {
      const post = await sanity.fetch(ARTICLE_QUERY, { slug });
      if (post) {
        articleTitle = post.title || '';
        const bodyText = portableTextToPlain(post.body || []);
        articleContext = [
          `ARTICLE: "${post.title}"`,
          post.author ? `BY: ${post.author}` : '',
          post.categories?.length ? `TOPICS: ${post.categories.join(', ')}` : '',
          '',
          bodyText,
        ]
          .filter(Boolean)
          .join('\n');
      }
    } catch (err) {
      console.error('[Demeter] Sanity fetch error:', err);
    }
  }

  const systemPrompt = articleContext
    ? `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

You are currently embedded in this article:

---
${articleContext}
---

Your role:
- Answer questions about this article, its subjects, themes, and context
- Bring in relevant wider knowledge that enriches what the reader just read
- Keep responses concise — 2 to 3 short paragraphs at most
- Match Knead's voice: intelligent, approachable, never stuffy
- If a question is unrelated to the article, answer helpfully but gently tie it back to the story

After every response, suggest two natural follow-up questions on a new line in this exact format:
You might also ask:
• [question one]
• [question two]`
    : `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

Answer questions helpfully and in Knead's voice: intelligent, approachable, never stuffy. Keep responses to 2-3 short paragraphs.

After every response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content.find((b) => b.type === 'text') as Anthropic.TextBlock | undefined;

    return NextResponse.json({
      reply: text?.text ?? '',
      articleTitle,
    });
  } catch (err: any) {
    console.error('[Demeter] Claude error:', err.message);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
