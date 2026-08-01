'use client';

/**
 * /probatio-parsley — Knead's internal AI evaluation console.
 *
 * Gated on a connected wallet, exactly like /admin. The gate here is only the
 * front door: every /api/probatio/* call is independently verified server-side
 * against a wallet signature, so a wallet that isn't an admin can open this
 * page but can't read or write anything.
 */
import { useEffect, useState } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus, ConnectButton } from 'thirdweb/react';
import { base } from 'thirdweb/chains';
import { client } from '@/thirdweb-client';
import { createKneadWallets } from '@/lib/wallets';
import { PROBATIO_DEMO_MODE } from '@/lib/eval/demo-mode';
import { ProbatioConsole } from '@/components/probatio/ProbatioConsole';

export const dynamic = 'force-dynamic';

export default function ProbatioParsleyPage() {
  const account = useActiveAccount();

  // The root <AutoConnect> restores the wallet on load. While that's in flight
  // `account` is null — showing the gate then would make every reload look
  // like a sign-out. Same handling as /admin.
  const connectionStatus = useActiveWalletConnectionStatus();
  const [autoConnectSettled, setAutoConnectSettled] = useState(false);
  useEffect(() => {
    if (connectionStatus === 'connected' || connectionStatus === 'disconnected') {
      setAutoConnectSettled(true);
    }
  }, [connectionStatus]);

  // Built on mount so the in-app wallet's OAuth redirect returns here.
  const [wallets] = useState(() => createKneadWallets());

  // Demo mode: skip the wallet gate entirely and hand the console a null
  // account, which makes its API calls go out unsigned. See lib/eval/demo-mode.ts.
  if (PROBATIO_DEMO_MODE) {
    return <ProbatioConsole account={null} />;
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
            Knead · AI evaluation
          </p>
          <h1 className="font-adonis text-5xl mb-4">Probatio Parsley</h1>
          <p className="font-georgia-pro text-lg text-gray-600 mb-8">
            Connect your admin wallet to set rubrics and run evaluations.
          </p>
          <div className="flex justify-center">
            <ConnectButton client={client} chain={base} wallets={wallets} theme="light" />
          </div>
        </div>
      </div>
    );
  }

  return <ProbatioConsole account={account} />;
}
