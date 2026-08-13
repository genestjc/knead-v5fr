// GitHub API utilities for Demeter
// All calls go through the GitHub Contents/Search API so token auth works on private repos.
// Functions accept an explicit repo/branch so they work equally well against
// Knead's own repo and any vendor SDK repo Demeter needs to explore.
//
// Successful responses are cached in Supabase (repo_cache table, 1-hour TTL,
// migration 010_repo_cache.sql) so repeat lookups skip GitHub entirely —
// faster tool rounds and immunity to GitHub's rate limits (code search allows
// ~10 req/min). Cache failures always fall through to a live fetch.
//
// Lookups report WHY they came back empty rather than returning a bare null,
// because the build assistant has to explain a miss to a beginner: "that file
// doesn't exist" and "I can't reach the repo right now" are different answers,
// and neither one is permission to invent code and call it repo source.

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { redactSecrets } from '@/lib/secret-scan';

export const KNEAD_REPO = process.env.KNEAD_GITHUB_REPO ?? 'genestjc/knead-v5fr';
export const KNEAD_BRANCH = process.env.KNEAD_GITHUB_BRANCH ?? 'main';
const DEFAULT_BRANCH = KNEAD_BRANCH;
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Per-file budget for a file shown in chat. Must stay comfortably under the
 * router's MAX_TOOL_RESULT_CHARS, or the router's own truncation would cut off
 * the verbatim end marker and the model could no longer tell where real source
 * stops and its own text begins.
 */
export const CHAT_MAX_FILE_BYTES = 12_000;

/**
 * Budget for reads that need the whole file rather than a preview: the ZIP
 * builder (a truncated file in a starter kit is a broken file) and line-range
 * requests, which slice a window out of the full text.
 */
export const FULL_MAX_FILE_BYTES = 400_000;

// ---------- Supabase-backed cache ----------

async function cacheGet(key: string): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('repo_cache')
      .select('content, fetched_at')
      .eq('cache_key', key)
      .maybeSingle();
    if (!data) return null;
    if (Date.now() - new Date(data.fetched_at).getTime() > CACHE_TTL_MS) return null;
    return data.content;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, content: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('repo_cache').upsert(
      { cache_key: key, content, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' },
    );
  } catch (e) {
    console.error('[github] cache write error:', e);
  }
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// ---------- fetch a single file (any repo) ----------

/**
 * Why a lookup came back empty. Callers turn this into honest copy — the build
 * assistant must be able to tell "this file does not exist" apart from "we
 * cannot see the repo at all", because the two need different answers and
 * neither is a licence to invent code.
 */
export type RepoFetchFailure = 'not-found' | 'no-access' | 'rate-limited' | 'network';

export interface RepoFileResult {
  ok: boolean;
  repo: string;
  branch: string;
  path: string;
  /** File text, capped to the requested budget. Empty string when ok is false. */
  content: string;
  /** Line count of the file as stored in the repo, not of `content`. */
  totalLines: number;
  totalBytes: number;
  /** True when `content` holds only the first part of the file. */
  truncated: boolean;
  failure?: RepoFetchFailure;
  status?: number;
}

interface CachedFile {
  content: string;
  totalLines: number;
  totalBytes: number;
  truncated: boolean;
}

function classifyFailure(status: number, rateLimitRemaining: string | null): RepoFetchFailure {
  // A private repo we can't authenticate against answers 404, not 403 — so a
  // 404 with no token on hand means "invisible", not "absent".
  if (status === 404) return process.env.GITHUB_TOKEN ? 'not-found' : 'no-access';
  if (status === 401) return 'no-access';
  if (status === 403 || status === 429) {
    return rateLimitRemaining === '0' ? 'rate-limited' : 'no-access';
  }
  return 'network';
}

export function repoFileUrl(repo: string, branch: string, path: string): string {
  return `https://github.com/${repo}/blob/${branch}/${path}`;
}

/**
 * Fetch one file and report exactly what happened. Prefer this over
 * `fetchRepoFile` anywhere the caller has to explain a miss to a human.
 */
export async function fetchRepoFileResult(
  repo: string,
  branch: string,
  path: string,
  maxBytes: number = CHAT_MAX_FILE_BYTES,
): Promise<RepoFileResult> {
  const cleanPath = path.trim().replace(/^\/+/, '');
  const base = { repo, branch, path: cleanPath };
  const miss = (failure: RepoFetchFailure, status?: number): RepoFileResult => ({
    ...base,
    ok: false,
    content: '',
    totalLines: 0,
    totalBytes: 0,
    truncated: false,
    failure,
    status,
  });

  if (!cleanPath) return miss('not-found');

  // The byte budget is part of the cache key: a 12 KB chat preview must never
  // be handed to the ZIP builder, which needs the file whole.
  const key = `file:${repo}@${branch}:${cleanPath}#${maxBytes}`;
  const hit = await cacheGet(key);
  if (hit !== null) {
    try {
      const cached = JSON.parse(hit) as CachedFile;
      return { ...base, ok: true, ...cached };
    } catch {
      // corrupt cache entry — fall through to a live fetch
    }
  }

  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(cleanPath)}?ref=${branch}`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github.raw+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      const failure = classifyFailure(res.status, res.headers.get('x-ratelimit-remaining'));
      console.error(`[github] ${res.status} (${failure}) fetching ${repo}/${branch}/${cleanPath}`);
      return miss(failure, res.status);
    }

    const raw = await res.text();
    const entry: CachedFile = {
      content: raw.length > maxBytes ? raw.slice(0, maxBytes) : raw,
      totalLines: raw.length === 0 ? 0 : raw.split('\n').length,
      totalBytes: Buffer.byteLength(raw, 'utf8'),
      truncated: raw.length > maxBytes,
    };
    await cacheSet(key, JSON.stringify(entry));
    return { ...base, ok: true, ...entry };
  } catch (e) {
    console.error(`[github] exception fetching ${repo}/${cleanPath}:`, e);
    return miss('network');
  }
}

export async function fetchRepoFile(repo: string, branch: string, path: string): Promise<string | null> {
  const result = await fetchRepoFileResult(repo, branch, path);
  return result.ok ? result.content : null;
}

export async function fetchFile(path: string): Promise<string | null> {
  return fetchRepoFile(KNEAD_REPO, DEFAULT_BRANCH, path);
}

/** Fetch a file from Knead's own repo with the full result envelope. */
export async function fetchKneadFile(path: string, maxBytes?: number): Promise<RepoFileResult> {
  return fetchRepoFileResult(KNEAD_REPO, DEFAULT_BRANCH, path, maxBytes);
}

// ---------- list a directory (any repo) ----------

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export async function listRepoDirectory(repo: string, branch: string, dir: string): Promise<DirEntry[] | null> {
  const cleanDir = dir.replace(/^\/+|\/+$/g, '');
  const key = `dir:${repo}@${branch}:${cleanDir}`;
  const hit = await cacheGet(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as DirEntry[];
    } catch {
      // corrupt cache entry — fall through to a live fetch
    }
  }

  const url = `https://api.github.com/repos/${repo}/contents/${cleanDir}?ref=${branch}`;
  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[github] ${res.status} listing ${repo}/${branch}/${cleanDir}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    const entries: DirEntry[] = data
      .filter((e: any) => e.type === 'file' || e.type === 'dir')
      .map((e: any) => ({ name: e.name, path: e.path, type: e.type }));
    await cacheSet(key, JSON.stringify(entries));
    return entries;
  } catch (e) {
    console.error(`[github] exception listing ${repo}/${dir}:`, e);
    return null;
  }
}

export async function listDirectory(dir: string): Promise<DirEntry[] | null> {
  return listRepoDirectory(KNEAD_REPO, DEFAULT_BRANCH, dir);
}

// ---------- search code (any repo) ----------

interface SearchResult {
  path: string;
  url: string;
}

/**
 * A search that found nothing and a search that never ran look identical in a
 * bare array, and "no results" is exactly the answer that tempts the assistant
 * into writing its own code and calling it repo source. Keep them distinct.
 */
export interface SearchOutcome {
  ok: boolean;
  results: SearchResult[];
  failure?: 'no-token' | 'rate-limited' | 'no-access' | 'network';
}

async function codeSearch(rawQuery: string, repo: string): Promise<SearchOutcome> {
  // GitHub code search requires an authenticated request
  if (!process.env.GITHUB_TOKEN) return { ok: false, results: [], failure: 'no-token' };

  // Search is the most rate-limited GitHub endpoint (~10 req/min), so cache
  // hits matter most here. Only successful responses are cached — a rate-limit
  // failure must not be remembered as "no results" for an hour.
  const cacheKey = `search:${repo}:${rawQuery.toLowerCase()}`;
  const hit = await cacheGet(cacheKey);
  if (hit !== null) {
    try {
      return { ok: true, results: JSON.parse(hit) as SearchResult[] };
    } catch {
      // corrupt cache entry — fall through to a live fetch
    }
  }

  const q = encodeURIComponent(`${rawQuery} repo:${repo}`);
  const url = `https://api.github.com/search/code?q=${q}&per_page=10`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      const failure =
        res.status === 403 || res.status === 429
          ? res.headers.get('x-ratelimit-remaining') === '0'
            ? ('rate-limited' as const)
            : ('no-access' as const)
          : res.status === 401 || res.status === 404
            ? ('no-access' as const)
            : ('network' as const);
      console.error(`[github] search ${res.status} (${failure}) for "${rawQuery}" in ${repo}`);
      return { ok: false, results: [], failure };
    }
    const data = await res.json();
    const results: SearchResult[] = (data.items ?? []).map((item: any) => ({
      path: item.path,
      url: item.html_url,
    }));
    await cacheSet(cacheKey, JSON.stringify(results));
    return { ok: true, results };
  } catch (e) {
    console.error(`[github] search exception for ${repo}:`, e);
    return { ok: false, results: [], failure: 'network' };
  }
}

export async function searchRepoCode(repo: string, query: string): Promise<SearchOutcome> {
  return codeSearch(query, repo);
}

export async function searchRepo(query: string): Promise<SearchOutcome> {
  return codeSearch(query, KNEAD_REPO);
}

export async function searchFilenames(pattern: string): Promise<SearchOutcome> {
  return codeSearch(`filename:${pattern}`, KNEAD_REPO);
}

export async function searchRepoFilenames(repo: string, pattern: string): Promise<SearchOutcome> {
  return codeSearch(`filename:${pattern}`, repo);
}

// ---------- full repo tree (for the system-prompt repository map) ----------

// Excluded from the map: admin surfaces (the assistant must never reference
// them — see rule 14 in the build-chat system prompt), static assets, and
// binary/generated files that aren't useful to teach from.
const TREE_EXCLUDE = /^(app\/admin\/|app\/api\/admin\/|public\/|\.github\/)|\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|otf|mp[34]|pdf|lock)$|(^|\/)\.DS_Store$|^package-lock\.json$/;
const MAX_TREE_CHARS = 30_000;

/**
 * Every exportable path in the Knead repo, sorted, cached for an hour.
 * Returns null when GitHub is unreachable — callers must treat that as "I
 * don't know", never as "the path is invalid".
 */
export async function getRepoPaths(): Promise<string[] | null> {
  const key = `paths:${KNEAD_REPO}@${DEFAULT_BRANCH}`;
  const hit = await cacheGet(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as string[];
    } catch {
      // corrupt cache entry — fall through to a live fetch
    }
  }

  const url = `https://api.github.com/repos/${KNEAD_REPO}/git/trees/${DEFAULT_BRANCH}?recursive=1`;
  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[github] ${res.status} fetching tree for ${KNEAD_REPO}`);
      return null;
    }
    const data = await res.json();
    const paths: string[] = (data.tree ?? [])
      .filter((e: any) => e.type === 'blob' && !TREE_EXCLUDE.test(e.path))
      .map((e: any) => e.path as string)
      .sort();
    await cacheSet(key, JSON.stringify(paths));
    return paths;
  } catch (e) {
    console.error(`[github] exception fetching tree for ${KNEAD_REPO}:`, e);
    return null;
  }
}

/**
 * Full file listing of the Knead repo, newline-separated and sorted. Embedded
 * in the build assistant's system prompt so the model can jump straight to
 * get_source_file with exact paths instead of spending tool rounds on
 * discovery. Returns '' on failure — callers omit the section.
 */
export async function getRepoTree(): Promise<string> {
  const paths = await getRepoPaths();
  if (!paths) return '';

  let tree = paths.join('\n');
  if (tree.length > MAX_TREE_CHARS) {
    tree = tree.slice(0, MAX_TREE_CHARS);
    tree = tree.slice(0, tree.lastIndexOf('\n')) + '\n… (map truncated — use search_repo for anything not listed)';
  }
  return tree;
}

/**
 * Split candidate paths into ones that exist in the repo and ones that don't,
 * so a ZIP proposal never gets built out of guessed paths. Returns null when
 * the tree is unavailable, meaning membership is simply unknown.
 */
export async function classifyRepoPaths(
  candidates: string[],
): Promise<{ known: string[]; unknown: string[] } | null> {
  const paths = await getRepoPaths();
  if (!paths) return null;
  const index = new Set(paths);
  const known: string[] = [];
  const unknown: string[] = [];
  for (const candidate of candidates) {
    (index.has(candidate) ? known : unknown).push(candidate);
  }
  return { known, unknown };
}

// ---------- vendor repos ----------

interface VendorEntry {
  repo: string;
  branch: string;
  description: string;
}

export const VENDOR_REPOS: Record<string, VendorEntry> = {
  thirdweb:      { repo: 'thirdweb-dev/js',               branch: 'main',   description: 'Thirdweb SDK (wallet auth, NFT, smart contracts)' },
  sanity:        { repo: 'sanity-io/sanity',               branch: 'next',   description: 'Sanity CMS core' },
  'next-sanity': { repo: 'sanity-io/next-sanity',          branch: 'main',   description: 'Sanity Next.js integration' },
  stripe:        { repo: 'stripe/stripe-node',             branch: 'master', description: 'Stripe Node.js SDK' },
  mux:           { repo: 'muxinc/mux-node-sdk',            branch: 'main',   description: 'Mux video Node.js SDK' },
  'mux-player':  { repo: 'muxinc/elements',                branch: 'main',   description: 'Mux player web components' },
  daily:         { repo: 'daily-co/daily-js',              branch: 'main',   description: 'Daily.co video calls SDK' },
  'daily-react': { repo: 'daily-co/daily-react',           branch: 'main',   description: 'Daily.co React hooks' },
  supabase:      { repo: 'supabase/supabase-js',           branch: 'master', description: 'Supabase JavaScript client' },
  openai:        { repo: 'openai/openai-node',             branch: 'master', description: 'OpenAI Node.js SDK' },
  towns:         { repo: 'towns-protocol/sdk',             branch: 'main',   description: 'Towns Protocol SDK (E2E encrypted chat)' },
  'key-sharer':  { repo: 'genestjc/server',                branch: 'main',   description: "Knead's headless key-sharer bot for Towns encrypted chat (always-on Render service)" },
  wagmi:         { repo: 'wevm/wagmi',                     branch: 'main',   description: 'Wagmi React hooks for Ethereum' },
  viem:          { repo: 'wevm/viem',                      branch: 'main',   description: 'Viem — low-level Ethereum client' },
};

function resolveVendor(vendor: string): VendorEntry | null {
  return VENDOR_REPOS[vendor.toLowerCase()] ?? null;
}

export async function fetchVendorFile(vendor: string, path: string): Promise<string> {
  const entry = resolveVendor(vendor);
  if (!entry) {
    const known = Object.keys(VENDOR_REPOS).join(', ');
    return `LOOKUP FAILED — unknown vendor "${vendor}". Known vendors: ${known}. You have no file content; do not describe or paste any.`;
  }
  const result = await fetchRepoFileResult(entry.repo, entry.branch, path);
  if (!result.ok) {
    return [
      `LOOKUP FAILED — nothing was returned for "${path}" in ${entry.repo}.`,
      'Try list_vendor_directory or search_vendor_repo to find the right path.',
      'You have NO content for this file. Do not paste code and present it as this vendor\'s source.',
    ].join('\n');
  }
  return renderVerbatimSource({
    label: `${entry.repo} (${entry.description})`,
    result,
  });
}

// ---------- verbatim rendering ----------

/**
 * Wrap fetched source in unambiguous markers before it reaches a model.
 *
 * The failure mode this exists to stop: the assistant fetches a file, then
 * writes its own simplified version and tells the user it is "the real file
 * straight from the repo". Fenced markers give it one unmistakable thing to
 * copy, and a header stating what it actually holds.
 */
export const VERBATIM_OPEN = '===== BEGIN VERBATIM SOURCE =====';
export const VERBATIM_CLOSE = '===== END VERBATIM SOURCE =====';

export function renderVerbatimSource(opts: {
  label: string;
  result: RepoFileResult;
  /** 1-indexed inclusive window actually shown, when a slice was requested. */
  window?: { from: number; to: number };
  body?: string;
}): string {
  const { label, result, window } = opts;
  // Path rules decide which files may be read; this decides what may be in
  // them. A credential committed by accident into an otherwise-teachable file
  // would otherwise reach the model — and the model is told to paste this text
  // to the user character for character.
  const { clean: body, findings } = redactSecrets(opts.body ?? result.content);
  if (findings.length > 0) {
    console.error(
      `[secret-scan] redacted ${findings.join(', ')} from ${result.repo}@${result.branch}:${result.path}`,
    );
  }
  const shown = window
    ? `lines ${window.from}–${window.to} of ${result.totalLines}`
    : result.truncated
      ? `the first ${body.split('\n').length} of ${result.totalLines} lines`
      : `all ${result.totalLines} lines`;

  return [
    `SOURCE FETCHED — ${label}: ${result.path} (${shown})`,
    `Permalink: ${repoFileUrl(result.repo, result.branch, result.path)}`,
    'The text between the markers below is this file exactly as it exists in the repository.',
    'If you tell the user you are showing them the real file, the code in your reply must be copied from between these markers, character for character, inside a fenced code block. A contiguous excerpt is fine. A rewrite, a summary, or a simplified version is not — and must never be described as the repo\'s code.',
    VERBATIM_OPEN,
    body,
    VERBATIM_CLOSE,
    result.truncated && !window
      ? `NOTE: this file is ${result.totalLines} lines and was cut off at ${body.split('\n').length}. Say so if you show it, and use start_line/end_line to read a later section.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function listVendorDirectory(vendor: string, dir: string): Promise<DirEntry[] | null> {
  const entry = resolveVendor(vendor);
  if (!entry) return null;
  return listRepoDirectory(entry.repo, entry.branch, dir);
}

export async function searchVendorRepo(vendor: string, query: string): Promise<SearchOutcome> {
  const entry = resolveVendor(vendor);
  if (!entry) return { ok: false, results: [], failure: 'no-access' };
  return codeSearch(query, entry.repo);
}
