'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';

// This configuration is specifically for the Towns setup page.
export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  // Turn off multi-wallet discovery to avoid conflicts with thirdweb
  multiInjectedProviderDiscovery: false,
});
