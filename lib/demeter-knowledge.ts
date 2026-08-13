/**
 * Demeter's knowledge tools — the read-only surface shared by every Demeter.
 *
 * These are the ONLY tools Demeter gets. All four are reads: Sanity for
 * published stories, Supabase for scheduled events, Tavily for current info.
 * Nothing here writes, spends, or mutates state, which is the point — the
 * blast radius of a prompt injection against this agent is a wasted API call.
 *
 * If you add a tool to this file, it must be a read. Anything that writes
 * belongs behind an authenticated HTTP route with its own role check and rate
 * limit, not behind a model's judgment.
 */
import { createClient } from 'next-sanity';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { AgentTool } from '@/lib/ai/router';
import { webSearch } from '@/lib/ai/web-search';

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

export const KNOWLEDGE_TOOLS: AgentTool[] = [
  {
    name: 'search_articles',
    description:
      "Search Knead's published stories by keyword, subject name, or topic. Use this whenever someone asks about a specific story, person, or subject. Returns titles, authors, slugs, and excerpts.",
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'A name, subject, or topic to search for.' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'get_article',
    description:
      'Fetch the full text of a specific Knead story by its slug. Use this after search_articles returns a match and the reader wants to go deeper.',
    parameters: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The story slug from search_articles results.' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_events',
    description:
      "List Knead's events — dinners, screenings, launches, and community calls. Use this for any question about what is coming up, when something is happening, or what recently took place.",
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: "Filter by event status, e.g. 'upcoming' or 'live'. Omit for all events.",
        },
      },
      required: [],
    },
  },
  {
    name: 'web_search',
    description:
      'Search the web for current information about people, places, or events connected to Knead — recent news, event dates, social activity. Use only to ground an answer about Knead or a subject Knead covers.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A focused search query.' },
      },
      required: ['query'],
    },
  },
];

export function portableTextToPlain(blocks: any[]): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((block) => {
      if (block._type !== 'block' || !block.children) return '';
      return block.children.map((child: any) => child.text || '').join('');
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function searchArticles(keyword: string): Promise<string> {
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

export async function getArticle(slug: string): Promise<string> {
  try {
    const post = await sanity.fetch(ARTICLE_QUERY, { slug });
    if (!post) return `No story found with slug "${slug}".`;
    return [
      `TITLE: ${post.title}`,
      post.author ? `BY: ${post.author}` : '',
      post.categories?.length ? `TOPICS: ${post.categories.join(', ')}` : '',
      '',
      portableTextToPlain(post.body || []),
    ]
      .filter(Boolean)
      .join('\n');
  } catch (err) {
    console.error('[Demeter] Get article error:', err);
    return 'Could not fetch that story right now.';
  }
}

/** Events live in Supabase (chat_events), not Sanity. Read-only, capped at 10. */
export async function getEvents(status?: string): Promise<string> {
  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false })
      .limit(10);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return status ? `No ${status} Knead events found.` : 'No Knead events found.';

    return data
      .map((e: any) =>
        [
          `EVENT: ${e.title ?? 'Untitled'}`,
          e.scheduled_start ? `WHEN: ${e.scheduled_start}` : '',
          e.status ? `STATUS: ${e.status}` : '',
          e.description ? `ABOUT: ${String(e.description).slice(0, 500)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n---\n\n');
  } catch (err) {
    console.error('[Demeter] Events lookup error:', err);
    return 'Could not look up events right now.';
  }
}

// Re-exported so the community-chat agent keeps importing search from the
// knowledge module alongside the rest of Demeter's read-only tools.
export { webSearch };

/** Single dispatcher so every Demeter surface exposes the identical tool set. */
export async function executeKnowledgeTool(name: string, args: any): Promise<string> {
  switch (name) {
    case 'search_articles':
      return searchArticles(String(args?.keyword ?? ''));
    case 'get_article':
      return getArticle(String(args?.slug ?? ''));
    case 'get_events':
      return getEvents(args?.status ? String(args.status) : undefined);
    case 'web_search':
      return webSearch(String(args?.query ?? ''), { logTag: 'Demeter' });
    default:
      return `Unknown tool: ${name}`;
  }
}
