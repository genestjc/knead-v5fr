import { townsEnv } from '@towns-protocol/sdk';

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL;

export const TOWNS_CONFIG = rpcUrl
  ? townsEnv().makeTownsConfig('production', { rpcUrl })
  : townsEnv().makeTownsConfig('production');
