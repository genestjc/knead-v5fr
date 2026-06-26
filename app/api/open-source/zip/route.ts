import { NextRequest, NextResponse } from 'next/server';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflateRaw = promisify(zlib.deflateRaw);

const GITHUB_REPO = process.env.KNEAD_GITHUB_REPO ?? 'kneadmag/knead';
const GITHUB_BRANCH = process.env.KNEAD_GITHUB_BRANCH ?? 'main';

interface ZipFile {
  path: string;
  source: 'repo' | 'generated';
  content?: string;
}

// ---------- minimal ZIP builder (no external deps) ----------

function crc32(buf: Buffer): number {
  const table = makeCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: number[] | null = null;
function makeCrc32Table(): number[] {
  if (_crcTable) return _crcTable;
  _crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    _crcTable[n] = c;
  }
  return _crcTable;
}

function writeUInt16LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function writeUInt32LE(n: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(n, 0);
  return b;
}

async function buildZip(files: { name: string; content: Buffer }[]): Promise<Buffer> {
  const localHeaders: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const compressed = await deflateRaw(file.content);
    const crc = crc32(file.content);

    // Local file header
    const local = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUInt16LE(20),                       // version needed
      writeUInt16LE(0),                        // general purpose bits
      writeUInt16LE(8),                        // compression: deflate
      writeUInt16LE(0),                        // mod time
      writeUInt16LE(0),                        // mod date
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(file.content.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),                        // extra length
      name,
      compressed,
    ]);

    // Central directory entry
    const central = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUInt16LE(20),                       // version made by
      writeUInt16LE(20),                       // version needed
      writeUInt16LE(0),
      writeUInt16LE(8),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(crc),
      writeUInt32LE(compressed.length),
      writeUInt32LE(file.content.length),
      writeUInt16LE(name.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      name,
    ]);

    localHeaders.push(local);
    centralDir.push(central);
    offset += local.length;
  }

  const centralDirBuf = Buffer.concat(centralDir);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]), // end of central dir signature
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(files.length),
    writeUInt16LE(files.length),
    writeUInt32LE(centralDirBuf.length),
    writeUInt32LE(offset),
    writeUInt16LE(0),
  ]);

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}

// ---------- route ----------

async function fetchRepoFile(path: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
  try {
    const res = await fetch(url, {
      headers: process.env.GITHUB_TOKEN
        ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
        : {},
    });
    if (!res.ok) return `// File not found in repo: ${path}\n`;
    return await res.text();
  } catch {
    return `// Could not fetch ${path}\n`;
  }
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

# OpenAI — https://platform.openai.com/api-keys
OPENAI_API_KEY=

# Mux — https://dashboard.mux.com/settings/access-tokens
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# Daily.co — https://dashboard.daily.co/developers
DAILY_API_KEY=

# Towns Protocol — https://docs.towns.com
NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=
NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=
KEY_SHARER_PRIVATE_KEY=

# NFT contract on Base (deploy your own or fork Knead's)
NEXT_PUBLIC_NFT_CONTRACT_ADDRESS=

# Base RPC
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
`;

export async function POST(req: NextRequest) {
  try {
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

    const repoFiles = files.filter((f) => f.source === 'repo').slice(0, 20);
    const generatedFiles = files.filter((f) => f.source === 'generated').slice(0, 10);

    const repoContents = await Promise.all(repoFiles.map((f) => fetchRepoFile(f.path)));

    for (let i = 0; i < repoFiles.length; i++) {
      resolvedFiles.push({
        name: repoFiles[i].path,
        content: Buffer.from(repoContents[i], 'utf8'),
      });
    }

    for (const gf of generatedFiles) {
      resolvedFiles.push({
        name: gf.path,
        content: Buffer.from(gf.content ?? '', 'utf8'),
      });
    }

    // Always include README and .env.example
    resolvedFiles.push({
      name: 'README.md',
      content: Buffer.from(setupInstructions || '# Knead Starter Kit\n\nSee .env.example for configuration.', 'utf8'),
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
      },
    });
  } catch (err: any) {
    console.error('[build/zip] error:', err.message);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }
}
