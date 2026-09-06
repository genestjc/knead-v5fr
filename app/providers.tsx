"use client";

import { ThirdwebProvider, AutoConnect } from "thirdweb/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from 'sonner';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { useState } from 'react';
import { client, activeChain } from '@/thirdweb-client';
import { wallets } from '@/lib/wallets';
import { MemberSessionSync } from '@/components/member-session-sync';

// TownsSyncProvider used to wrap the whole app from here. It is loaded with
// `ssr: false` (lru-cache v11's top-level await cascades through the Towns SDK
// import chain and turns the provider into a Promise → React error #306), and
// `ssr: false` means the server renders the `loading` fallback in place of the
// component AND its children. The fallback was written to pass children
// through, but `next/dynamic` hands `loading` only { error, isLoading,
// pastDelay } — so it rendered nothing, and every page in the app was missing
// from the served HTML. Browsers hydrated and looked fine; crawlers that do not
// run JavaScript got a title and nothing else.
//
// It now lives in components/towns-boundary.tsx, mounted from app/chat/layout
// where the Towns hooks actually are. See that file for the full account.

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <ErrorBoundary>
      <MiniKitProvider apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} chain={base}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {/*
            Single ThirdwebProvider for the whole app. (There used to be a second,
            nested one inside <WalletProvider>; two connection managers could
            desync the active-wallet state and make transient drops more likely.)
          */}
          <ThirdwebProvider>
            {/*
              Persistent, silent auto-reconnect. Previously the only reconnect
              logic lived inside <ConnectButton>, which is mounted ONLY on the
              sign-in screen — so a transient wallet drop while in chat (e.g. the
              desktop MetaMask extension hiccupping during a signature) bounced
              the user back to sign-in and remounted the whole chat/Towns session.
              Mounting AutoConnect at the root reconnects the same wallet in place.
            */}
            {/* chain is REQUIRED: the inAppWallet uses EIP-7702 execution mode,
                which needs a chain at (auto)connect time — without it AutoConnect
                fails with "Chain is required for EIP-7702 execution" and breaks the
                Google/email redirect login. */}
            <AutoConnect client={client} wallets={wallets} chain={activeChain} timeout={15000} />
            <MemberSessionSync />
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem={false}
              disableTransitionOnChange
            >
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
            </ThemeProvider>
          </ThirdwebProvider>
        </WagmiProvider>
      </QueryClientProvider>
      </MiniKitProvider>
    </ErrorBoundary>
  );
}
