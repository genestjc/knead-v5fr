export type RecipeId =
  | 'free-blog'
  | 'paywalled-blog'
  | 'streaming'
  | 'video-premieres'
  | 'e2e-chat'
  | 'e2e-messaging'
  | 'video-calls'
  | 'social-membership'
  | 'asset-builder';

export interface BuildRecipe {
  id: RecipeId;
  title: string;
  emoji: string;
  description: string;
  tags: string[];
  // Paths in the Knead repo that are relevant to this recipe
  sourceFiles: string[];
  // Key vendors/packages this recipe uses
  stack: string[];
  envVarsNeeded: string[];
}

export const RECIPES: BuildRecipe[] = [
  {
    id: 'free-blog',
    title: 'Free Blog',
    emoji: '📝',
    description: 'A Sanity-powered editorial blog with no paywall. Clean, fast, SEO-ready.',
    tags: ['Sanity', 'Next.js'],
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
    id: 'paywalled-blog',
    title: 'Paywalled Blog',
    emoji: '🔒',
    description:
      'Sanity blog behind a Stripe subscription + NFT membership gate. Free previews, premium full reads.',
    tags: ['Sanity', 'Stripe', 'Thirdweb', 'NFT'],
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
    id: 'streaming',
    title: 'Streaming Site',
    emoji: '🎬',
    description:
      'Daily.co-powered video streaming with membership paywalls. Host live rooms, gate access, and stream at scale.',
    tags: ['Daily.co', 'Stripe', 'Thirdweb'],
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
    description:
      'Host live-streamed events with ticketing and Daily.co video rooms. RSVP, gate, and go live.',
    tags: ['Daily.co', 'Supabase'],
    sourceFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'app/api/events/delete-daily-room/route.ts',
      'app/api/admin/events/route.ts',
      'app/api/admin/event-passes/route.ts',
      'components/LiveEventView.tsx',
    ],
    stack: ['Next.js 14', 'Daily.co', 'Supabase'],
    envVarsNeeded: ['DAILY_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'e2e-chat',
    title: 'E2E Encrypted Chat',
    emoji: '💬',
    description:
      'Community chat powered by Towns Protocol — end-to-end encrypted, decentralized, Slack-like.',
    tags: ['Towns Protocol', 'Thirdweb'],
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
      'NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID',
      'NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID',
      'KEY_SHARER_PRIVATE_KEY',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    ],
  },
  {
    id: 'e2e-messaging',
    title: 'E2E Encrypted Messaging',
    emoji: '🔐',
    description:
      'Private 1-on-1 DMs over Towns Protocol with end-to-end encryption and video rooms.',
    tags: ['Towns Protocol', 'Daily.co'],
    sourceFiles: [
      'app/api/dm/generate-dm-token/route.ts',
      'app/api/dm/create-video-room/route.ts',
    ],
    stack: ['Next.js 14', 'Towns Protocol', 'Daily.co', 'Thirdweb'],
    envVarsNeeded: [
      'NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID',
      'KEY_SHARER_PRIVATE_KEY',
      'DAILY_API_KEY',
      'NEXT_PUBLIC_THIRDWEB_CLIENT_ID',
    ],
  },
  {
    id: 'video-calls',
    title: 'Video Calls',
    emoji: '📹',
    description:
      'Drop-in Daily.co video calls inside your app. Rooms created on-demand, tokens issued server-side.',
    tags: ['Daily.co'],
    sourceFiles: [
      'app/api/events/create-daily-room/route.ts',
      'app/api/events/generate-token/route.ts',
      'components/LiveEventView.tsx',
    ],
    stack: ['Next.js 14', 'Daily.co'],
    envVarsNeeded: ['DAILY_API_KEY'],
  },
  {
    id: 'social-membership',
    title: 'Social Log-In Membership',
    emoji: '🪪',
    description:
      'Wallet auth via Thirdweb with two NFT tiers — freemium and premium. Google/Apple social log-in built-in.',
    tags: ['Thirdweb', 'NFT', 'Stripe'],
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
    id: 'asset-builder',
    title: 'Social Media Asset Builder',
    emoji: '🎨',
    description:
      "AI-powered shareable post generator. Paste an article and Demeter writes you a post in your voice.",
    tags: ['OpenAI', 'Sanity'],
    sourceFiles: ['app/api/demeter/chat/route.ts', 'app/api/demeter/speak/route.ts'],
    stack: ['Next.js 14', 'OpenAI GPT-4o', 'Sanity'],
    envVarsNeeded: ['OPENAI_API_KEY', 'NEXT_PUBLIC_SANITY_PROJECT_ID'],
  },
];

export const FREE_TURNS_PER_DAY = 5;
export const FREE_MAX_SESSIONS_PER_DAY = 1;
