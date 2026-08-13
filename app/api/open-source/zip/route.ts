import { NextRequest, NextResponse } from 'next/server';
import { readMemberSession, verifyMemberRequest } from '@/lib/auth/member-session';
import { isOpenSourceRequestAuthorized } from '@/lib/open-source-auth';
import {
  buildStarterReadme,
  isExportBlockedPath,
  isSecretEnvFile,
} from '@/lib/open-source-starter-kit';
import { buildZip } from '@/lib/zip';
import { redactAndLog } from '@/lib/secret-scan';
import { fetchKneadFile, FULL_MAX_FILE_BYTES, KNEAD_BRANCH, KNEAD_REPO } from '@/lib/github';

// The repo, branch and auth all come from lib/github.ts so this route and the
// chat assistant can never disagree about where Knead's source lives. They
// used to: this route defaulted to a repo that does not exist and read through
// raw.githubusercontent.com, so with no env override every "repo" file in a
// starter kit came back as a "file not found" comment stub.
const GITHUB_REPO = KNEAD_REPO;
const GITHUB_BRANCH = KNEAD_BRANCH;

interface ZipFile {
  path: string;
  source: 'repo' | 'generated';
  content?: string;
}

const MAX_REPO_FILES = 20;
const MAX_GENERATED_FILES = 10;
const MAX_GENERATED_FILE_BYTES = 200_000;

function normalizeZipPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const normalized = path.trim().replace(/^\/+/, '');
  if (!normalized || normalized.length > 220) return null;
  if (normalized.includes('\0') || normalized.includes('\\') || normalized.includes('..')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) return null;
  if (normalized.endsWith('/')) return null;
  if (!/^[A-Za-z0-9._@/-]+$/.test(normalized)) return null;
  return normalized;
}

async function hasZipAccess(req: NextRequest): Promise<boolean> {
  if (isOpenSourceRequestAuthorized(req)) return true;
  if (req.headers.get('x-wallet-address')) {
    const auth = await verifyMemberRequest(req);
    return Boolean(auth.ok);
  }
  const session = readMemberSession(req);
  if (session.ok) return true;
  const auth = await verifyMemberRequest(req);
  return Boolean(auth.ok);
}

// ---------- route ----------

/**
 * Pull one repo file for the bundle. Returns null when it can't be had —
 * a starter kit full of `// File not found` comments looks like working code
 * and wastes a beginner's afternoon, so a file we can't pull is left out and
 * named in the README instead.
 */
async function fetchStarterFile(path: string): Promise<string | null> {
  const result = await fetchKneadFile(path, FULL_MAX_FILE_BYTES);
  if (!result.ok) return null;
  // Truncated means the file is larger than FULL_MAX_FILE_BYTES; half a source
  // file is worse than none, because it still parses as a plausible start.
  if (result.truncated) {
    console.error(`[open-source/zip] ${path} exceeds ${FULL_MAX_FILE_BYTES} bytes; omitting`);
    return null;
  }
  return result.content;
}

const ENV_EXAMPLE = `# Copy this file to .env.local and fill in your values
# Get these from your vendor dashboards

# Thirdweb — https://thirdweb.com/dashboard
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=
THIRDWEB_SECRET_KEY=

# Sanity — https://www.sanity.io/manage
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=

# Stripe — https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Supabase — https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (Claude — editorial text + build assistant) — https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=

# OpenAI (GPT-5.6 chat agent + fallback, TTS, moderation) — https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Mux — https://dashboard.mux.com/settings/access-tokens
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# Daily.co — https://dashboard.daily.co/developers
DAILY_API_KEY=

# Towns Protocol — https://docs.towns.com
# (generic names for your own project — Knead's internal ones differ)
NEXT_PUBLIC_TOWNS_SPACE_ID=
NEXT_PUBLIC_TOWNS_DEFAULT_CHANNEL_ID=
KEY_SHARER_PRIVATE_KEY=

# NFT contract on Base (deploy your own or fork Knead's)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=

# Base RPC
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
`;

export async function POST(req: NextRequest) {
  try {
    if (!(await hasZipAccess(req))) {
      return NextResponse.json(
        { error: 'Connect your wallet or unlock the open-source builder before downloading a ZIP' },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body?.files || !Array.isArray(body.files)) {
      return NextResponse.json({ error: 'Missing files array' }, { status: 400 });
    }

    const { files, setupInstructions = '' } = body as {
      files: ZipFile[];
      setupInstructions: string;
    };

    // Fetch repo files in parallel (max 20 to keep response fast)
    const resolvedFiles: { name: string; content: Buffer }[] = [];

    const repoFiles: ZipFile[] = [];
    const generatedFiles: ZipFile[] = [];

    // One malformed entry used to fail the whole download, so a single odd
    // path from the model cost the builder their entire starter kit. Bad
    // entries are dropped and the rest is still packaged; only a proposal with
    // nothing usable left in it is rejected outright.
    for (const file of files) {
      const path = normalizeZipPath(file?.path);
      if (!path) continue;

      // Be forgiving about `source`: the assistant occasionally sends a
      // near-miss value, and the intent is unambiguous from whether it also
      // supplied content.
      const source: 'repo' | 'generated' =
        file?.source === 'repo' || file?.source === 'generated'
          ? file.source
          : typeof file?.content === 'string' && file.content.trim().length > 0
            ? 'generated'
            : 'repo';

      if (source === 'repo') {
        if (isExportBlockedPath(path)) continue;
        if (repoFiles.length < MAX_REPO_FILES) repoFiles.push({ ...file, path, source });
        continue;
      }

      const content = file.content ?? '';
      if (isSecretEnvFile(path) || Buffer.byteLength(content, 'utf8') > MAX_GENERATED_FILE_BYTES) continue;
      if (generatedFiles.length < MAX_GENERATED_FILES) {
        generatedFiles.push({ ...file, path, content, source });
      }
    }

    if (repoFiles.length === 0 && generatedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No usable files were listed for this starter kit — ask Demeter to pick the files again.' },
        { status: 400 },
      );
    }

    const repoContents = await Promise.all(repoFiles.map((f) => fetchStarterFile(f.path)));

    const included: { path: string; source: 'repo' | 'generated'; content: string }[] = [];
    const missing: string[] = [];

    for (let i = 0; i < repoFiles.length; i++) {
      const content = repoContents[i];
      if (content === null) {
        missing.push(repoFiles[i].path);
        continue;
      }
      included.push({ path: repoFiles[i].path, source: 'repo', content });
    }

    // Every repo file failed: the kit would be nothing but the README and an
    // env template. Say so plainly rather than handing over an empty bundle
    // that looks like it worked.
    if (repoFiles.length > 0 && included.length === 0) {
      console.error(`[open-source/zip] every repo lookup failed for ${GITHUB_REPO}@${GITHUB_BRANCH}`);
      return NextResponse.json(
        {
          error: `Couldn't pull any of those files from ${GITHUB_REPO}. Nothing was packaged — ask Demeter to try different files, or grab them from github.com/${GITHUB_REPO} directly.`,
        },
        { status: 502 },
      );
    }

    for (const gf of generatedFiles) {
      included.push({ path: gf.path, source: 'generated', content: gf.content ?? '' });
    }

    // Scan on the way out, not just on the way in: the path rules above decide
    // WHICH files ship, and this decides what may be inside them. Covers both
    // repo files and anything the model wrote into a generated file.
    for (const file of included) {
      file.content = redactAndLog(file.content, `starter kit: ${file.path}`);
      resolvedFiles.push({ name: file.path, content: Buffer.from(file.content, 'utf8') });
    }

    // Always include README and .env.example. The README is assembled here
    // rather than taken verbatim, so the deploy walkthrough is present even
    // when the assistant's own instructions arrived thin or empty.
    resolvedFiles.push({
      name: 'README.md',
      content: Buffer.from(
        buildStarterReadme({
          included,
          missing,
          setupInstructions,
          repo: GITHUB_REPO,
          branch: GITHUB_BRANCH,
        }),
        'utf8',
      ),
    });
    resolvedFiles.push({
      name: '.env.example',
      content: Buffer.from(ENV_EXAMPLE, 'utf8'),
    });

    const zip = await buildZip(resolvedFiles);

    return new NextResponse(zip, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="knead-starter.zip"',
        'Content-Length': String(zip.length),
        // Lets the client tell a full bundle from a partial one without
        // unzipping, and makes a bad deploy debuggable from the network tab.
        'X-Knead-Zip-Files': String(resolvedFiles.length),
        'X-Knead-Zip-Missing': String(missing.length),
      },
    });
  } catch (err: any) {
    console.error('[open-source/zip] error:', err.message);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }
}
