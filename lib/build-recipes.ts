// ─── Knead Philosophy ─────────────────────────────────────────────────────────
// This is the founder context behind every architectural decision.
// Demeter should draw on this when explaining why things are built the way they are.

export const KNEAD_PHILOSOPHY = `
FOUNDER CONTEXT — KNEAD

Why Web3:
Knead is built on Web3 because we want all the convenience of a modern, fast app while still protecting your privacy and data. Anyone can sign up for Knead without us ever knowing much about them — not their name, not their identity. Decentralization and open-sourcing are core to building a free and open internet. We are not interested in selling your data. Web3 also provided plug-and-play tools that made us less reliant on databases, which reduces the surface area of data we need to protect in the first place.

Core architectural philosophy:
Knead's stack is about owning the distribution of your media without outsourcing to other platforms. The core philosophy is to make fun and modern design experiences that don't compromise on security, function, or aesthetics. Every vendor in this stack was chosen because it either reduces data exposure, reduces platform dependency, or both.

Who Knead is built for:
The creative who wants to own how their work is distributed. The artists who know that building something from scratch is the best education life can give you. Not the person looking for a shortcut — the person who wants to understand every layer of what they're building.

Design philosophy:
Design is a cutting away process. You should only leave what needs to be there for your audience, never yourself. When in doubt, remove it. The best interface is the one the user never has to think about.

The open source model:
The open source model was the most surprising thing built at Knead — a simple execution that shows people what the future of the internet looks like: open source, with knowledge freely accessible via agents. Demeter is that agent.

`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecipeId =
  | 'free-blog'
  | 'paywalled-blog'
  | 'streaming'
  | 'video-premieres'
  | 'e2e-chat'
  | 'e2e-messaging'
  | 'video-calls'
  | 'social-membership'
  | 'asset-builder'
  | 'agentic-assistance'
  | 'membership-systems'
  | 'scale';

export interface BuildRecipe {
  id: RecipeId;
  title: string;
  emoji: string;
  description: string;
  tags: string[];
  // Why this feature exists and how it fits Knead's philosophy
  why: string;
  // How the architecture fits together
  architectureNote: string;
  // Tradeoffs made — what was gained and what was sacrificed
  tradeoffs: string;
  // Honest reflections on what didn't work or would be done differently
  mistakesWeMade: string[];
  // Where builders should customize vs. leave alone
  customizationNotes: string;
  // The files a builder should read first — in priority order
  canonicalFiles: string[];
  // All related files in the repo
  sourceFiles: string[];
  stack: string[];
  envVarsNeeded: string[];
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export const RECIPES: BuildRecipe[] = [
  {
    id: 'paywalled-blog',
    title: 'Paywalled Content',
    emoji: '🔒',
    description:
      'Own how your content is distributed to your community. Includes Sanity CMS with Stripe Element integration and membership gate. Free previews, premium full access.',
    tags: ['Sanity', 'Stripe', 'Thirdweb', 'NFT'],
    why: 'The core problem Knead was built to solve. Most publishing platforms own your audience relationship. This stack puts that relationship back in your hands — readers sign up with a wallet, you never collect names or emails, and membership is verified on-chain rather than stored in your database.',
    architectureNote: 'Sanity holds the content. Thirdweb verifies NFT ownership server-side on every request — the client never makes the membership decision. Stripe handles the payment and triggers a webhook that mints the NFT. The freemium tier uses a Supabase read counter rather than a second NFT, which keeps gas costs out of the free tier entirely.',
    tradeoffs: 'On-chain verification adds ~200ms to premium content loads. We decided that was worth it to never store membership state in a database that could be breached or subpoenaed.',
    mistakesWeMade: [
      'Originally stored membership state in Supabase and synced from chain. Synchronization drift caused false-negatives where paying members got locked out. Moved to always-verify-on-chain and the problem disappeared.',
      'The freemium read limit was originally enforced client-side. It took one browser console command to bypass. Always enforce limits server-side.',
    ],
    customizationNotes: 'Change FREEMIUM_ARTICLE_LIMIT in lib/constants.ts to adjust the free read allowance. The NFT token IDs (0 = freemium, 1 = premium) are set in lib/membership.ts — if you deploy your own contract with different IDs, update those constants.',
    canonicalFiles: [
      'app/api/check-membership/route.ts',
      'components/membership-provider.tsx',
      'components/membership-gate.tsx',
      'components/unlock-content.tsx',
    ],
    sourceFiles: [
      'sanity/schemas/post.js',
      'app/api/check-membership/route.ts',
      'app/api/create-payment-intent/route.ts',
      'app/api/stripe-webhook/route.ts',
      'components/membership-gate.tsx',
      'components/membership-provider.tsx',
      'components/SubscriptionFlow.tsx',
      'app/join/page.tsx',
      'app/membership/success/page.tsx',
      'lib/constants.ts',
    ],
    stack: ['Next.js 14', 'Sanity CMS', 'Stripe', 'Thirdweb', 'Supabase'],
    envVarsNeeded: [
      'NEXT_PUBLIC_SANITY_PROJECT_ID',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
      'NEXT_PUBLIC_NFT_CONTRACT_ADDRESS',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    id: 'free-blog',
    title: 'Custom Blog',
    emoji: '📝',
    description: "Don't want to charge at all? Take our custom stack for your own content. Includes Sanity CMS.",
    tags: ['Sanity', 'Next.js'],
    why: 'Not everyone needs a paywall. Sometimes the goal is reach, not revenue — building an audience, sharing knowledge, or just having a beautiful home for your writing that you fully control.',
    architectureNote: 'Sanity is a headless CMS — your content lives in their cloud but is served through your own domain via their API. Next.js renders everything server-side for SEO. There is no database to maintain.',
    tradeoffs: 'Sanity has a free tier with generous limits for small publications. At scale, the CDN costs grow. For most independent builders this is never a concern.',
    mistakesWeMade: [
      'Early versions used MDX files in the repo for content. Moving to Sanity meant non-technical editors could publish without touching code — which turned out to matter a lot.',
    ],
    customizationNotes: 'The schema files in sanity/schemas/ define your content model. Start with post.js and author.js and add fields freely — Sanity handles migrations automatically.',
    canonicalFiles: [
      'sanity/schemas/post.js',
      'sanity/client.ts',
      'app/posts/[slug]/page.tsx',
    ],
    sourceFiles: [
      'sanity/schemas/post.js',
      'sanity/schemas/author.js',
      'sanity/schemas/category.js',
      'sanity/client.ts',
      'sanity/schema.ts',
      'app/archive/page.tsx',
      'app/authors/[id]/page.tsx',
    ],
    stack: ['Next.js 14', 'Sanity CMS', 'Tailwind CSS'],
    envVarsNeeded: [
      'NEXT_PUBLIC_SANITY_PROJECT_ID',
      'NEXT_PUBLIC_SANITY_DATASET',
      'SANITY_API_TOKEN',
    ],
  },
  {
    id: 'social-membership',
    title: 'Social Login',
    emoji: '🪪',
    description: 'Make it easy for your fans to become members. Includes ThirdWeb wallet integration and summary snippets.',
    tags: ['Thirdweb', 'NFT', 'Stripe'],
    why: 'Traditional email/password sign-up requires storing credentials — another database to protect, another thing that can be breached. Wallet auth means users authenticate with something they already own. Thirdweb adds Google and Apple social login on top of wallet auth, so the UX feels familiar even for people who have never touched crypto.',
    architectureNote: 'Thirdweb issues a signed JWT after wallet connection. That JWT is verified server-side on protected routes. No session database needed — the JWT is the session. NFT ownership is checked at the contract level, not a permissions table.',
    tradeoffs: 'Users without wallets need to create one via Thirdweb\'s embedded wallet flow. This adds 30 seconds to first-time signup. We think that 30 seconds is worth it to never hold their credentials.',
    mistakesWeMade: [
      'Early versions used Thirdweb v4 SDK. The v5 migration was significant — if starting fresh, go straight to v5.',
    ],
    customizationNotes: 'The wallet connection UI lives in components/thirdweb-connect-button.tsx. The membership tiers (freemium token ID 0, premium token ID 1) are in lib/membership.ts.',
    canonicalFiles: [
      'thirdweb-client.ts',
      'components/membership-provider.tsx',
      'app/api/check-membership/route.ts',
    ],
    sourceFiles: [
      'app/api/check-membership/route.ts',
      'app/api/onboard-user/route.ts',
      'app/api/create-payment-intent/route.ts',
      'app/api/stripe-webhook/route.ts',
      'components/membership-gate.tsx',
      'components/membership-provider.tsx',
      'components/SubscriptionFlow.tsx',
      'thirdweb-client.ts',
    ],
    stack: ['Next.js 14', 'Thirdweb', 'Stripe', 'Supabase'],
    envVarsNeeded: [
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
      'THIRDWEB_SECRET_KEY',
      'NEXT_PUBLIC_NFT_CONTRACT_ADDRESS',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
  {
    id: 'agentic-assistance',
    title: 'Agentic Assistance',
    emoji: '🤖',
    description: 'Install an agent on your page for community management or to help summarize editorial content. Built with ChatGPT, Claude, Alchemy, and Tavily.',
    tags: ['OpenAI', 'Claude', 'Tavily'],
    why: 'Demeter — the agent you\'re talking to right now — is the proof of concept. An agent that knows your content, your stack, and your community\'s context is qualitatively different from a generic chatbot. This is what the open internet looks like: knowledge freely accessible through agents that carry the author\'s perspective.',
    architectureNote: 'The agent is built on OpenAI GPT-4o with tool use for web search (Tavily) and file fetching (GitHub API). The system prompt is where the personality and knowledge live — it\'s the most important file in the whole feature. Claude is used for longer-form tasks where extended thinking helps.',
    tradeoffs: 'GPT-4o is used over Claude Sonnet for cost reasons at the per-turn level ($2.50/$10 per million tokens vs $3/$15). For agents that run longer sessions, that delta compounds.',
    mistakesWeMade: [
      'First version had no rate limiting. A single user could exhaust the monthly API budget in an afternoon.',
      'Tried to make the agent answer everything. Constraining it to only answer from the repository made it dramatically more useful and trustworthy.',
    ],
    customizationNotes: 'The system prompt in app/api/demeter/chat/route.ts (or app/api/open-source/chat/route.ts for the builder agent) is where you define the agent\'s knowledge and personality. Spend time here — it\'s the product.',
    canonicalFiles: [
      'app/api/demeter/chat/route.ts',
      'app/api/open-source/chat/route.ts',
      'components/demeter/DemeterBubble.tsx',
    ],
    sourceFiles: [
      'app/api/demeter/chat/route.ts',
      'app/api/demeter/speak/route.ts',
      'app/api/open-source/chat/route.ts',
      'components/demeter/DemeterBubble.tsx',
      'server/agent-runner.ts',
    ],
    stack: ['Next.js 14', 'OpenAI GPT-4o', 'Anthropic Claude', 'Tavily', 'Alchemy'],
    envVarsNeeded: ['OPENAI_API_KEY', 'TAVILY_API_KEY'],
  },
  {
    id: 'streaming',
    title: 'Streaming',
    emoji: '🎬',
    description: 'Create a video platform to stream your content. Built with Daily.co.',
    tags: ['Daily.co', 'Stripe', 'Thirdweb'],
    why: 'Live streaming should not require a YouTube or Twitch account. Owning your stream means owning the room, the audience, and the recording. Daily.co handles the WebRTC complexity so you can focus on the experience.',
    architectureNote: 'Daily rooms are created server-side via the Daily REST API and destroyed after the event. Tokens are issued per-user server-side — the client never touches the API key. Membership gates are checked before token issuance, so premium-only streams are enforced at the infrastructure level.',
    tradeoffs: 'Daily.co is pay-per-minute. For large audiences, costs can spike during live events. Budget accordingly and set participant limits.',
    mistakesWeMade: [
      'Originally used Mux for streaming. Switched to Daily.co when we realized we wanted two-way interaction (video calls, Q&A) not just one-way broadcast.',
    ],
    customizationNotes: 'Room creation options (max participants, recording, etc.) are set in app/api/events/create-daily-room/route.ts. Token permissions per user type are in app/api/events/generate-token/route.ts.',
    canonicalFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'components/LiveEventView.tsx',
    ],
    sourceFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
    ],
    stack: ['Next.js 14', 'Daily.co', 'Thirdweb', 'Stripe', 'Supabase'],
    envVarsNeeded: [
      'DAILY_API_KEY',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
      'STRIPE_SECRET_KEY',
    ],
  },
  {
    id: 'video-premieres',
    title: 'Video Premieres',
    emoji: '🎟️',
    description: 'Upload and schedule video content to distribute to your community. Built with Mux.',
    tags: ['Mux', 'Supabase'],
    why: 'A premiere is a moment — a scheduled drop that creates anticipation. Mux handles video encoding and delivery at scale so the infrastructure never becomes the story.',
    architectureNote: 'Videos are uploaded directly to Mux from the admin panel. Mux returns a playback ID which is stored in Supabase. The player component fetches the playback token server-side before rendering — the actual Mux asset ID never reaches the client.',
    tradeoffs: 'Mux is premium priced. For infrequent uploads it\'s very cost-effective. For a high-volume video library, evaluate storage costs carefully.',
    mistakesWeMade: [
      'Early uploads went through our server before reaching Mux, adding unnecessary latency and bandwidth costs. Direct-to-Mux uploads via their upload URL API solved this.',
    ],
    customizationNotes: 'Upload settings (max resolution, encoding tier) are in the Mux dashboard. The playback policy (signed vs public) is set when creating the asset.',
    canonicalFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'components/LiveEventView.tsx',
    ],
    sourceFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'app/api/events/delete-daily-room/route.ts',
      'components/LiveEventView.tsx',
    ],
    stack: ['Next.js 14', 'Mux', 'Supabase'],
    envVarsNeeded: ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'e2e-chat',
    title: 'End-To-End Encrypted Chat',
    emoji: '💬',
    description: 'Create a group chat that\'s secure. Built with Towns Protocol.',
    tags: ['Towns Protocol', 'Thirdweb'],
    why: 'Group chat should be private by default, not private as a premium feature. Towns Protocol gives you Slack-like channels where even the server operator cannot read messages. This is the infrastructure the open internet needs.',
    architectureNote: 'Towns handles encryption and message delivery. Knead\'s role is authentication: the key-sharer server verifies wallet ownership and issues channel access. Once a user has access, all message encryption/decryption happens client-side in the Towns SDK.',
    tradeoffs: 'Towns Protocol is an early-stage decentralized network. Node availability has been inconsistent — messages have been lost during infrastructure changes without notice from the Towns team. Build with the assumption that the underlying protocol may change.',
    mistakesWeMade: [
      'We were fully dependent on Towns Protocol nodes with no fallback. When Towns removed nodes and support staff without announcement, we lost messages and had to rebuild functionality. If rebuilding today, we would build an abstraction layer so the chat protocol can be swapped without touching product code.',
      'Assumed protocol stability too early. Treat any third-party protocol dependency as you would a vendor that might disappear.',
    ],
    customizationNotes: 'Space ID and default channel ID are environment variables — you create these in the Towns dashboard and point your app at them. The key-sharer server (server/key-sharer.ts) is the only piece you need to customize for your own access rules.',
    canonicalFiles: [
      'app/chat/chat-client.tsx',
      'server/key-sharer.ts',
      'app/api/chat/permissions/route.ts',
    ],
    sourceFiles: [
      'app/chat/page.tsx',
      'app/chat/chat-client.tsx',
      'app/chat/connected-chat.tsx',
      'app/api/chat/permissions/route.ts',
      'app/api/chat/user/route.ts',
      'server/key-sharer.ts',
    ],
    stack: ['Next.js 14', 'Towns Protocol', 'Thirdweb', 'Supabase'],
    envVarsNeeded: [
      'TOWNS_SPACE_ID',
      'TOWNS_DEFAULT_CHANNEL_ID',
      'KEY_SHARER_PRIVATE_KEY',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    ],
  },
  {
    id: 'e2e-messaging',
    title: 'End-To-End Encrypted Messaging',
    emoji: '🔐',
    description: 'Create a platform where private conversations stay private. Built with Towns Protocol.',
    tags: ['Towns Protocol'],
    why: 'DMs on most platforms are readable by the platform. End-to-end encryption means the conversation is between two people — not two people and the company.',
    architectureNote: 'Each DM thread is a Towns space created on demand. Message encryption/decryption happens client-side in the Towns SDK, same as group chat — Knead\'s role is just issuing access via the key-sharer server.',
    tradeoffs: 'Same Towns Protocol stability caveats as group chat apply here. The DM layer is more sensitive because users have a higher expectation of persistence.',
    mistakesWeMade: [
      'Same Towns Protocol dependency issues as group chat. The lesson applies here doubly — private messages disappearing is worse than group messages disappearing.',
    ],
    customizationNotes: 'DM room creation logic is in app/api/dm/generate-dm-token/route.ts. If you want video calls inside DMs, that\'s a separate, optional addition — see the Video Calls recipe for the Daily.co pattern to layer on top.',
    canonicalFiles: [
      'app/api/dm/generate-dm-token/route.ts',
    ],
    sourceFiles: [
      'app/api/dm/generate-dm-token/route.ts',
    ],
    stack: ['Next.js 14', 'Towns Protocol', 'Thirdweb'],
    envVarsNeeded: [
      'TOWNS_SPACE_ID',
      'KEY_SHARER_PRIVATE_KEY',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    ],
  },
  {
    id: 'video-calls',
    title: 'Video Calls',
    emoji: '📹',
    description: 'Enable your community to get some face time in. Built with Daily.co.',
    tags: ['Daily.co'],
    why: 'Sometimes the most valuable thing you can give your community is access to you. Video calls built into your platform mean that conversation happens on your terms, in your space.',
    architectureNote: 'Rooms are created on demand, tokens are issued server-side, and rooms are deleted after the call ends. No persistent infrastructure — pay only for what you use.',
    tradeoffs: 'Daily.co has a free tier suitable for low-volume use. At scale, per-minute costs add up. Set participant limits and call duration limits in production.',
    mistakesWeMade: [
      'Left rooms open indefinitely in early testing. Daily.co charges for room existence time, not just active participants. Always delete rooms after calls end.',
    ],
    customizationNotes: 'Participant limits, recording, and room expiry are all configurable per-room at creation time in app/api/events/create-daily-room/route.ts.',
    canonicalFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'components/LiveEventView.tsx',
    ],
    sourceFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'components/LiveEventView.tsx',
    ],
    stack: ['Next.js 14', 'Daily.co'],
    envVarsNeeded: ['DAILY_API_KEY'],
  },
  {
    id: 'asset-builder',
    title: 'Social Asset Studio',
    emoji: '🎨',
    description: "Copy/Paste Knead's internal tool for creating social posts. Upload an image, set your type, download a ready-to-post asset. Runs entirely in the browser — no API costs.",
    tags: [],
    why: 'Social posts are part of the distribution stack. Having a tool that outputs on-brand assets in 60 seconds means publishing is something you do, not something you dread.',
    architectureNote: 'Pure browser Canvas API — no backend, no API calls, no costs. Fonts are loaded once via document.fonts and the canvas renders at full export resolution. What you see in the preview is byte-for-byte what downloads.',
    tradeoffs: 'Canvas text rendering differs slightly across browsers. Chrome is the reference rendering environment.',
    mistakesWeMade: [
      'First version used a server-side image generation library. Moving to client-side Canvas eliminated the server cost and made the preview instant.',
    ],
    customizationNotes: 'This is Knead\'s own branding out of the box — swap it out before shipping. The font-loading useEffect loads "adonis-web" (Knead\'s display font, used for the "K" wordmark and headlines) and "Georgia Pro" (used for kicker, body, and byline). Replace both font family strings with your own brand fonts wherever styledFont() is called, and swap the "K" wordmark character/logo for your own mark. Color constants (CREAM, INK, WHITE, BLACK) at the top of the file define the background/text palette — update those to your brand colors too.',
    canonicalFiles: [
      'components/admin/SocialAssetStudio.tsx',
    ],
    sourceFiles: ['components/admin/SocialAssetStudio.tsx'],
    stack: ['Next.js 14', 'Canvas API', 'Tailwind CSS'],
    envVarsNeeded: [],
  },
  {
    id: 'membership-systems',
    title: 'Membership Systems',
    emoji: '⛓️',
    description: "Pull from Knead's custom smart contracts to design a membership that fits your community's needs.",
    tags: ['Thirdweb', 'NFT', 'Base'],
    why: 'On-chain membership means your member list cannot be taken from you, cannot be breached in the traditional sense, and cannot be sold. The membership record lives on a public blockchain — verifiable by anyone, controlled by nobody.',
    architectureNote: 'Knead uses ERC1155 for membership — one contract, multiple token types. Token ID 0 is freemium, token ID 1 is premium. This keeps gas costs minimal (one contract deployment) while supporting multiple tiers. The contract addresses are on Base mainnet for low fees.',
    tradeoffs: 'On-chain membership requires users to have a wallet. Thirdweb\'s embedded wallet lowers this barrier significantly but it is still a step traditional auth doesn\'t have.',
    mistakesWeMade: [
      'Originally kept a membership mirror in Supabase for faster queries. The sync complexity caused drift and members got locked out. Now the chain is always the source of truth — the slight latency is worth the reliability.',
    ],
    customizationNotes: 'You can fork Knead\'s contracts on Basescan or deploy a fresh ERC1155 via Thirdweb\'s dashboard in minutes. Update the contract address env var and the token IDs in lib/membership.ts to point at your deployment.',
    canonicalFiles: [
      'lib/blockchain/check-nft-ownership.ts',
      'app/api/check-membership/route.ts',
      'lib/contracts/cache.ts',
    ],
    sourceFiles: [
      'lib/membership.ts',
      'lib/blockchain/check-nft-ownership.ts',
      'lib/contracts/cache.ts',
      'app/api/check-membership/route.ts',
      'components/membership-provider.tsx',
    ],
    stack: ['Next.js 14', 'Thirdweb', 'Base', 'Supabase'],
    envVarsNeeded: [
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
      'THIRDWEB_SECRET_KEY',
      'NEXT_PUBLIC_NFT_CONTRACT_ADDRESS',
      'NEXT_PUBLIC_BASE_RPC_URL',
    ],
  },
  {
    id: 'scale',
    title: 'Scale',
    emoji: '📈',
    description: "Dig through Knead's lean stack for pay-as-you-go solutions. Perfect for independent builders and small teams.",
    tags: ['Supabase', 'Vercel', 'Stripe'],
    why: 'Independent builders should not be priced like enterprises. Every vendor in Knead\'s stack has a meaningful free tier and scales with usage — you pay for what you use, nothing more.',
    architectureNote: 'Vercel handles deployment and edge functions. Supabase handles the database with row-level security so the API can be called directly from the client without exposing data. Stripe handles billing with no monthly minimums.',
    tradeoffs: 'Pay-as-you-go means costs are unpredictable at viral scale. Set spending limits in each vendor\'s dashboard before launch.',
    mistakesWeMade: [
      'Did not set Vercel function timeout limits early. A runaway function on a busy day created an unexpected bill.',
      'Supabase free tier pauses after 1 week of inactivity. Upgrade to Pro before launch or set up a keep-alive ping.',
    ],
    customizationNotes: 'Review the Vercel function configurations in next.config.js. Set maxDuration on any route that calls external APIs.',
    canonicalFiles: [
      'middleware.ts',
      'lib/supabase/server.ts',
    ],
    sourceFiles: [
      'supabase/migrations/',
      'middleware.ts',
      'lib/supabase/server.ts',
    ],
    stack: ['Next.js 14', 'Supabase', 'Vercel', 'Stripe'],
    envVarsNeeded: [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ],
  },
];

export const FREE_TURNS_PER_DAY = 5;
export const FREE_MAX_SESSIONS_PER_DAY = 1;
