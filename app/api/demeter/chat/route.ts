import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'next-sanity';
import { runAgentChat, OPENAI_SOL, type AgentTool } from '@/lib/ai/router';
import { webSearch } from '@/lib/ai/web-search';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Tool loops can exceed Vercel's default function duration
export const maxDuration = 60;

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

const TOOLS: AgentTool[] = [
  {
    name: 'web_search',
    description:
      "Search the live web and get back sources you can cite. REQUIRED before you state anything about the world that is not written in the article you're embedded in — upcoming projects, dinners or events, recent news, social activity, what a subject is doing now, or where a place actually is. Your own recollection is not a substitute: if it is not in the article and you did not search for it this turn, you do not know it.",
    parameters: {
      type: 'object',
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
    parameters: {
      type: 'object',
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
    parameters: {
      type: 'object',
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

// Demeter kept answering "what else is this person up to?" from the model's
// own recall — plausible, unattributable, and occasionally wrong. The tool
// description alone wasn't enough to make it reach for the tool, so the rule
// is stated in the prompt too, on every variant.
const SEARCH_RULES = `Facts from outside the material in front of you (important):
- Anything you have not been given here, you do not know. Upcoming projects, recent news, events, social activity, where a place is, what someone is doing now — call web_search FIRST, then answer from what comes back. Never answer those from memory, and never dress up a guess as a finding.
- Name the source in your reply the way an editor would — "per Eater LA", "her studio's site lists". A clause is plenty; no URLs, no link dumps, no footnotes.
- Keep the line visible between what you were given, what you found, and what you're inferring. If you're reading between the lines, say so.
- If the search comes back empty or unavailable, say plainly that you couldn't find anything current and give the reader what you do have. An honest miss beats a confident invention.`;

// The reader's thread is sent up with every turn. Demeter used to volunteer
// that it couldn't remember anything — which read as broken to anyone in an
// in-app browser, where the whole session lives inside one WebView.
const CONTINUITY_RULES = `Continuity:
- You are given the conversation so far. Follow-ups like "what was her name again?" or "make it punchier" resolve against those earlier turns — read them and answer.
- Never tell the reader you can't remember, that you don't retain context, that the thread is lost, or that they'll have to repeat themselves. If a reference is genuinely ambiguous, just ask which one they mean.`;

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
  // Public endpoint that spends LLM + web-search budget on every call. Rate
  // limit per IP to blunt cost-DoS abuse.
  const { success } = await rateLimit('demeter-chat', getClientIp(req), {
    limit: 20,
    windowSeconds: 60,
  });
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

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

${SEARCH_RULES}

${CONTINUITY_RULES}

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
- If someone asks something completely unrelated to this article or Knead's world (recipes, homework, coding, etc.), respond: "I'm here to help you explore this story — ask me anything about it."
- Keep responses to 2–3 short paragraphs
- Match Knead's voice: intelligent, warm, never stuffy

${SEARCH_RULES}

${CONTINUITY_RULES}

Sharing (important — this is part of your job):
- Knead grows when readers share stories. After you give a TLDR or summary, or whenever the reader seems engaged, offer to craft them a short post to share on social — and make one of your two suggested follow-up questions that offer, phrased as the reader would say it (e.g. "Craft me a post I can share")
- When the reader accepts or asks for a shareable post, write ONE post in the reader's own first-person voice: under 240 characters, punchy and specific to this story, no hashtags, no links (the article link is attached automatically). Wrap only the post text between [SHARE] and [/SHARE] markers. Outside the markers, say at most one short sentence (e.g. "Here you go — tweak it however you like.")
- After delivering a share post, your two suggested follow-ups should be revision requests, e.g. "Make it punchier" and "Try a different angle"

After every on-topic response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`
    : `You are Demeter, Knead Magazine's editorial AI companion — curious, warm, and knowledgeable about culture, food, fashion, and the arts.

Only answer questions related to Knead Magazine's world: culture, food, fashion, music, art, and the stories we cover. If asked something unrelated, respond: "I'm here to help you explore Knead's world — ask me anything about our stories."

Keep responses to 2–3 short paragraphs.

${SEARCH_RULES}

${CONTINUITY_RULES}

After every response, suggest two follow-up questions:
You might also ask:
• [question one]
• [question two]`;

  try {
    const reply = await runAgentChat({
      system: systemPrompt,
      history,
      message,
      tools: TOOLS,
      executeTool: async (name, args) => {
        if (name === 'web_search') {
          // webSearch handles its own failures and returns an instruction not
          // to answer from memory, so a thrown-away error here would defeat it.
          return webSearch(args.query, { logTag: 'Demeter' });
        }
        if (name === 'search_articles') {
          return searchArticles(args.keyword);
        }
        if (name === 'get_article') {
          return getArticle(args.slug);
        }
        return 'Unknown tool.';
      },
      maxTokens: 1024,
      maxRounds: 5,
      // Editorial voice runs Opus; if Claude fails, fall back to OpenAI's
      // flagship tier rather than the budget default — this traffic only
      // exists during an outage, so the premium costs nothing normally.
      openaiModel: OPENAI_SOL,
      logTag: 'Demeter',
    });

    return NextResponse.json({ reply, articleTitle });
  } catch (err: any) {
    console.error('[Demeter] AI error:', err.message);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
