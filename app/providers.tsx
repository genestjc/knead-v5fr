"use client";

import { ThirdwebProvider, embeddedWallet } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { ErrorBoundary } from "@/components/error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { TownsSyncProvider } from "@towns/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ToastProvider>
        <ErrorBoundary>
          <ThirdwebProvider 
            clientId={process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID}
            supportedChains={[base]} 
            supportedWallets={[embeddedWallet()]}
          >
            <TownsSyncProvider>
              {children}
            </TownsSyncProvider>
          </ThirdwebProvider>
        </ErrorBoundary>
      </ToastProvider>
    </TooltipProvider>
  );
}
