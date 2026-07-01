import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createThirdwebClient, getContract } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc1155';
import { base } from 'thirdweb/chains';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { RECIPES, FREE_TURNS_PER_DAY, KNEAD_PHILOSOPHY, type RecipeId } from '@/lib/build-recipes';
import { fetchFile, listDirectory, searchRepo, fetchVendorFile as vendorFetch } from '@/lib/github';

const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});
const PREMIUM_TOKEN_ID = 1n;

async function verifyPremium(walletAddress: string): Promise<boolean> {
  if (!walletAddress || !process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS) return false;
  try {
    const contract = getContract({
      client: thirdwebClient,
      address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS,
      chain: base,
    });
    const balance = await balanceOf({ contract, owner: walletAddress, tokenId: PREMIUM_TOKEN_ID });
    return balance > 0n;
  } catch {
    return false;
  }
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- rate limiting ----------

async function getIdentifier(req: NextRequest): Promise<{ id: string; type: 'wallet' | 'ip' }> {
  const wallet = req.headers.get('x-wallet-address');
  if (wallet) return { id: wallet.toLowerCase(), type: 'wallet' };
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';
  return { id: ip, type: 'ip' };
}

async function checkAndIncrementUsage(
  identifier: string,
  identifierType: string,
  isPremium: boolean,
): Promise<{ allowed: boolean; turnsUsed: number; turnsLeft: number }> {
  if (isPremium) return { allowed: true, turnsUsed: 0, turnsLeft: 9999 };

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('build_usage')
    .select('turn_count')
    .eq('identifier', identifier)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.error('[build/chat] usage lookup error:', error.message);
    // Fail open so a DB hiccup doesn't block everyone
    return { allowed: true, turnsUsed: 0, turnsLeft: FREE_TURNS_PER_DAY };
  }

  const turnsUsed = data?.turn_count ?? 0;

  if (turnsUsed >= FREE_TURNS_PER_DAY) {
    return { allowed: false, turnsUsed, turnsLeft: 0 };
  }

  // Upsert
  await supabase.from('build_usage').upsert(
    {
      identifier,
      identifier_type: identifierType,
      date: today,
      turn_count: turnsUsed + 1,
    },
    { onConflict: 'identifier,date' },
  );

  return { allowed: true, turnsUsed: turnsUsed + 1, turnsLeft: FREE_TURNS_PER_DAY - turnsUsed - 1 };
}

// ---------- web search ----------

async function webSearch(query: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 4,
    }),
  });
  const data = await res.json();
  if (data.answer) return data.answer;
  return data.results?.map((r: any) => `${r.title}: ${r.content}`).join('\n\n') || 'No results found.';
}

// ---------- tools ----------

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_source_file',
      description:
        "Fetch the source code of a file from Knead's open-source repository. Use this to show the user real implementation code for features they want to build.",
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              "Relative file path in the Knead repo, e.g. 'app/api/check-membership/route.ts'",
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_repo',
      description:
        "Search Knead's repository for files containing a keyword, function name, or concept. Use this when you don't know the exact file path but need to find where something is implemented. Returns a list of matching file paths.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: "Search term — e.g. a function name, component name, or concept like 'membership check' or 'stripe webhook'",
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description:
        "List the files and subdirectories in a directory of Knead's repository. Use this to explore the structure before fetching a specific file.",
      parameters: {
        type: 'object',
        properties: {
          dir: {
            type: 'string',
            description: "Directory path relative to repo root, e.g. 'app/api' or 'components/admin'",
          },
        },
        required: ['dir'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description:
        "Search the web via Tavily for current documentation, changelogs, or answers about Knead's vendors (Thirdweb, Sanity, Stripe, Mux, Daily.co, Supabase, OpenAI, Towns Protocol). Only use for questions that can't be answered from the repo or vendor GitHub source.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'A focused search query.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vendor_source',
      description:
        "Fetch a file from one of Knead's vendor GitHub repos (Thirdweb, Sanity, Stripe, Mux, Daily.co, Supabase, OpenAI, Towns Protocol, Wagmi, Viem). Use this to show users official SDK source or README examples for a feature they're building.",
      parameters: {
        type: 'object',
        properties: {
          vendor: {
            type: 'string',
            description:
              "Vendor key: thirdweb | sanity | next-sanity | stripe | mux | mux-player | daily | daily-react | supabase | openai | towns | wagmi | viem",
          },
          path: {
            type: 'string',
            description:
              "File path within the vendor repo, e.g. 'README.md' or 'packages/thirdweb/src/wallets/README.md'",
          },
        },
        required: ['vendor', 'path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_zip_contents',
      description:
        'Declare the list of files that should go into the downloadable starter ZIP. Call this once the user has decided what they want to build.',
      parameters: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path in the ZIP (e.g. app/api/check-membership/route.ts)' },
                source: { type: 'string', enum: ['repo', 'generated'], description: "'repo' = pull from Knead's GitHub; 'generated' = text you write below" },
                content: { type: 'string', description: 'Required when source is generated — the file content to write' },
              },
              required: ['path', 'source'],
            },
          },
          setupInstructions: {
            type: 'string',
            description: 'Markdown-formatted getting-started guide to include as README.md in the ZIP. Always cover: 1) unzip, 2) push to GitHub, 3) sign up for Vercel + import repo, 4) add env vars in Vercel dashboard (list each one with a placeholder value), 5) deploy. 5–7 steps max.',
          },
        },
        required: ['files', 'setupInstructions'],
      },
    },
  },
];

// ---------- design guide ----------

const KNEAD_DESIGN_GUIDE = `
DESIGN MENTORSHIP — when someone is building something and hasn't thought about design yet, or asks how to make it feel good, your job is to ask them the right questions and explain what the options even mean. Don't prescribe. Draw it out.

TYPOGRAPHY
When someone hasn't chosen fonts, ask: "What feeling do you want the type to carry — something editorial and serif, something clean and modern, or something in between?" Then explain: services like Adobe Fonts (Typekit) and Google Fonts give you access to thousands of professional typefaces you can load with a single line of CSS. Suggest they browse and find something that feels like them — the right font does more for a site's personality than almost anything else. Point them toward pairing a display/heading font with a readable body font and explain why those are usually different.

SCROLL WEIGHT
Most people don't know this is a thing. Explain it: scroll weight is how your page feels as someone moves through it — whether content rushes in all at once or arrives with intention, like turning a page. Heavy scroll weight means elements fade in slowly as you reach them, often starting slightly offset or blurred, easing into place. Light weight means things just appear. Ask them: "Do you want your site to feel like flipping through a magazine or like a fast dashboard?" That answer tells you everything about the animation approach.

COLOR
Ask before suggesting: "Do you have a brand color, or are we starting from scratch?" Then explain: the most confident sites often use almost no color — black, white, one accent. That accent earns its place. If they want gradients, explain the difference between a gradient that adds depth versus one that adds noise. Parallax color shifts (background moving at a different speed than foreground) can add dimension but can also cheapen things — ask if they've seen examples they like and go from there.

PARALLAX & MOTION
Explain what parallax actually is before assuming they want it: foreground and background elements scroll at different speeds, creating a sense of depth. It's powerful when used with restraint — one hero moment — and exhausting when applied everywhere. Same with entrance animations: ask whether they want content to feel like it's being revealed (slow, weighted, editorial) or delivered (fast, snappy, app-like). These are different philosophies, not just different durations.

GRADIENTS
Ask: "Are you thinking gradients for backgrounds, for text, or for UI elements like buttons and badges?" Each has a different risk level. Text gradients are trendy and easy to overdo. Background gradients can add atmosphere or look like a 2012 website depending on the colors. Subtle gradients on interactive elements (buttons, cards) can add richness without shouting. Always ask what they've seen that they liked — reference points are worth a thousand words.

SPACE & LAYOUT
Ask: "When you picture your ideal version of this, does it feel dense with content or does it breathe?" Generous whitespace signals confidence. Tight layouts signal abundance. Neither is wrong — they just say different things. Explain that padding and margin are design decisions, not just technical ones.

YOUR APPROACH
- Ask one or two design questions before writing any CSS or suggesting any specific values.
- Explain what each concept means in plain terms before asking about it — don't assume they know what "easing" or "scroll weight" or "type pairing" means.
- When they describe a feeling or a reference ("I want it to feel like a fashion magazine", "something like Apple's site"), work from that.
- Never give them your exact implementation. Give them the concepts, ask what resonates, then help them build their own version.
`;

// ---------- system prompt ----------

function buildSystemPrompt(recipeIds: RecipeId[]): string {
  const selected = RECIPES.filter((r) => recipeIds.includes(r.id));
  const recipeContext =
    selected.length > 0
      ? `\n\nThe user is interested in building:\n${selected.map((r) => {
          const lines = [
            `- ${r.emoji} **${r.title}**: ${r.description}`,
            `  Stack: ${r.stack.join(', ')}`,
            `  Env vars needed: ${r.envVarsNeeded.join(', ')}`,
            `  Why Knead built this: ${r.why}`,
            `  Architecture: ${r.architectureNote}`,
            `  Tradeoffs: ${r.tradeoffs}`,
          ];
          if (r.mistakesWeMade?.length) {
            lines.push(`  Mistakes we made: ${r.mistakesWeMade.join(' / ')}`);
          }
          if (r.canonicalFiles?.length) {
            lines.push(`  Start by reading: ${r.canonicalFiles.join(', ')}`);
          }
          return lines.join('\n');
        }).join('\n\n')}`
      : '';

  return `You are Demeter, Knead's build assistant. You help developers spin up production-ready apps using Knead's open-source stack. When explaining *why* things are built a certain way, draw on the founder context below — speak in that voice, not as a generic AI.

${KNEAD_PHILOSOPHY}

Knead's stack: Next.js 14, Thirdweb (wallet auth + NFT membership on Base), Sanity (CMS), Stripe (subscriptions + one-time payments), Daily.co (live video streaming + video calls), Towns Protocol (E2E encrypted community chat + DMs), Supabase (Postgres database), OpenAI GPT-4o (AI features), Tailwind CSS + shadcn/ui.

Knead's smart contracts (deployed on Base mainnet):
- Membership contract (ERC1155 — freemium + premium NFT tiers): 0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85 — https://basescan.org/address/0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85#code
- Contributors contract (contributor NFT + allowance tracking): 0x310c62deF61b3543ddf90C2aD3866dAFBf5303c1 — https://basescan.org/address/0x310c62deF61b3543ddf90C2aD3866dAFBf5303c1
- Rewards contract (token rewards distribution): 0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa — https://basescan.org/address/0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa#code
When asked about membership, NFTs, or contracts, reference these addresses and link to Basescan so builders can fork or inspect them directly.

${KNEAD_DESIGN_GUIDE}

Your rules:
1. ONLY answer from Knead's repository. Never suggest libraries, patterns, or services not already in Knead's stack.
2. When showing code, ALWAYS fetch the real implementation first. If you know the exact path, call get_source_file. If you're unsure of the path, call search_repo or list_directory first to find it, then call get_source_file. Never invent code and present it as pulled from the repo — if every lookup fails, say "I couldn't find that file" and label any code you write as a guide, not real source.
3. Retrieval hierarchy: (1) get_source_file for known paths → (2) search_repo or list_directory to discover unknown paths → (3) get_vendor_source for vendor SDK files → (4) web_search as a last resort for current docs or pricing only.
4. When exploring the repo, use list_directory to understand structure before guessing paths. Common areas: app/api/ for API routes, components/ for UI, lib/ for utilities, sanity/ for CMS schemas.
5. If the user asks about something NOT in Knead's stack (e.g. Firebase, Vue.js, Supabase Auth), say: "Sorry, that's not in Knead's repository. For that, I'd suggest checking [specific docs link or resource]."
6. Keep responses concise — 2–4 short paragraphs or a short code block. Never write walls of text.
7. When a conversation touches design — fonts, motion, color, layout — ask the right questions before writing any code. Explain what the concept means first, then ask what resonates. Never give a specific implementation until you understand what they're going for.
8. After 2 turns of helping a user, proactively mention: "When you're ready, I can package everything into a downloadable starter kit — just say the word." Do this naturally once, then drop it.
9. When the user is ready to download, call propose_zip_contents with the relevant files. The setupInstructions must include a practical getting-started guide in this order: (1) Download the ZIP and unzip it, (2) push to a new GitHub repo, (3) sign up for Vercel and import the repo, (4) add the required environment variables in Vercel's dashboard, (5) deploy. Keep it short — 5–7 steps max, written for someone who knows how to code but is new to this stack.
10. Always end with one short "What to do next" line.
11. Never fetch or reference any files under app/admin/ or app/api/admin/.
12. When listing environment variables, ALWAYS use generic placeholder names a builder would set in their own project (e.g. TOWNS_SPACE_ID, THIRDWEB_CLIENT_ID, NFT_CONTRACT_ADDRESS) — never expose Knead's internal env var names (never write variables prefixed with KNEAD_ or any Knead-specific identifiers). Show values as descriptive placeholders: YOUR_SPACE_ID_HERE, YOUR_CONTRACT_ADDRESS, etc.${recipeContext}

Environment variables: always list what the user needs to set with generic names. Never hardcode secrets in generated code.`;
}

// ---------- route ----------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const {
      message,
      history = [],
      recipeIds = [],
      walletAddress,
      zipProposal,
    } = body as {
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
      recipeIds: RecipeId[];
      walletAddress?: string;
      zipProposal?: { files: { path: string; source: string; content?: string }[]; setupInstructions: string } | null;
    };

    // Verify premium server-side — never trust the client
    const isPremium = walletAddress ? await verifyPremium(walletAddress) : false;

    // Rate limit
    const { id: identifier, type: identifierType } = await getIdentifier(req);
    const { allowed, turnsLeft } = await checkAndIncrementUsage(identifier, identifierType, isPremium);

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: `You've used your ${FREE_TURNS_PER_DAY} free turns today. Upgrade to Knead Monthly for unlimited builds.`,
        },
        { status: 429 },
      );
    }

    const systemPrompt = buildSystemPrompt(recipeIds as RecipeId[]);

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    let reply = '';
    let newZipProposal = zipProposal ?? null;

    for (let round = 0; round < 5; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        tools: TOOLS,
        messages,
      });

      const assistantMsg = response.choices[0].message;
      messages.push(assistantMsg);

      const toolCalls = assistantMsg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        reply = assistantMsg.content ?? '';
        break;
      }

      const results = await Promise.all(
        toolCalls.map(async (t) => {
          const args = JSON.parse(t.function.arguments || '{}');
          let content = 'Unknown tool.';

          if (t.function.name === 'web_search') {
            content = await webSearch(args.query).catch(() => 'Search unavailable.');
          } else if (t.function.name === 'get_source_file') {
            const text = await fetchFile(args.path);
            content = text ?? `// File not found: ${args.path}`;
          } else if (t.function.name === 'get_vendor_source') {
            content = await vendorFetch(args.vendor, args.path);
          } else if (t.function.name === 'search_repo') {
            const results = await searchRepo(args.query);
            content = results.length > 0
              ? `Found ${results.length} file(s):\n${results.map((r) => `- ${r.path}`).join('\n')}`
              : 'No files found for that query.';
          } else if (t.function.name === 'list_directory') {
            const entries = await listDirectory(args.dir);
            if (!entries) {
              content = `Could not list directory: ${args.dir}`;
            } else {
              const dirs = entries.filter((e) => e.type === 'dir').map((e) => `📁 ${e.path}/`);
              const files = entries.filter((e) => e.type === 'file').map((e) => `  ${e.path}`);
              content = [...dirs, ...files].join('\n') || 'Directory is empty.';
            }
          } else if (t.function.name === 'propose_zip_contents') {
            newZipProposal = args;
            content = `ZIP proposal recorded: ${args.files.length} files, README included.`;
          }

          return { role: 'tool' as const, tool_call_id: t.id, content };
        }),
      );

      messages.push(...results);
    }

    return NextResponse.json({ reply, turnsLeft, zipProposal: newZipProposal });
  } catch (err: any) {
    console.error('[build/chat] error:', err.message);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
