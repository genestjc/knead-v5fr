"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { TownsSyncProvider, connectUsingBearerToken, type SyncAgent } from "@towns-protocol/react-sdk";
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { useState, useEffect } from 'react';
import { getBearerToken, clearBearerToken } from '@/lib/towns-bearer-token-storage';
import { TOWNS_CONFIG } from '@/lib/towns-config';
import { useActiveWallet } from 'thirdweb/react';

function TownsProviderWithFastReconnect({ children }: { children: React.ReactNode }) {
  const [initialAgent, setInitialAgent] = useState<SyncAgent | undefined>();
  const wallet = useActiveWallet();

  useEffect(() => {
    // ✅ Re-run when wallet connects/changes
    const restoreWithBearerToken = async () => {
      const account = wallet?.getAccount();
      
      if (!account?.address) {
        // ✅ No wallet yet - just wait
        return;
      }

      // ✅ Only try once per wallet address
      if (initialAgent) return;

      const savedToken = getBearerToken(account.address);
      
      if (savedToken) {
        console.log('⚡ Fast reconnect: Using saved bearer token...');
        
        try {
          const agent = await connectUsingBearerToken(savedToken, {
            townsConfig: TOWNS_CONFIG,
          });
          
          console.log('✅ Reconnected instantly with bearer token - no signature needed!');
          setInitialAgent(agent);
          
        } catch (error: any) {
          console.warn('⚠️ Bearer token invalid or expired:', error.message);
          console.log('   User will need to sign in again');
          clearBearerToken();
        }
      } else {
        console.log('📝 No saved bearer token - new user or first visit');
      }
    };

    restoreWithBearerToken();
  }, [wallet, initialAgent]); // ✅ Re-run when wallet connects

  return (
    <TownsSyncProvider
      syncAgent={initialAgent}
      config={{
        onTokenExpired: () => {
          console.log('⚠️ Bearer token expired, clearing...');
          clearBearerToken();
          setInitialAgent(undefined);
        }
      }}
    >
      {children}
    </TownsSyncProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <ThirdwebProvider>
            <TownsProviderWithFastReconnect>
              <ThemeProvider
                attribute="class"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange
              >
                <WalletProvider>
                  <MembershipProvider>
                    <TooltipProvider>
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                      <Toaster />
                    </TooltipProvider>
                  </MembershipProvider>
                </WalletProvider>
              </ThemeProvider>
            </TownsProviderWithFastReconnect>
          </ThirdwebProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
