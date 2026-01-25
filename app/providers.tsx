"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { TownsSyncProvider } from "@towns-protocol/react-sdk";
import { useState, createContext, useContext } from "react";
import type { SyncAgent } from "@towns-protocol/sdk";

// ✅ Create context to expose setSyncAgent
export const TownsContext = createContext<{
  setSyncAgent: (agent: SyncAgent | undefined) => void;
}>({ 
  setSyncAgent: () => {} 
});

// ✅ Hook to use the context
export const useTownsContext = () => useContext(TownsContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [syncAgent, setSyncAgent] = useState<SyncAgent | undefined>();

  return (
    <ErrorBoundary>
      <ThirdwebProvider>
        <TownsContext.Provider value={{ setSyncAgent }}>
          <TownsSyncProvider 
            syncAgent={syncAgent}
            config={{
              onTokenExpired: () => {
                console.log('⚠️ Towns session expired, please reconnect');
                setSyncAgent(undefined);
              }
            }}
          >
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
          </TownsSyncProvider>
        </TownsContext.Provider>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
