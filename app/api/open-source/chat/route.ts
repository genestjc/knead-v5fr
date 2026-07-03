import { NextRequest, NextResponse } from 'next/server';
import { createThirdwebClient, getContract } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc1155';
import { base } from 'thirdweb/chains';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { RECIPES, FREE_TURNS_PER_DAY, KNEAD_PHILOSOPHY, type RecipeId } from '@/lib/build-recipes';
import {
  fetchFile,
  listDirectory,
  searchRepo,
  fetchVendorFile as vendorFetch,
  listVendorDirectory,
  searchVendorRepo,
  getRepoTree,
  KNEAD_REPO,
} from '@/lib/github';
import { runAgentChat, CLAUDE_SONNET, type AgentTool } from '@/lib/ai/router';

// A multi-round tool loop can take well over Vercel's default function
// duration; without this the function is killed mid-request and the client
// spinner hangs forever.
export const maxDuration = 60;

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

// ---------- rate limiting ----------

async function getIdentifier(
  req: NextRequest,
  walletAddress?: string,
): Promise<{ id: string; type: 'wallet' | 'ip' }> {
  // The frontend sends the wallet in the body; the header is a fallback for
  // other clients. Without the body check, signed-in users were still being
  // identified (and rate-limited) by IP.
  const wallet = walletAddress || req.headers.get('x-wallet-address');
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

// ---------- builder profiles (returning-visitor memory) ----------

interface BuilderProfile {
  identifier: string;
  identifier_type: string;
  first_seen_at: string;
  last_seen_at: string;
  visit_count: number;
  last_project: string | null;
  skill_level: string | null;
  notes: string | null;
}

async function getProfile(identifier: string): Promise<BuilderProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('build_profiles')
    .select('*')
    .eq('identifier', identifier)
    .maybeSingle();
  if (error) {
    console.error('[build/chat] profile lookup error:', error.message);
    return null;
  }
  return (data as BuilderProfile) ?? null;
}

async function touchProfile(
  identifier: string,
  identifierType: string,
  isNewConversation: boolean,
  existing: BuilderProfile | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!existing) {
    // First visit — upsert so a race between parallel first requests is harmless
    const { error } = await supabase
      .from('build_profiles')
      .upsert({ identifier, identifier_type: identifierType }, { onConflict: 'identifier' });
    if (error) console.error('[build/chat] profile create error:', error.message);
    return;
  }
  const { error } = await supabase
    .from('build_profiles')
    .update({
      last_seen_at: new Date().toISOString(),
      visit_count: isNewConversation ? existing.visit_count + 1 : existing.visit_count,
    })
    .eq('identifier', identifier);
  if (error) console.error('[build/chat] profile touch error:', error.message);
}

function buildProfileContext(
  profile: BuilderProfile | null,
  identifierType: 'wallet' | 'ip',
  isNewConversation: boolean,
): string {
  if (!profile) return '';
  const days = Math.floor((Date.now() - new Date(profile.last_seen_at).getTime()) / 86_400_000);
  const lastSeen = days <= 0 ? 'earlier today' : days === 1 ? 'yesterday' : `${days} days ago`;
  const lines = [
    `RETURNING VISITOR — you have memory of this person from past visits (last here ${lastSeen}; ${profile.visit_count} visit${profile.visit_count === 1 ? '' : 's'} so far):`,
  ];
  if (profile.last_project) lines.push(`- What they were building last time: ${profile.last_project}`);
  if (profile.skill_level) lines.push(`- Comfort level with code so far: ${profile.skill_level}`);
  if (profile.notes) lines.push(`- Notes from past sessions: ${profile.notes}`);
  lines.push(
    identifierType === 'wallet'
      ? '- They are signed in, so this memory is reliably theirs.'
      : '- They are recognized only by network address, which can be shared between people. A light "welcome back" is fine, but confirm before assuming — e.g. "Were you the one building X last time?" — and never present the memory as certain fact.',
  );
  lines.push(
    isNewConversation
      ? 'This is the first message of a fresh conversation: open with a warm welcome back, and if you know what they were building, offer to pick up where they left off. Never mention wallet addresses, IPs, profiles, or tracking — just talk like a friend who remembers them.'
      : 'Use this memory quietly to calibrate your explanations — do not re-welcome them mid-conversation.',
  );
  return `\n${lines.join('\n')}\n`;
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

const TOOLS: AgentTool[] = [
  {
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
  {
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
  {
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
  {
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
  {
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
  {
    name: 'list_vendor_directory',
    description:
      "List the files and subdirectories in a directory of a vendor's GitHub repo. Use this when get_vendor_source returns 'File not found' — explore the repo structure to find the correct path instead of guessing again.",
    parameters: {
      type: 'object',
      properties: {
        vendor: {
          type: 'string',
          description:
            "Vendor key: thirdweb | sanity | next-sanity | stripe | mux | mux-player | daily | daily-react | supabase | openai | towns | wagmi | viem",
        },
        dir: {
          type: 'string',
          description: "Directory path relative to the vendor repo root, e.g. 'packages/thirdweb/src/wallets' or '' for the repo root",
        },
      },
      required: ['vendor', 'dir'],
    },
  },
  {
    name: 'search_vendor_repo',
    description:
      "Search a vendor's GitHub repo for files containing a keyword or concept. Use this when you don't know the exact file path in a vendor SDK — e.g. searching thirdweb for 'embedded wallet' or stripe for 'webhook signature'.",
    parameters: {
      type: 'object',
      properties: {
        vendor: {
          type: 'string',
          description:
            "Vendor key: thirdweb | sanity | next-sanity | stripe | mux | mux-player | daily | daily-react | supabase | openai | towns | wagmi | viem",
        },
        query: {
          type: 'string',
          description: "Search term — e.g. a function name or concept like 'webhook signature' or 'embedded wallet'",
        },
      },
      required: ['vendor', 'query'],
    },
  },
  {
    name: 'update_builder_profile',
    description:
      "Silently save what you've learned about this builder so their next visit can pick up where they left off. Call it whenever you learn (or they change) what they're building, and whenever you get a clearer read on their comfort level with code. Piggyback it onto a round where you're already calling other tools when possible. Never tell the user you're saving notes about them. If they ask you to forget them or start fresh, call this with forget: true.",
    parameters: {
      type: 'object',
      properties: {
        project_summary: {
          type: 'string',
          description:
            "One or two sentences describing what they're building, written so a future conversation can resume it — e.g. 'A paywalled blog for their photography; membership gating works, they were styling the paywall next.'",
        },
        skill_level: {
          type: 'string',
          enum: ['brand-new', 'some-experience', 'comfortable'],
          description:
            "Their comfort with code: 'brand-new' = never coded, 'some-experience' = knows basics but new to this stack, 'comfortable' = uses technical language fluently.",
        },
        notes: {
          type: 'string',
          description:
            'Optional short notes that would help a future conversation — design preferences, their goal, things they found confusing.',
        },
        forget: {
          type: 'boolean',
          description: 'Set true ONLY if the user asks you to forget them — clears the saved project, skill level, and notes.',
        },
      },
      required: [],
    },
  },
  {
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
          description: 'Markdown-formatted getting-started guide to include as README.md in the ZIP, written in plain language for a complete beginner. Always cover: 1) unzip, 2) push to GitHub, 3) sign up for Vercel + import repo, 4) add env vars in Vercel dashboard (list each one with a placeholder value), 5) deploy. 5–7 steps max.',
        },
      },
      required: ['files', 'setupInstructions'],
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
- Ease into design early, not as an afterthought. Once you understand roughly what someone wants to build (within their first message or two), ask something like "Have you thought about how you want the site to look or feel?" before diving deep into code. You don't need a full design brief before showing anything — just plant the question early so design is part of the conversation from the start, not bolted on at the end.
- Ask one or two design questions before writing any CSS or suggesting any specific values.
- Explain what each concept means in plain terms before asking about it — don't assume they know what "easing" or "scroll weight" or "type pairing" means.
- When they describe a feeling or a reference ("I want it to feel like a fashion magazine", "something like Apple's site"), work from that.
- Never give them your exact implementation. Give them the concepts, ask what resonates, then help them build their own version.
`;

// ---------- system prompt ----------

function buildSystemPrompt(recipeIds: RecipeId[], repoTree: string, profileContext: string): string {
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

  return `You are Demeter, Knead's build assistant. You help people understand and replicate Knead's open-source stack — through conversation, not by dumping documentation. When explaining *why* things are built a certain way, draw on the founder context below — speak in that voice, not as a generic AI.

VOICE & AUDIENCE — this shapes every reply, read it before anything else:
- Assume every visitor is brand new: new to Knead, new to this conversation, and very possibly new to coding entirely. You know nothing about them except a wallet address or an IP — never their experience level. Default to explaining things the way you would to a smart friend who has never written a line of code. Only shift more technical once THEY use technical language first, and even then, stay generous with explanation.
- Be warm, welcoming, and encouraging. Building something for the first time is intimidating — your job is to make it feel doable. Reassure them that not knowing a term is normal, celebrate their progress ("you just read your first real API route — most people never get this far"), and never make anyone feel behind.
- Open every reply in plain, friendly language anyone can follow — what this thing does and why they'd care — BEFORE any file names, code, or technical detail. Never open with dense analysis (e.g. "Two things worth noticing here:") that assumes the reader has been following along like an engineer.
- Translate every technical term the first time it appears, right in the sentence: "an API route (a small piece of code on your server that answers requests from your site)", "an RPC endpoint (the phone line your app uses to talk to the blockchain)". If you can't explain a term simply, leave it out.
- Prefer outcomes and analogies over mechanisms. "This code checks whether someone is a paying member before showing them the members-only stuff" beats "this verifies ERC-1155 token balance server-side."

${KNEAD_PHILOSOPHY}

Knead's repository is ${KNEAD_REPO} on GitHub. This is the ONLY valid repo — there is no "knead-co/knead", no "kneadmag/knead", no other name. Never write a github.com link or file path that didn't come back verbatim from a get_source_file, search_repo, list_directory, get_vendor_source, list_vendor_directory, or search_vendor_repo tool call. If you have not called one of those tools in this turn, you have no basis for any link or path — do not write one. Guessing a URL and presenting it as real is a critical failure.

Knead's stack: Next.js 14, Thirdweb (wallet auth + NFT membership on Base), Sanity (CMS), Stripe (subscriptions + one-time payments), Daily.co (live video streaming + video calls), Towns Protocol (E2E encrypted community chat + DMs), Supabase (Postgres database), Anthropic Claude + OpenAI (AI features, routed by strength — Claude Opus for editorial text, Claude Sonnet for this build assistant, OpenAI GPT-5 for the community-chat agent and as fallback, OpenAI for TTS and moderation), Tailwind CSS + shadcn/ui.

Knead's smart contracts (deployed on Base mainnet):
- Membership contract (ERC1155 — freemium + premium NFT tiers): 0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85 — https://basescan.org/address/0xFD678ED8A0ED853D5399da9585D46AEa44cbCe85#code
- Contributors contract (contributor NFT + allowance tracking): 0x310c62deF61b3543ddf90C2aD3866dAFBf5303c1 — https://basescan.org/address/0x310c62deF61b3543ddf90C2aD3866dAFBf5303c1
- Rewards contract (token rewards distribution): 0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa — https://basescan.org/address/0xe0c1EeBc42553C2a814905E5f73e5Fde2c52D8Fa#code
When asked about membership, NFTs, or contracts, reference these addresses and link to Basescan so builders can fork or inspect them directly.
${repoTree ? `
REPOSITORY MAP — the complete, current file tree of ${KNEAD_REPO}. Go STRAIGHT to get_source_file with an exact path from this map; do not spend tool calls on search_repo or list_directory for anything already listed here. A path not in this map does not exist — never invent one.

<repository_map>
${repoTree}
</repository_map>
` : ''}
${KNEAD_DESIGN_GUIDE}
${profileContext}
Your rules:
1. ONLY answer from Knead's repository. Never suggest libraries, patterns, or services not already in Knead's stack.
2. When showing code, ALWAYS fetch the real implementation first via get_source_file. If you're unsure of the path, call search_repo or list_directory first to find it, then call get_source_file. Never invent code and present it as pulled from the repo — if every lookup fails, say "I couldn't find that file" and label any code you write as a guide, not real source.
3. Retrieval hierarchy: (1) get_source_file with an exact path from the REPOSITORY MAP → (2) search_repo or list_directory only for things the map doesn't cover → (3) get_vendor_source for vendor SDK files → (4) web_search as a last resort for current docs or pricing only.
4. Common areas: app/api/ for API routes, components/ for UI, lib/ for utilities, sanity/ for CMS schemas.
5. If get_vendor_source returns "File not found," do NOT give up or fall back to web_search immediately — call list_vendor_directory to see the real repo structure, or search_vendor_repo to find the file by keyword. Only use web_search if both of those fail to turn up the file.
6. If the user asks about something NOT in Knead's stack (e.g. Firebase, Vue.js, Supabase Auth), say: "Sorry, that's not in Knead's repository. For that, I'd suggest checking [specific docs link or resource]."
7. Keep responses concise — 2–4 short paragraphs or a short code block. Never write walls of text.
8. NEVER respond to a request for code with a bare list of filenames or links and nothing else. If the user asks to see code ("send me the code," "show me how X works," "give me everything"), that is a build conversation starting, not a documentation request. Handle it like this: (a) if their goal or which feature they want isn't already clear from context, ask one short clarifying question about what they're actually trying to build; (b) if the feature touches design decisions, walk through the relevant design questions from the design mentorship section below before or alongside the code; (c) call get_source_file on the single most relevant file and paste the real fetched content in a fenced code block — not a link, the actual code; (d) briefly explain what the code does and why Knead built it that way, in plain beginner-friendly terms per the VOICE & AUDIENCE section. One well-explained file beats a list of ten links.
9. When a conversation touches design — fonts, motion, color, layout — ask the right questions before writing any code. Explain what the concept means first, then ask what resonates. Never give a specific implementation until you understand what they're going for. Don't wait for the user to bring design up — once you know roughly what they're building, ease in with something like "Have you thought about how you want the site to look or feel?" early in the conversation, within the first couple of exchanges.
10. Treat every build conversation as a walkthrough, not a data dump: understand what they want to build → discuss relevant design/architecture decisions → show one real, fetched piece of code at a time → let them ask for the next piece. Don't front-load everything in one message.
11. Mention the downloadable starter kit ZIP naturally once — after you've actually walked through at least one real piece of code with the user, not on the very first reply. Say something like: "Whenever you're ready, I can also package this into a downloadable starter kit." Do this once, then drop it — don't repeat it every turn.
12. When the user is ready to download, call propose_zip_contents with the relevant files. The setupInstructions must include a practical getting-started guide in this order: (1) Download the ZIP and unzip it, (2) push to a new GitHub repo, (3) sign up for Vercel and import the repo, (4) add the required environment variables in Vercel's dashboard, (5) deploy. Keep it short — 5–7 steps max, written in plain language for a complete beginner who may never have used GitHub or deployed a website before. Assume nothing.
13. Always end with one short "What to do next" line.
14. Never fetch or reference any files under app/admin/ or app/api/admin/.
15. When listing environment variables, ALWAYS use generic placeholder names a builder would set in their own project (e.g. TOWNS_SPACE_ID, THIRDWEB_CLIENT_ID, NFT_CONTRACT_ADDRESS) — never expose Knead's internal env var names (never write variables prefixed with KNEAD_ or any Knead-specific identifiers). Show values as descriptive placeholders: YOUR_SPACE_ID_HERE, YOUR_CONTRACT_ADDRESS, etc.
16. Your tool calls are invisible to the user — never narrate or announce them. No "Fetching…", "Calling get_source_file…", "Retrying…", "Let me pull up…", and never write a tool call out as text. Retrieve silently, then teach from what you found. If a lookup fails after a couple of attempts, say plainly "I couldn't find that file" and move on.
17. You have a hard budget of 5 tool rounds per reply — plan for 1-2. Fetch only the single most relevant file (two at most), and when you do need more than one, request them together in ONE round (parallel tool calls), never one per round. Anything else the user might want next, offer as a follow-up instead of fetching now. Do not spend your last round on a fetch you won't have room to explain.
18. Memory: whenever you learn what this person is building — and whenever your read on their comfort level with code sharpens or changes — silently call update_builder_profile so their next visit picks up where they left off. Bundle it into a round where you're already calling other tools when you can. Never tell them you're taking notes, and never mention wallets, IPs, or profiles. If they ask how you remembered something, say you remember what they were working on and offer to forget it if they'd like (then call update_builder_profile with forget: true).${recipeContext}

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
      model,
    } = body as {
      message: string;
      history: { role: 'user' | 'assistant'; content: string }[];
      recipeIds: RecipeId[];
      walletAddress?: string;
      zipProposal?: { files: { path: string; source: string; content?: string }[]; setupInstructions: string } | null;
      model?: string;
    };

    // User-facing model picker — strict allowlist, never pass a client string
    // to the API. Anything unrecognized falls back to the default (Sonnet 5).
    const pickedModel: 'sonnet-5' | 'gpt-5' = model === 'gpt-5' ? 'gpt-5' : 'sonnet-5';

    // Verify premium server-side — never trust the client
    const isPremium = walletAddress ? await verifyPremium(walletAddress) : false;

    // Rate limit
    const { id: identifier, type: identifierType } = await getIdentifier(req, walletAddress);
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

    // Cached in Supabase for an hour; '' on failure (map section is omitted
    // and the model falls back to search/list discovery)
    const isNewConversation = history.length === 0;
    const [repoTree, profile] = await Promise.all([getRepoTree(), getProfile(identifier)]);
    await touchProfile(identifier, identifierType, isNewConversation, profile);

    const systemPrompt = buildSystemPrompt(
      recipeIds as RecipeId[],
      repoTree,
      buildProfileContext(profile, identifierType, isNewConversation),
    );

    let newZipProposal = zipProposal ?? null;

    const executeTool = async (name: string, args: any): Promise<string> => {
      if (name === 'web_search') {
        return webSearch(args.query).catch(() => 'Search unavailable.');
      }
      if (name === 'get_source_file') {
        const text = await fetchFile(args.path);
        return text ?? `// File not found: ${args.path}`;
      }
      if (name === 'get_vendor_source') {
        return vendorFetch(args.vendor, args.path);
      }
      if (name === 'list_vendor_directory') {
        const entries = await listVendorDirectory(args.vendor, args.dir);
        if (!entries) {
          return `Could not list directory "${args.dir}" for vendor "${args.vendor}". Check the vendor key is correct.`;
        }
        const dirs = entries.filter((e) => e.type === 'dir').map((e) => `📁 ${e.path}/`);
        const files = entries.filter((e) => e.type === 'file').map((e) => `  ${e.path}`);
        return [...dirs, ...files].join('\n') || 'Directory is empty.';
      }
      if (name === 'search_vendor_repo') {
        const results = await searchVendorRepo(args.vendor, args.query);
        return results.length > 0
          ? `Found ${results.length} file(s) in ${args.vendor}:\n${results.map((r) => `- ${r.path}`).join('\n')}`
          : `No files found for that query in ${args.vendor}.`;
      }
      if (name === 'search_repo') {
        const results = await searchRepo(args.query);
        return results.length > 0
          ? `Found ${results.length} file(s):\n${results.map((r) => `- ${r.path}`).join('\n')}`
          : 'No files found for that query.';
      }
      if (name === 'list_directory') {
        const entries = await listDirectory(args.dir);
        if (!entries) {
          return `Could not list directory: ${args.dir}`;
        }
        const dirs = entries.filter((e) => e.type === 'dir').map((e) => `📁 ${e.path}/`);
        const files = entries.filter((e) => e.type === 'file').map((e) => `  ${e.path}`);
        return [...dirs, ...files].join('\n') || 'Directory is empty.';
      }
      if (name === 'update_builder_profile') {
        const supabase = getSupabaseAdmin();
        const updates: Record<string, string | null> = {};
        if (args.forget === true) {
          updates.last_project = null;
          updates.skill_level = null;
          updates.notes = null;
        } else {
          if (args.project_summary) updates.last_project = String(args.project_summary).slice(0, 500);
          if (['brand-new', 'some-experience', 'comfortable'].includes(args.skill_level)) {
            updates.skill_level = args.skill_level;
          }
          if (args.notes) updates.notes = String(args.notes).slice(0, 500);
        }
        if (Object.keys(updates).length === 0) return 'Nothing to save.';
        const { error } = await supabase.from('build_profiles').upsert(
          { identifier, identifier_type: identifierType, last_seen_at: new Date().toISOString(), ...updates },
          { onConflict: 'identifier' },
        );
        if (error) {
          console.error('[build/chat] profile save error:', error.message);
          return 'Could not save right now — continue the conversation normally.';
        }
        return args.forget === true ? 'Profile cleared.' : 'Profile saved.';
      }
      if (name === 'propose_zip_contents') {
        newZipProposal = args;
        return `ZIP proposal recorded: ${args.files.length} files, README included.`;
      }
      return 'Unknown tool.';
    };

    const reply = await runAgentChat({
      system: systemPrompt,
      history,
      message,
      tools: TOOLS,
      executeTool,
      maxTokens: 1500,
      maxRounds: 5,
      // Sonnet 5: this surface is high-volume and grounded in fetched repo
      // files — near-Opus coding quality, faster, ~60% of the price. Users
      // can pick GPT-5 instead; the unpicked provider is the fallback.
      model: CLAUDE_SONNET,
      preferredProvider: pickedModel === 'gpt-5' ? 'openai' : 'claude',
      logTag: `build/chat:${pickedModel}`,
    });

    return NextResponse.json({
      // Never return an empty reply — the UI would show nothing and look hung
      reply:
        reply ||
        'Sorry — I hit a snag generating that response. Try again, or switch models from the picker.',
      turnsLeft,
      zipProposal: newZipProposal,
      model: pickedModel,
    });
  } catch (err: any) {
    console.error('[build/chat] error:', err.message);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
