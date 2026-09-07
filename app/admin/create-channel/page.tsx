'use client';

/**
 * /admin/create-channel — create a channel in the Knead space.
 *
 * Built because a stream can outlive the nodes assigned to it. Our main
 * channel's stream was allocated, at creation, to a node set that included one
 * operated by Figment. That operator left the network and its host stopped
 * resolving, but the stream still lists it as a replica, so every write has to
 * reach a machine that no longer exists and fails with DOWNSTREAM_NETWORK_ERROR.
 * Re-allocating an existing stream needs River DAO participation; creating a
 * new channel does not, and a new stream is allocated across whichever nodes
 * are operational now.
 *
 * The signing model is the point. Channel creation is a space-owner operation,
 * and the obvious implementation — a server route holding
 * SPACE_OWNER_PRIVATE_KEY — makes any auth bug on /api/admin/* equivalent to
 * handing over the space. So nothing is signed on the server: the owner
 * connects their own wallet and signs in the browser, exactly as the chat
 * client already does for joinSpace. There is no key to leak here because
 * there is no key here.
 *
 * The component split is load-bearing, not stylistic. Towns hooks that need a
 * SyncAgent — useCreateChannel among them — throw when called before the agent
 * connects, which is why app/chat/chat-client.tsx keeps its outer component
 * free of them and puts the rest in connected-chat. The first version of this
 * page called useCreateChannel at mount and hit exactly that: the whole page
 * threw into the root ErrorBoundary before rendering. Only useAgentConnection
 * is safe pre-connection; everything else waits for isAgentConnected.
 *
 * Temporary by intent. Delete it once the channel is cut over.
 */
import { useEffect, useRef, useState } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus, ConnectButton } from 'thirdweb/react';
import { useCreateChannel, useAgentConnection } from '@towns-protocol/react-sdk';
import type { Signer } from 'ethers';
import { client, activeChain } from '@/thirdweb-client';
import { createKneadWallets } from '@/lib/wallets';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { TOWNS_CONFIG } from '@/lib/towns-config';
import { TownsBoundary } from '@/components/towns-boundary';

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

export const dynamic = 'force-dynamic';

export default function CreateChannelPage() {
  // Towns hooks need the sync provider, which lives at /chat rather than the
  // root (see components/towns-boundary.tsx) — mount it for this page too.
  return (
    <TownsBoundary>
      <WalletGate />
    </TownsBoundary>
  );
}

/** Wallet gate. Calls no SDK hooks at all. */
function WalletGate() {
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const [wallets] = useState(() => createKneadWallets());
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'connected' || connectionStatus === 'disconnected') setSettled(true);
  }, [connectionStatus]);

  if (!SPACE_ID) {
    return (
      <Shell>
        <p className="text-red-700">
          NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID is not set, so there is no space to create a channel in.
        </p>
      </Shell>
    );
  }

  if (!account) {
    if (!settled && (connectionStatus === 'connecting' || connectionStatus === 'unknown')) {
      return <Shell><p className="text-gray-500">Restoring wallet…</p></Shell>;
    }
    return (
      <Shell>
        <p className="mb-6 text-gray-700">
          Connect the wallet that owns the space. Nothing is signed on the server — the channel is
          created with your connected wallet.
        </p>
        <ConnectButton client={client} wallets={wallets} chain={activeChain} />
      </Shell>
    );
  }

  return <AgentGate address={account.address} />;
}

/**
 * Connects the Towns agent. useAgentConnection is the one hook safe to call
 * before a SyncAgent exists — see the note at the top of this file.
 */
function AgentGate({ address }: { address: string }) {
  const account = useActiveAccount();
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();

  const signerRef = useRef<Signer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureSigner(): Promise<Signer> {
    if (!signerRef.current) {
      if (!account) throw new Error('Wallet disconnected.');
      signerRef.current = await createTownsSigner(account, client, activeChain);
    }
    return signerRef.current;
  }

  async function handleConnect() {
    setError(null);
    setBusy('Connecting to Towns…');
    try {
      const signer = await ensureSigner();
      // townsConfig is required. Without it the SDK dereferences an undefined
      // config and fails with "Cannot read properties of undefined (reading
      // 'base')" — the same reason both connect calls in chat-client pass it.
      await connectAgent(signer, {
        townsConfig: TOWNS_CONFIG,
        highPriorityStreamIds: [SPACE_ID!],
      });
    } catch (err: any) {
      setError(err?.message ?? 'Could not connect to Towns.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Shell>
      <p className="mb-1 text-[13px] text-gray-500 font-mono break-all">owner wallet: {address}</p>
      <p className="mb-6 text-[13px] text-gray-500 font-mono break-all">space: {SPACE_ID}</p>

      {error && (
        <div className="mb-6 border border-red-300 bg-red-50 rounded px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {isAgentConnected ? (
        <ChannelForm ensureSigner={ensureSigner} />
      ) : (
        <button
          onClick={handleConnect}
          disabled={Boolean(busy)}
          className="px-5 py-2.5 rounded bg-black text-white text-sm font-medium disabled:opacity-40"
        >
          {busy ?? 'Connect to Towns'}
        </button>
      )}
    </Shell>
  );
}

/**
 * Only mounted once the agent is connected, because useCreateChannel needs the
 * SyncAgent and throws without one.
 */
function ChannelForm({ ensureSigner }: { ensureSigner: () => Promise<Signer> }) {
  const { createChannel } = useCreateChannel(SPACE_ID!);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setChannelId(null);
    if (!name.trim()) return setError('Give the channel a name.');
    setBusy('Creating — approve the transaction in your wallet…');
    try {
      const signer = await ensureSigner();
      // createChannel resolves to the new channel id.
      const id = await createChannel(name.trim(), signer);
      setChannelId(id);
    } catch (err: any) {
      setError(err?.message ?? 'Channel creation failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && (
        <div className="mb-6 border border-red-300 bg-red-50 rounded px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <label className="block text-[11px] uppercase tracking-[0.16em] text-gray-500 mb-2">
        Channel name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="general"
        disabled={Boolean(busy)}
        className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:border-black"
      />
      <button
        onClick={handleCreate}
        disabled={Boolean(busy) || !name.trim()}
        className="px-5 py-2.5 rounded bg-black text-white text-sm font-medium disabled:opacity-40"
      >
        {busy ?? 'Create channel'}
      </button>

      {channelId && (
        <div className="mt-8 border border-green-300 bg-green-50 rounded px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-green-800 mb-2">Channel created</p>
          <p className="font-mono text-[13px] break-all mb-4">{channelId}</p>
          <p className="text-sm text-green-900 mb-2">
            Send a test message in it before changing any environment variable — if this stream also
            drew a bad allocation you want to find out now, not after a deploy. Then set:
          </p>
          <ul className="text-[13px] font-mono space-y-1 text-green-900">
            <li>Vercel · NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID</li>
            <li>Render · TOWNS_AGENT_CHANNEL_ID</li>
            <li>key-sharer repo · its channel id</li>
          </ul>
        </div>
      )}
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="font-adonis text-4xl mb-2">Create a channel</h1>
        <p className="font-georgia-pro text-gray-600 mb-10">
          Temporary tool. Signs with your connected wallet, never with a server key. Delete this page
          once the new channel is live.
        </p>
        {children}
      </div>
    </main>
  );
}
