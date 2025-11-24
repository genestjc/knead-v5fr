"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/thirdweb-client";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";

// Import the necessary providers for Towns Protocol
import { TownsSyncProvider } from "@towns-protocol/react-sdk";
import { WagmiConfig, createConfig } from "wagmi";
import { base } from 'viem/chains';
import { createPublicClient, http } from 'viem';

// Configure Wagmi as required by Towns SDK for wallet interactions
const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient: createPublicClient({
    chain: base,
    transport: http()
  }),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider client={client}>
        {/* WagmiConfig and TownsSyncProvider must wrap the rest of the app */}
        <WagmiConfig config={wagmiConfig}>
          <TownsSyncProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
              <WalletProvider>
                <MembershipProvider>
                  <TooltipProvider>
                    <ToastProvider>
                      <ErrorBoundary>
                        {children}
                      </ErrorBoundary>
                      <Toaster />
                    </ToastProvider>
                  </TooltipProvider>
                </MembershipProvider>
              </WalletProvider>
            </ThemeProvider>
          </TownsSyncProvider>
        </WagmiConfig>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
