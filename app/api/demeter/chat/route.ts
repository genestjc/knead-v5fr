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

const ARTICLE_SEARCH_QUERY = `*[_type == "post" && (
  title match $keyword ||
  pt::text(body) match $keyword ||
  author->name match $keyword
)] | order(publishedAt desc) [0...6] {
  title,
  "slug": slug.current,
  "author": author->name,
  publishedAt,
  "categories": categories[]->title,
  excerpt
}`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description:
      'Search the web for current information about people, places, events, or topics mentioned in the article — e.g. upcoming dinners, recent news, social media activity, event dates.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'A focused search query.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_articles',
    description:
      "Search Knead's published stories by keyword, subject name, or topic. Use this whenever someone asks about a specific story, person, or subject — e.g. 'Tell me about the Joey Khamis story' or 'Do you have anything about vintage fashion?'. Returns titles, authors, slugs, and excerpts.",
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'A name, subject, or topic to search for.',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_article',
    description:
      "Fetch the full text of a specific Knead story by its slug. Use this after search_articles returns a match and the user wants to know more about that story.",
    input_schema: {
      type: 'object' as const,
      properties: {
        slug: {
          type: 'string',
          description: 'The story slug from search_articles results.',
        },
      },
      required: ['slug'],
    },
  },
];

async function searchArticles(keyword: string): Promise<string> {
  try {
    const results = await sanity.fetch(ARTICLE_SEARCH_QUERY, { keyword: `*${keyword}*` });
    if (!results?.length) return `No Knead stories found matching "${keyword}".`;
    return results
      .map((r: any) =>
        [
          `TITLE: ${r.title}`,
          `SLUG: ${r.slug}`,
          r.author ? `BY: ${r.author}` : '',
          r.categories?.length ? `TOPICS: ${r.categories.join(', ')}` : '',
          r.excerpt ? `EXCERPT: ${r.excerpt}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n---\n\n');
  } catch (err) {
    console.error('[Demeter] Article search error:', err);
    return 'Could not search articles right now.';
  }
}

async function getArticle(slug: string): Promise<string> {
  try {
    const post = await sanity.fetch(ARTICLE_QUERY, { slug });
    if (!post) return `No story found with slug "${slug}".`;
    const bodyText = portableTextToPlain(post.body || []);
    return [
      `TITLE: ${post.title}`,
      post.author ? `BY: ${post.author}` : '',
      post.categories?.length ? `TOPICS: ${post.categories.join(', ')}` : '',
      '',
      bodyText,
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.error('[Demeter] Get article error:', err);
    return 'Could not fetch that story right now.';
  }
}

async function webSearch(query: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 5,
    }),
  });
  const data = await res.json();
  if (data.answer) return data.answer;
  return (
    data.results
      ?.map((r: any) => `${r.title}: ${r.content}`)
      .join('\n\n') || 'No results found.'
  );
}

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

  const isPitchDeck = slug === 'ff-pitch-deck';

  let articleContext = '';
  let articleTitle = '';
  if (slug && !isPitchDeck) {
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

  const systemPrompt = isPitchDeck
    ? `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

You are embedded in Knead's investor pitch deck. Potential investors are reading about the platform and may want to explore Knead's actual published stories to get a feel for the editorial voice.

You have two special abilities:
1. search_articles — search Knead's full library of published stories by name, subject, or topic
2. get_article — read the full text of a specific story once you've found its slug via search_articles

When someone asks about a specific story or person (e.g. "Tell me about the Joey Khamis story", "Do you have anything on vintage fashion?"), always use search_articles first. If they want to go deeper, use get_article to pull the full piece.

You can also answer questions about:
- How Knead works (memberships, chat, Demeter, the raise)
- The culture and themes Knead covers
- Specific stories and the people in them

Keep responses to 2–3 short paragraphs. Match Knead's voice: intelligent, warm, never stuffy.

After every response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`
    : articleContext
    ? `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

You are embedded in this article:

---
${articleContext}
---

Rules:
- Only answer questions related to this article and the people, places, events, and themes within it
- Use web_search when you need current information — upcoming events, recent news, social media activity — about subjects in the article
- If someone asks something completely unrelated to this article or Knead's world (recipes, homework, coding, etc.), respond: "I'm here to help you explore this story — ask me anything about it."
- Keep responses to 2–3 short paragraphs
- Match Knead's voice: intelligent, warm, never stuffy

After every on-topic response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`
    : `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

Only answer questions related to Knead Magazine's world: culture, food, fashion, music, art, and the stories we cover. If asked something unrelated, respond: "I'm here to help you explore Knead's world — ask me anything about our stories."

Use web_search for current information when relevant. Keep responses to 2–3 short paragraphs.

After every response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`;

  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    let reply = '';

    for (let round = 0; round < 5; round++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        const text = response.content.find(
          (b) => b.type === 'text',
        ) as Anthropic.TextBlock | undefined;
        reply = text?.text ?? '';
        break;
      }

      if (response.stop_reason === 'tool_use') {
        const toolUses = response.content.filter(
          (b) => b.type === 'tool_use',
        ) as Anthropic.ToolUseBlock[];

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUses.map(async (t) => {
            let content = 'Unknown tool.';
            if (t.name === 'web_search') {
              content = await webSearch((t.input as any).query).catch(() => 'Search unavailable.');
            } else if (t.name === 'search_articles') {
              content = await searchArticles((t.input as any).keyword);
            } else if (t.name === 'get_article') {
              content = await getArticle((t.input as any).slug);
            }
            return { type: 'tool_result' as const, tool_use_id: t.id, content };
          }),
        );

        messages.push({ role: 'user', content: toolResults });
      }
    }

    return NextResponse.json({ reply, articleTitle });
  } catch (err: any) {
    console.error('[Demeter] Claude error:', err.message);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
