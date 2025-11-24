"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider"; // Your existing Thirdweb wallet provider
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";

// Import the new Wagmi wrapper and the Towns provider
import { WagmiProviderWrapper } from "@/components/wagmi-provider"; 
import { TownsSyncProvider } from "@towns-protocol/react-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider>
        {/* WagmiProviderWrapper now provides the necessary context for useWalletClient */}
        <WagmiProviderWrapper>
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
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                    <Toaster />
                  </TooltipProvider>
                </MembershipProvider>
              </WalletProvider>
            </ThemeProvider>
          </TownsSyncProvider>
        </WagmiProviderWrapper>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
