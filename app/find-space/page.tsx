'use client';

import { useState, useEffect } from 'react';
import { useAgentConnection, useSpace, useUserSpaces } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';
import { ethers } from 'ethers-v5';
import { useActiveAccount, useActiveWalletConnectionStatus } from 'thirdweb/react';
import { ThirdWebConnectButton } from '@/components/thirdweb-connect-button';

// Force dynamic rendering - disable static generation
export const dynamic = 'force-dynamic';

// Towns config
const townsConfig = townsEnv().makeTownsConfig('omega', {
  baseChainRpcUrl: 'https://mainnet.base.org'
});

function SpaceDetails({ spaceId }: { spaceId: string }) {
    const { data: space } = useSpace(spaceId);
    const defaultChannelId = space?.channelIds?.[0];

    if (!defaultChannelId) {
        return (
            <div className="text-center">
                <p className="font-georgia-pro text-yellow-700">Fetching channel details...</p>
            </div>
        );
    }

    return (
        <div className="mb-6 p-6 bg-white rounded-lg border-2 border-green-200">
            <h2 className="font-adonis text-2xl mb-4">Copy These to Vercel Environment Variables:</h2>

            <div className="mb-4">
                <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">Space ID:</label>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                    {spaceId}
                </div>
            </div>

            <div className="mb-4">
                <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-2">Default Channel ID:</label>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all border border-gray-300">
                    {defaultChannelId}
                </div>
            </div>

            <div className="mt-6 p-4 bg-gray-900 text-green-400 rounded font-mono text-xs overflow-x-auto">
                <div className="mb-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={spaceId}</div>
                <div>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={defaultChannelId}</div>
            </div>
        </div>
    );
}


export default function FindSpacePage() {
    const [mounted, setMounted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const account = useActiveAccount();
    const connectionStatus = useActiveWalletConnectionStatus();
    const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
    const { spaceIds, isLoading: isLoadingSpaces } = useUserSpaces();
    
    useEffect(() => {
        setMounted(true);
    }, []);
    
    useEffect(() => {
        if (!mounted || !account?.address || isAgentConnected || connectionStatus !== 'connected') return;
        const connectToTowns = async () => {
            try {
                if (!window.ethereum) return;
                console.log('🔌 Connecting to Towns Protocol...');
                const provider = new ethers.providers.Web3Provider(window.ethereum as any);
                const signer = provider.getSigner();
                await connect(signer, { townsConfig });
                console.log('✅ Connected to Towns Protocol');
            } catch (err: any) {
                console.error('❌ Towns connection error:', err);
                setError(`Connection failed: ${err.message}`);
            }
        };
        connectToTowns();
    }, [mounted, account?.address, connectionStatus, isAgentConnected, connect]);

    if (!mounted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            </div>
        );
    }

    if (!account?.address) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
                    <h1 className="font-adonis text-4xl mb-4">Find Your Space</h1>
                    <p className="font-georgia-pro text-lg mb-6 text-gray-600">Connect your Master Admin wallet to find your existing Knead Chat space.</p>
                    <ThirdWebConnectButton />
                </div>
            </div>
        );
    }

    if (!isAgentConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white p-4">
                <div className="max-w-2xl w-full bg-gray-50 rounded-lg p-8 text-center">
                    <h1 className="font-adonis text-3xl mb-4">Connecting to Towns Protocol...</h1>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="font-georgia-pro text-gray-600 mb-2">{isAgentConnecting ? 'Please sign the message in your wallet' : 'Initializing connection...'}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
            <div className="max-w-3xl w-full bg-gray-50 rounded-lg p-8">
                <div className="text-center mb-6">
                    <h1 className="font-adonis text-4xl mb-2">Find Your Space</h1>
                    <p className="font-georgia-pro text-gray-600">Looking for spaces owned by {account.address.slice(0, 6)}...{account.address.slice(-4)}</p>
                </div>

                {isLoadingSpaces && (
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                        <p className="font-georgia-pro text-gray-600">Searching for your spaces...</p>
                    </div>
                )}

                {!isLoadingSpaces && spaceIds.length > 0 && (
                    <>
                        <div className="text-center mb-4">
                            <h2 className="font-adonis text-2xl text-green-700">🎉 Space Found!</h2>
                            <p className="font-georgia-pro text-gray-600">Here are the details for your space.</p>
                        </div>
                        <SpaceDetails spaceId={spaceIds[0]} />
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-georgia-pro font-semibold mb-2">📝 Next Steps:</h3>
                            <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
                                <li>Go to your Vercel project settings and add these two environment variables.</li>
                                <li>Redeploy your application.</li>
                                <li>Your chat will be live at <code className="bg-blue-100 px-1 rounded">/chat-test</code></li>
                            </ol>
                        </div>
                    </>
                )}
                
                {!isLoadingSpaces && spaceIds.length === 0 && (
                    <div className="text-center my-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h2 className="font-adonis text-2xl text-yellow-800 mb-2">⚠️ No Spaces Found</h2>
                        <p className="font-georgia-pro text-yellow-900">
                            We couldn't find any Towns spaces associated with this wallet. Please ensure you are connected with the correct wallet that owns the Space NFT.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
