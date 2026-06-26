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
  sourceFiles: string[];
  stack: string[];
  envVarsNeeded: string[];
}

export const RECIPES: BuildRecipe[] = [
  {
    id: 'paywalled-blog',
    title: 'Paywalled Content',
    emoji: '🔒',
    description:
      'Own how your content is distributed to your community. Includes Sanity CMS with Stripe Element integration and membership gate. Free previews, premium full access.',
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
    id: 'free-blog',
    title: 'Custom Blog',
    emoji: '📝',
    description: "Don't want to charge at all? Take our custom stack for your own content. Includes Sanity CMS.",
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
    id: 'social-membership',
    title: 'Social Login',
    emoji: '🪪',
    description:
      'Make it easy for your fans to become members. Includes ThirdWeb wallet integration and summary snippets.',
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
    id: 'agentic-assistance',
    title: 'Agentic Assistance',
    emoji: '🤖',
    description:
      'Install an agent on your page for community management or to help summarize editorial content. Built with ChatGPT, Claude, Alchemy, and Tavily.',
    tags: ['OpenAI', 'Claude', 'Tavily'],
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
    description:
      'Create a video platform to stream your content. Built with Daily.co.',
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
      'Upload and schedule video content to distribute to your community. Built with Mux.',
    tags: ['Mux', 'Supabase'],
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
    description:
      'Create a group chat that\'s secure. Built with Towns Protocol.',
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
    title: 'End-To-End Encrypted Messaging',
    emoji: '🔐',
    description:
      'Create a platform where private conversations stay private. Built with Towns Protocol.',
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
      'Enable your community to get some face time in. Built with Daily.co.',
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
    id: 'asset-builder',
    title: 'Social Asset Studio',
    emoji: '🎨',
    description:
      "Copy/Paste Knead's internal tool for creating social posts. Upload an image, set your type, download a ready-to-post asset. Runs entirely in the browser — no API costs.",
    tags: [],
    sourceFiles: ['components/admin/socialassetstudio/index.tsx'],
    stack: ['Next.js 14', 'Canvas API', 'Tailwind CSS'],
    envVarsNeeded: [],
  },
  {
    id: 'membership-systems',
    title: 'Membership Systems',
    emoji: '⛓️',
    description:
      "Pull from Knead's custom smart contracts to design a membership that fits your community's needs.",
    tags: ['Thirdweb', 'NFT', 'Base'],
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
    description:
      "Dig through Knead's lean stack for pay-as-you-go solutions. Perfect for independent builders and small teams.",
    tags: ['Supabase', 'Vercel', 'Stripe'],
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
