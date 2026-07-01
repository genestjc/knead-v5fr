// GitHub API utilities for Demeter
// All calls go through the GitHub Contents/Search API so token auth works on private repos.
// Functions accept an explicit repo/branch so they work equally well against
// Knead's own repo and any vendor SDK repo Demeter needs to explore.

export const KNEAD_REPO = process.env.KNEAD_GITHUB_REPO ?? 'genestjc/knead-v5fr';
const DEFAULT_BRANCH = process.env.KNEAD_GITHUB_BRANCH ?? 'main';
const MAX_FILE_BYTES = 10_000;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// ---------- fetch a single file (any repo) ----------

export async function fetchRepoFile(repo: string, branch: string, path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github.raw+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[github] ${res.status} fetching ${repo}/${branch}/${path}`);
      return null;
    }
    const text = await res.text();
    return text.length > MAX_FILE_BYTES
      ? text.slice(0, MAX_FILE_BYTES) + '\n// ... (truncated)'
      : text;
  } catch (e) {
    console.error(`[github] exception fetching ${repo}/${path}:`, e);
    return null;
  }
}

export async function fetchFile(path: string): Promise<string | null> {
  return fetchRepoFile(KNEAD_REPO, DEFAULT_BRANCH, path);
}

// ---------- list a directory (any repo) ----------

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export async function listRepoDirectory(repo: string, branch: string, dir: string): Promise<DirEntry[] | null> {
  const cleanDir = dir.replace(/^\/+|\/+$/g, '');
  const url = `https://api.github.com/repos/${repo}/contents/${cleanDir}?ref=${branch}`;
  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[github] ${res.status} listing ${repo}/${branch}/${cleanDir}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data
      .filter((e: any) => e.type === 'file' || e.type === 'dir')
      .map((e: any) => ({ name: e.name, path: e.path, type: e.type }));
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

async function codeSearch(rawQuery: string, repo: string): Promise<SearchResult[]> {
  // GitHub code search requires an authenticated request
  if (!process.env.GITHUB_TOKEN) return [];

  const q = encodeURIComponent(`${rawQuery} repo:${repo}`);
  const url = `https://api.github.com/search/code?q=${q}&per_page=10`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      console.error(`[github] search ${res.status} for "${rawQuery}" in ${repo}`);
      return [];
    }
    const data = await res.json();
    return (data.items ?? []).map((item: any) => ({
      path: item.path,
      url: item.html_url,
    }));
  } catch (e) {
    console.error(`[github] search exception for ${repo}:`, e);
    return [];
  }
}

export async function searchRepoCode(repo: string, query: string): Promise<SearchResult[]> {
  return codeSearch(query, repo);
}

export async function searchRepo(query: string): Promise<SearchResult[]> {
  return codeSearch(query, KNEAD_REPO);
}

export async function searchFilenames(pattern: string): Promise<SearchResult[]> {
  return codeSearch(`filename:${pattern}`, KNEAD_REPO);
}

export async function searchRepoFilenames(repo: string, pattern: string): Promise<SearchResult[]> {
  return codeSearch(`filename:${pattern}`, repo);
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
    return `// Unknown vendor "${vendor}". Known vendors: ${known}`;
  }
  const text = await fetchRepoFile(entry.repo, entry.branch, path);
  if (!text) {
    return `// File not found in ${entry.repo}: ${path}. Try list_vendor_directory or search_vendor_repo to find the right path.`;
  }
  return `// Source: github.com/${entry.repo} (${entry.description})\n\n${text}`;
}

export async function listVendorDirectory(vendor: string, dir: string): Promise<DirEntry[] | null> {
  const entry = resolveVendor(vendor);
  if (!entry) return null;
  return listRepoDirectory(entry.repo, entry.branch, dir);
}

export async function searchVendorRepo(vendor: string, query: string): Promise<SearchResult[]> {
  const entry = resolveVendor(vendor);
  if (!entry) return [];
  return codeSearch(query, entry.repo);
}
