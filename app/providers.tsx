"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider } from "@/components/wallet-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from 'sonner'; // ✅ Add Sonner for toast notifications
import dynamic from 'next/dynamic';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { useState } from 'react';

// Loaded dynamically (client-only) so that lru-cache v11's top-level await in its
// ESM bundle does NOT cascade through the Towns SDK import chain and turn
// TownsSyncProvider into a Promise → React error #306.
const TownsSyncProvider = dynamic(
  () => import('@towns-protocol/react-sdk').then((m) => m.TownsSyncProvider),
  { ssr: false, loading: ({ children }: any) => <>{children}</> }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
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
                      
                      {/* ✅ Sonner Toaster for admin actions - configured for mobile */}
                      <SonnerToaster 
                        position="top-center"
                        expand={true}
                        richColors
                        closeButton
                        toastOptions={{
                          style: {
                            marginTop: '80px', // Below fixed header
                          },
                          className: 'font-georgia-pro',
                          duration: 6000,
                        }}
                      />
                    </TooltipProvider>
                  </MembershipProvider>
                </WalletProvider>
              </ThemeProvider>
            </TownsSyncProvider>
          </ThirdwebProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
