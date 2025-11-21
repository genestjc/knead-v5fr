'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';

// --- START OF CHANGES ---

// 1. Get the Alchemy API key from environment variables
const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// 2. Log a warning if the key is missing, for easier debugging
if (!alchemyApiKey) {
  console.warn(
    "⚠️ NEXT_PUBLIC_ALCHEMY_API_KEY is not set. Using public RPC, which may fail."
  );
}

// 3. This configuration is specifically for the Towns setup page.
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    // 4. Use the reliable Alchemy RPC for Base if the key is available
    [base.id]: http(
      alchemyApiKey
        ? `https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
        : "https://mainnet.base.org" // Fallback to the public one
    ),
  },
  // Turn off multi-wallet discovery to avoid conflicts with thirdweb
  multiInjectedProviderDiscovery: false,
});
