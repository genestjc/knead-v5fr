import { townsEnv } from '@towns-protocol/sdk';
import { getAllRpcEndpoints } from '@/thirdweb-client';

const AVAILABLE_RPCS = getAllRpcEndpoints();
const BASE_RPC = AVAILABLE_RPCS[Math.floor(Math.random() * AVAILABLE_RPCS.length)];

const townsEnvWithRpc = townsEnv({
  env: {
    BASE_MAINNET_RPC_URL: BASE_RPC,
  }
});

export const TOWNS_CONFIG = townsEnvWithRpc.makeTownsConfig('omega');
