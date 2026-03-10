import { townsEnv } from '@towns-protocol/sdk';
import { http } from 'viem';

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;

export const TOWNS_CONFIG = rpcUrl
  ? {
      ...townsEnv().makeTownsConfig('omega', { rpcUrl }),
      // ✅ Add custom transport to prevent rate limiting
      transport: http(rpcUrl, {
        timeout: 30_000,
        retryCount: 3,
        retryDelay: 1000,
      }),
    }
  : townsEnv().makeTownsConfig('omega');
