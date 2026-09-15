'use client';

/**
 * /social54 — Knead's social monitoring console.
 *
 * Gated on a connected wallet, exactly like /admin and /probatio-parsley. The
 * gate here is only the front door: every /api/social/* call is independently
 * verified server-side against a wallet signature, so a wallet that isn't an
 * admin can open this page but can't read or start anything.
 *
 * Unlike Probatio, the demo bypass is off by default — these routes read
 * through five social credentials and return unpublished editorial strategy.
 * See lib/social/demo-mode.ts.
 */
import { useEffect, useState } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus, ConnectButton } from 'thirdweb/react';
import { base } from 'thirdweb/chains';
import { client } from '@/thirdweb-client';
import { createKneadWallets } from '@/lib/wallets';
import { SOCIAL54_DEMO_MODE } from '@/lib/social/demo-mode';
import { SocialConsole } from '@/components/social54/SocialConsole';

export const dynamic = 'force-dynamic';

export default function Social54Page() {
  const account = useActiveAccount();

  // The root <AutoConnect> restores the wallet on load. While that's in flight
  // `account` is null — showing the gate then would make every reload look
  // like a sign-out. Same handling as /admin and /probatio-parsley.
  const connectionStatus = useActiveWalletConnectionStatus();
  const [autoConnectSettled, setAutoConnectSettled] = useState(false);
  useEffect(() => {
    if (connectionStatus === 'connected' || connectionStatus === 'disconnected') {
      setAutoConnectSettled(true);
    }
  }, [connectionStatus]);

  // Built on mount so the in-app wallet's OAuth redirect returns here.
  const [wallets] = useState(() => createKneadWallets());

  if (SOCIAL54_DEMO_MODE) {
    return <SocialConsole account={null} />;
  }

  if (!account) {
    if (!autoConnectSettled && (connectionStatus === 'connecting' || connectionStatus === 'unknown')) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black mx-auto mb-4" />
            <p className="font-georgia-pro text-gray-600">Connecting your wallet…</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-md">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 mb-3">
            Knead · social monitoring
          </p>
          <h1 className="font-adonis text-5xl mb-4">Social 54</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-8">
            Connect your admin wallet to read the field.
          </p>
          <div className="flex justify-center">
            <ConnectButton client={client} chain={base} wallets={wallets} theme="light" />
          </div>
        </div>
      </div>
    );
  }

  return <SocialConsole account={account} />;
}
