'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TownsSyncProvider } from '@towns-protocol/react-sdk';
import { wagmiConfig } from '@/lib/wagmi';

// Create a new QueryClient instance
const queryClient = new QueryClient();

// This component wraps its children with ALL the necessary providers for the setup page.
export function WagmiTownsSetupProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* By placing TownsSyncProvider inside, we ensure wagmi is ready first */}
        <TownsSyncProvider>{children}</TownsSyncProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
