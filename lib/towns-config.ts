import { townsEnv } from '@towns-protocol/sdk';

// Get RPC URL from Next.js env
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 
                     process.env.NEXT_PUBLIC_BASE_RPC_URL;

export const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega');

// ✅ Export custom config with RPC override
export function getTownsConfigWithRpc() {
  if (!BASE_RPC_URL) {
    console.warn('⚠️ No custom RPC configured, using public Base RPC');
    return TOWNS_CONFIG;
  }
  
  return {
    ...TOWNS_CONFIG,
    base: {
      ...TOWNS_CONFIG.base,
      rpcUrl: BASE_RPC_URL,
    },
  };
}
