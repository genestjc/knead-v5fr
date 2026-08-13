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

/** Tacked onto every failure so a dead lookup never reads as "nothing exists". */
const NO_SUBSTITUTE =
  'Do NOT answer from memory or fill the gap with a plausible guess. Tell the reader you could not verify anything current, and offer what you do know from the material in front of you.';

export interface WebSearchOptions {
  /** How many results to ask Tavily for. Defaults to 5. */
  maxResults?: number;
  /** Prefix for error logs, e.g. 'Demeter'. */
  logTag?: string;
}

export async function webSearch(query: string, opts: WebSearchOptions = {}): Promise<string> {
  const { maxResults = 5, logTag = 'web_search' } = opts;
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
      return [`[${i + 1}] ${title}`, url ? `    ${url}` : '', content ? `    ${content}` : '']
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return [
    `LIVE WEB SEARCH RESULTS for "${trimmed}"`,
    '',
    'These came back from a real search just now. Anything you state as current fact must be traceable to one of the sources below, and you must name that source in your reply (the publication or site, in plain prose — not a raw URL). Anything you cannot support from this block is inference: either leave it out or mark it clearly as your own read rather than something you found.',
    answer ? `\nSEARCH SUMMARY (auto-generated from the sources — attribute to the sources, not to this line):\n${answer}` : '',
    sources ? `\nSOURCES:\n${sources}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
