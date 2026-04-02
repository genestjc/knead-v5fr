import { townsEnv } from '@towns-protocol/sdk';

// Priority: Alchemy (dedicated) → ThirdWeb with client ID (authenticated) → public fallback
const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ||
  (process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
    ? `https://8453.rpc.thirdweb.com/${process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}`
    : 'https://mainnet.base.org');

export const TOWNS_CONFIG = townsEnv({
  env: {
    BASE_MAINNET_RPC_URL: BASE_RPC_URL,
  }
}).makeTownsConfig('omega');
