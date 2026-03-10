import { townsEnv } from '@towns-protocol/sdk';

// ✅ For Next.js client-side, the SDK checks VITE_ prefixed vars
// Set this in your .env.local:
// VITE_BASE_MAINNET_RPC_URL=your_thirdweb_or_alchemy_url

export const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');
