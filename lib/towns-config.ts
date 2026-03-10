import { townsEnv } from '@towns-protocol/sdk';

// ✅ Set RPC URL via environment variable BEFORE creating config
if (typeof window === 'undefined' && process.env.NEXT_PUBLIC_BASE_RPC_URL) {
  process.env.BASE_MAINNET_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL;
}

export const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');
