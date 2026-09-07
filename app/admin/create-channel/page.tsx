'use client';

/**
 * /admin/create-channel — create a channel in the Knead space.
 *
 * Built because a stream can outlive the nodes assigned to it. Our main
 * channel's stream was allocated, at creation, to a set of nodes that included
 * one operated by Figment. That operator left the network and its host stopped
 * resolving, but the stream still lists it as a replica, so every write has to
 * reach a machine that no longer exists and fails with DOWNSTREAM_NETWORK_ERROR.
 * Re-allocating an existing stream needs River DAO participation; creating a
 * new channel does not, and a new stream is allocated across whichever nodes
 * are operational now.
 *
 * The signing model is the point of this page. Channel creation is a space-
 * owner operation, and the obvious implementation — a server route holding
 * SPACE_OWNER_PRIVATE_KEY — makes any auth bug on /api/admin/* equivalent to
 * handing over the space. So nothing is signed on the server: the owner
 * connects their own wallet and signs in the browser, exactly as the chat
 * client already does for joinSpace. There is no key to leak here because
 * there is no key here.
 *
 * Temporary by intent. Delete it once the channel is cut over.
 */
import { useEffect, useRef, useState } from 'react';
import { useActiveAccount, useActiveWalletConnectionStatus, ConnectButton } from 'thirdweb/react';
import { useCreateChannel, useAgentConnection } from '@towns-protocol/react-sdk';
import { client, activeChain } from '@/thirdweb-client';
import { createKneadWallets } from '@/lib/wallets';
import { createTownsSigner } from '@/lib/towns-signer-adapter';
import { TownsBoundary } from '@/components/towns-boundary';

const SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

export const dynamic = 'force-dynamic';

export default function CreateChannelPage() {
  // Towns hooks need the sync provider, which lives at /chat rather than the
  // root (see components/towns-boundary.tsx) — mount it for this page too.
  return (
    <TownsBoundary>
      <CreateChannelConsole />
    </TownsBoundary>
  );
}

function CreateChannelConsole() {
  const account = useActiveAccount();
  const connectionStatus = useActiveWalletConnectionStatus();
  const [wallets] = useState(() => createKneadWallets());
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (connectionStatus === 'connected' || connectionStatus === 'disconnected') setSettled(true);
  }, [connectionStatus]);

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

  return <Creator address={account.address} />;
}

function Creator({ address }: { address: string }) {
  const account = useActiveAccount();
  const { connect: connectAgent, isAgentConnected } = useAgentConnection();
  const { createChannel } = useCreateChannel(SPACE_ID ?? '');

  const signerRef = useRef<any>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);

  async function ensureSigner() {
    if (!signerRef.current && account) {
      signerRef.current = await createTownsSigner(account, client, activeChain);
    }
    return signerRef.current;
  }

  async function handleConnect() {
    setError(null);
    setBusy('Connecting to Towns…');
    try {
      const signer = await ensureSigner();
      await connectAgent(signer, {
        ...(SPACE_ID ? { highPriorityStreamIds: [SPACE_ID] } : {}),
      });
    } catch (err: any) {
      setError(err?.message ?? 'Could not connect to Towns.');
    } finally {
      setBusy(null);
    }
  }

  async function handleCreate() {
    setError(null);
    setChannelId(null);
    if (!name.trim()) return setError('Give the channel a name.');
    setBusy('Creating the channel — approve the transaction in your wallet…');
    try {
      const signer = await ensureSigner();
      const result: any = await createChannel(name.trim(), signer);
      // The SDK returns the new stream/channel id; shapes have varied across
      // versions, so accept the common ones rather than assuming one.
      const id =
        typeof result === 'string' ? result : result?.channelId ?? result?.streamId ?? result?.id ?? null;
      setChannelId(id);
      if (!id) setError('Channel created, but no id came back — check the space in the Towns app.');
    } catch (err: any) {
      setError(err?.message ?? 'Channel creation failed.');
    } finally {
      setBusy(null);
    }
  }

  if (!SPACE_ID) {
    return (
      <Shell>
        <p className="text-red-700">
          NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID is not set, so there is no space to create a channel in.
        </p>
      </Shell>
    );
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

      {!isAgentConnected ? (
        <button
          onClick={handleConnect}
          disabled={Boolean(busy)}
          className="px-5 py-2.5 rounded bg-black text-white text-sm font-medium disabled:opacity-40"
        >
          {busy ?? 'Connect to Towns'}
        </button>
      ) : (
        <>
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
        </>
      )}

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
    </Shell>
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
