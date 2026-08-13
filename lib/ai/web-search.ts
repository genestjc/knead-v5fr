/**
 * Tavily web search, formatted so the model can attribute what it says.
 *
 * Every Demeter surface used to carry its own copy of this call, and each one
 * had the same two flaws:
 *
 * 1. `include_answer` returns an LLM-written paragraph with no URLs, and the
 *    old code returned it ALONE whenever it existed — `data.results`, the only
 *    part carrying sources, was discarded. The model then had nothing to cite,
 *    so a searched answer was indistinguishable from a remembered one. Results
 *    (title + URL + snippet) are now always included; the answer rides along
 *    as a summary, clearly labelled as Tavily's synthesis rather than a source.
 *
 * 2. Failures were silent. A missing API key or a non-200 from Tavily fell
 *    through to "No results found.", which reads to the model like "the web
 *    has nothing" — an invitation to answer from memory instead. Each failure
 *    now returns an explicit instruction not to substitute recall for a lookup.
 *
 * The return value is prose because it goes back as a tool result. It is
 * written to be read by the model, so the framing is deliberate.
 */

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Results come back ranked by Tavily's relevance score, which has no sense of
 * time — an artist's card collab from three years ago outranks last month's
 * because it was written about more. Asked "what trading cards has he done?",
 * the model then served the old one as the answer and never mentioned the
 * current project. Recency is a ranking preference and the tie is a question
 * for the reader, not something to resolve silently by picking one.
 */
const RANKING_GUIDANCE = `HOW TO READ THESE RESULTS
- They are ordered by keyword relevance, NOT by date. Re-order them yourself before you answer.
- Default to the most recent thing that answers the question. Older results are context, not the headline — unless the reader asked about a specific past project, era, or date, in which case that one leads.
- If two or more genuinely DIFFERENT things match (different projects, collaborators, releases, venues), do not silently pick one. Lead with the most recent, name the other in a clause, and ask which they want — then make your two suggested follow-ups those options, one each.
- Watch for results with no date, and for a "latest"/"new" claim in an article that is itself years old. Do not promote either into "currently" or "just announced" on its own. Say when something dates from if it matters to the answer.`;

/** Tacked onto every failure so a dead lookup never reads as "nothing exists". */
const NO_SUBSTITUTE =
  'Do NOT answer from memory or fill the gap with a plausible guess. Tell the reader you could not verify anything current, and offer what you do know from the material in front of you.';

/**
 * How far back to let results come from. Deliberately defaults to 'any'.
 *
 * A narrow window is a FILTER, not a ranking hint — Tavily drops everything
 * outside it. Asking "what trading cards has this artist done?" against a
 * one-year window would silently erase an older collaboration, and the reader
 * would never learn it existed. Recency is handled as ordering guidance in the
 * framing below instead, so the model sees every era and can offer the choice.
 * Only narrow when the reader explicitly wants recent-only ("this week's…").
 */
export type SearchRecency = 'any' | 'week' | 'month' | 'year';

const RECENCY_VALUES: SearchRecency[] = ['any', 'week', 'month', 'year'];

export interface WebSearchOptions {
  /** How many results to ask Tavily for. Defaults to 6. */
  maxResults?: number;
  /** Prefix for error logs, e.g. 'Demeter'. */
  logTag?: string;
  /** Hard time filter. Defaults to 'any' — see SearchRecency. */
  recency?: SearchRecency;
}

/**
 * Tavily's published_date arrives in mixed formats and is often absent. Render
 * what parses and drop what doesn't — a malformed date must never surface as
 * "Invalid Date", which the model would read as a real value.
 */
function formatDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export async function webSearch(query: string, opts: WebSearchOptions = {}): Promise<string> {
  const { maxResults = 6, logTag = 'web_search' } = opts;
  // The model fills this in, so an off-enum value is possible. Anything we
  // don't recognise falls back to the unfiltered default rather than being
  // forwarded to Tavily as a bogus time_range.
  const recency: SearchRecency = RECENCY_VALUES.includes(opts.recency as SearchRecency)
    ? (opts.recency as SearchRecency)
    : 'any';
  const trimmed = query.trim();

  if (!trimmed) {
    return `No query was given to web_search. Call it again with a focused query. ${NO_SUBSTITUTE}`;
  }

  if (!process.env.TAVILY_API_KEY) {
    console.error(`[${logTag}] TAVILY_API_KEY missing — web search cannot run`);
    return `WEB SEARCH UNAVAILABLE: this deployment has no search credentials configured, so no lookup happened. ${NO_SUBSTITUTE}`;
  }

  let data: any;
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: trimmed,
        search_depth: 'basic',
        include_answer: true,
        max_results: maxResults,
        // Omitted entirely for 'any' — sending a range is what excludes older
        // results, and the default has to keep them.
        ...(recency !== 'any' ? { time_range: recency } : {}),
      }),
    });

    if (!res.ok) {
      console.error(`[${logTag}] Tavily returned ${res.status} for "${trimmed}"`);
      return `WEB SEARCH FAILED: the search service returned an error (HTTP ${res.status}), so nothing was retrieved. ${NO_SUBSTITUTE}`;
    }

    data = await res.json();
  } catch (err: any) {
    console.error(`[${logTag}] Web search error:`, err?.message ?? err);
    return `WEB SEARCH FAILED: the search request could not be completed, so nothing was retrieved. ${NO_SUBSTITUTE}`;
  }

  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  const answer = typeof data?.answer === 'string' ? data.answer.trim() : '';

  if (results.length === 0 && !answer) {
    return `WEB SEARCH RETURNED NOTHING for "${trimmed}". The search ran and genuinely found no usable results — try one more query with different wording if you have a better angle. If that also comes back empty, say plainly that you could not find anything current. ${NO_SUBSTITUTE}`;
  }

  const sources = results
    .map((r, i) => {
      const title = String(r?.title ?? 'Untitled').trim();
      const url = String(r?.url ?? '').trim();
      const content = String(r?.content ?? '').trim();
      // Tavily only fills published_date for some results. Surface it when it
      // is there — without a date the model cannot tell a current project from
      // one several years old, which is how an old collaboration gets served
      // as if it were the latest news.
      const date = formatDate(r?.published_date);
      return [
        `[${i + 1}] ${title}`,
        date ? `    Published: ${date}` : '    Published: date not given by the source',
        url ? `    ${url}` : '',
        content ? `    ${content}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  // Sections are joined with a blank line between them. Built as a list of
  // non-empty blocks rather than interleaved '' separators, so dropping an
  // absent section (no answer, no sources) can't leave a stray gap — or, as
  // it did once, take the intended blank lines down with it.
  const sections = [
    `LIVE WEB SEARCH RESULTS for "${trimmed}"${recency !== 'any' ? ` (narrowed to the past ${recency})` : ''}`,
    'These came back from a real search just now. Anything you state as current fact must be traceable to one of the sources below, and you must name that source in your reply (the publication or site, in plain prose — not a raw URL). Anything you cannot support from this block is inference: either leave it out or mark it clearly as your own read rather than something you found.',
    RANKING_GUIDANCE,
    answer
      ? `SEARCH SUMMARY (auto-generated from the sources — attribute to the sources, not to this line):\n${answer}`
      : '',
    sources ? `SOURCES:\n${sources}` : '',
  ];

  return sections.filter(Boolean).join('\n\n');
}
