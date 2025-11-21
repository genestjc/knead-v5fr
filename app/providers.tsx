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
// Temporarily commented out until we have space created
// import { TownsSyncProvider } from "@towns-protocol/react-sdk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThirdwebProvider client={client}>
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
                  {/* TownsSyncProvider will be added after space creation */}
                  <ErrorBoundary>
                    {children}
                  </ErrorBoundary>
                  <Toaster />
                </ToastProvider>
              </TooltipProvider>
            </MembershipProvider>
          </WalletProvider>
        </ThemeProvider>
      </ThirdwebProvider>
    </ErrorBoundary>
  );
}
