import { townsEnv } from '@towns-protocol/sdk';

// ✅ Pass RPC URL directly to townsEnv (works at module load time)
export const TOWNS_CONFIG = townsEnv({
  env: {
    BASE_MAINNET_RPC_URL: 'https://8453.rpc.thirdweb.com',
  }
}).makeTownsConfig('omega');

// ✅ Keep this for the connect() call (uses your full ThirdWeb URL with client ID)
export function getTownsConfigWithRpc() {
  const customRpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL; // Your full ThirdWeb URL
  
  if (!customRpcUrl) {
    console.log('🔗 Using public ThirdWeb RPC');
    return TOWNS_CONFIG;
  }
  
  console.log('🔗 Using custom RPC:', customRpcUrl);
  
  return {
    ...TOWNS_CONFIG,
    base: {
      ...TOWNS_CONFIG.base,
      rpcUrl: customRpcUrl, // Your authenticated endpoint
    },
  };
}
