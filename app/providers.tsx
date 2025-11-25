"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { TownsSyncProvider } from "@towns-protocol/react-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider>
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
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
