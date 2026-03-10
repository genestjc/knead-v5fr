import { townsEnv } from '@towns-protocol/sdk';

export const TOWNS_CONFIG = townsEnv({
  env: {
    BASE_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://8453.rpc.thirdweb.com',
  }
}).makeTownsConfig('omega');
