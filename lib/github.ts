// GitHub API utilities for Demeter
// All calls go through the GitHub Contents API so token auth works on private repos.

const REPO = process.env.KNEAD_GITHUB_REPO ?? 'kneadmag/knead';
const BRANCH = process.env.KNEAD_GITHUB_BRANCH ?? 'main';
const MAX_FILE_BYTES = 10_000;

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// ---------- fetch a single file ----------

export async function fetchFile(path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github.raw+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[github] ${res.status} fetching ${path}`);
      return null;
    }
    const text = await res.text();
    return text.length > MAX_FILE_BYTES
      ? text.slice(0, MAX_FILE_BYTES) + '\n// ... (truncated)'
      : text;
  } catch (e) {
    console.error(`[github] exception fetching ${path}:`, e);
    return null;
  }
}

// ---------- list a directory ----------

interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
}

export async function listDirectory(dir: string): Promise<DirEntry[] | null> {
  const url = `https://api.github.com/repos/${REPO}/contents/${dir}?ref=${BRANCH}`;
  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[github] ${res.status} listing ${dir}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data
      .filter((e: any) => e.type === 'file' || e.type === 'dir')
      .map((e: any) => ({ name: e.name, path: e.path, type: e.type }));
  } catch (e) {
    console.error(`[github] exception listing ${dir}:`, e);
    return null;
  }
}

// ---------- search the repo via GitHub code search API ----------

interface SearchResult {
  path: string;
  url: string;
}

export async function searchRepo(query: string): Promise<SearchResult[]> {
  // GitHub code search requires auth for private repos
  if (!process.env.GITHUB_TOKEN) return [];

  const q = encodeURIComponent(`${query} repo:${REPO}`);
  const url = `https://api.github.com/search/code?q=${q}&per_page=10`;
  try {
    const res = await fetch(url, {
      headers: {
        ...headers(),
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      console.error(`[github] search ${res.status} for: ${query}`);
      return [];
    }
    const data = await res.json();
    return (data.items ?? []).map((item: any) => ({
      path: item.path,
      url: item.html_url,
    }));
  } catch (e) {
    console.error(`[github] search exception:`, e);
    return [];
  }
}

// ---------- search filenames by pattern ----------

export async function searchFilenames(pattern: string): Promise<SearchResult[]> {
  if (!process.env.GITHUB_TOKEN) return [];

  const q = encodeURIComponent(`filename:${pattern} repo:${REPO}`);
  const url = `https://api.github.com/search/code?q=${q}&per_page=10`;
  try {
    const res = await fetch(url, {
      headers: {
        ...headers(),
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      console.error(`[github] filename search ${res.status} for: ${pattern}`);
      return [];
    }
    const data = await res.json();
    return (data.items ?? []).map((item: any) => ({
      path: item.path,
      url: item.html_url,
    }));
  } catch (e) {
    console.error(`[github] filename search exception:`, e);
    return [];
  }
}

// ---------- get a vendor file ----------

const VENDOR_REPOS: Record<string, { repo: string; branch: string; description: string }> = {
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

export async function fetchVendorFile(vendor: string, path: string): Promise<string> {
  const entry = VENDOR_REPOS[vendor.toLowerCase()];
  if (!entry) {
    const known = Object.keys(VENDOR_REPOS).join(', ');
    return `// Unknown vendor "${vendor}". Known vendors: ${known}`;
  }
  const url = `https://api.github.com/repos/${entry.repo}/contents/${path}?ref=${entry.branch}`;
  try {
    const res = await fetch(url, {
      headers: { ...headers(), Accept: 'application/vnd.github.raw+json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[github] vendor ${res.status} fetching ${entry.repo}/${path}`);
      return `// File not found in ${entry.repo}: ${path}`;
    }
    const text = await res.text();
    const truncated = text.length > MAX_FILE_BYTES
      ? text.slice(0, MAX_FILE_BYTES) + '\n// ... (truncated)'
      : text;
    return `// Source: github.com/${entry.repo} (${entry.description})\n\n${truncated}`;
  } catch (e) {
    console.error(`[github] vendor exception for ${entry.repo}/${path}:`, e);
    return `// Could not fetch from ${entry.repo}`;
  }
}

export { VENDOR_REPOS };
