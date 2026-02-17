"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { TownsSyncProvider, connectTowns, type SyncAgent } from "@towns-protocol/react-sdk";
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { useState, useEffect } from 'react';
import { getSignerContext, clearSignerContext } from '@/lib/towns-context-storage';
import { TOWNS_CONFIG } from '@/lib/towns-config';
import { useActiveWallet } from 'thirdweb/react';

function TownsProviderWithFastReconnect({ children }: { children: React.ReactNode }) {
  const [initialAgent, setInitialAgent] = useState<SyncAgent | undefined>();
  const [isCheckingContext, setIsCheckingContext] = useState(true);
  const wallet = useActiveWallet();

  useEffect(() => {
    // ✅ Try to restore saved context for instant reconnect
    const restoreSavedContext = async () => {
      const account = wallet?.getAccount();
      
      if (!account?.address) {
        setIsCheckingContext(false);
        return;
      }

      const savedContext = getSignerContext(account.address);
      
      if (savedContext) {
        console.log('⚡ Fast reconnect: Attempting to restore saved session...');
        
        try {
          const agent = await connectTowns(savedContext, {
            townsConfig: TOWNS_CONFIG,
          });
          
          console.log('✅ Session restored instantly - no signature needed!');
          setInitialAgent(agent);
          
        } catch (error: any) {
          console.warn('⚠️ Saved context invalid:', error.message);
          console.log('   User will need to sign in again');
          clearSignerContext();
        }
      } else {
        console.log('📝 No saved session found - new user or first visit');
      }
      
      setIsCheckingContext(false);
    };

    restoreSavedContext();
  }, [wallet]);

  // ✅ Show nothing while checking for saved context (prevents double connection attempts)
  if (isCheckingContext) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TownsSyncProvider
      syncAgent={initialAgent} // ✅ Pass pre-connected agent for returning users
      config={{
        onTokenExpired: () => {
          console.log('⚠️ Towns session expired, please reconnect');
          clearSignerContext();
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
