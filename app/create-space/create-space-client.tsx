'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2 } from 'lucide-react';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { townsEnv } from '@towns-protocol/sdk';

// Helper to convert Viem WalletClient to Ethers v5 Signer
function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new ethers.providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account. address);
  return signer;
}

export default function CreateSpaceClientComponent() {
  const wallet = useActiveWallet();
  
  const [isCreating, setIsCreating] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreateSpace = async () => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setResponse(null);

    try {
      console.log('🚀 Initializing Towns SDK...');

      // Convert ThirdWeb wallet to Viem WalletClient
      const viemWalletClient = viemAdapter. wallet. toViem({ 
        wallet, 
        client, 
        chain: activeChain 
      });

      // Convert to Ethers v5 Signer (matching your chat-test pattern)
      const signer = await walletClientToSigner(viemWalletClient);
      
      const address = await signer.getAddress();
      console.log('✅ Wallet connected:', address);

      // Initialize Towns config (using omega environment)
      const townsConfig = townsEnv().makeTownsConfig('omega');
      console.log('✅ Towns config created');

      // Create agent using Towns SDK
      const agent = await townsConfig.createAgent({ signer });
      console.log('✅ Towns agent created');

      // Create space
      console.log('🔄 Creating space...');
      
      // Use the agent to create a space
      // Note: Check Towns SDK docs for exact createSpace API
      // This is the pattern based on their SDK structure
      const spaceResult = await agent.createSpace({
        name: 'Knead Magazine',
        // Add other config as needed per Towns docs
      });

      console.log('✅ Space created:', spaceResult);

      setResponse({
        success: true,
        spaceId: spaceResult. spaceId || spaceResult.id,
        streamId: spaceResult.streamId,
        defaultChannelId: spaceResult.spaceId || spaceResult.id,
        rawResult: spaceResult,
      });

    } catch (error:  any) {
      console.error('❌ Error creating space:', error);
      
      setResponse({
        success: false,
        error: error.message || 'Failed to create space',
        details: error.stack || JSON.stringify(error, null, 2),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-adonis text-5xl">Create Knead Space</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            Initialize your Towns Protocol space
          </p>
        </div>

        {/* Wallet Connection */}
        {wallet && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="font-georgia-pro text-sm">Connected Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm break-all">{wallet.getAccount()?.address}</p>
            </CardContent>
          </Card>
        )}

        {/* Action Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="font-adonis text-2xl">Create Space</CardTitle>
            <CardDescription className="font-georgia-pro">
              Using Towns Protocol SDK on Omega network
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {! wallet ? (
              <div className="space-y-4 text-center">
                <p className="font-georgia-pro text-gray-600">Connect wallet to continue</p>
                <ConnectButton client={client} chain={activeChain} />
              </div>
            ) : (
              <>
                <Button
                  onClick={handleCreateSpace}
                  disabled={isCreating}
                  className="w-full py-6 text-lg font-georgia-pro"
                  size="lg"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Space...
                    </>
                  ) : (
                    'Create Knead Space'
                  )}
                </Button>

                {isCreating && (
                  <Alert>
                    <AlertDescription className="font-georgia-pro">
                      Initializing Towns agent and creating space...
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Success Response */}
        {response && response.success && (
          <Card className="border-2 border-green-500 bg-green-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl flex items-center gap-2">
                <CheckCircle className="text-green-600" />
                Space Created Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Space ID */}
              <div className="space-y-2">
                <p className="font-georgia-pro font-semibold">Space ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">
                    {response.spaceId}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(response.spaceId, 'spaceId')}
                  >
                    {copiedField === 'spaceId' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Stream ID */}
              {response.streamId && (
                <div className="space-y-2">
                  <p className="font-georgia-pro font-semibold">Stream ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">
                      {response.streamId}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(response.streamId, 'streamId')}
                    >
                      {copiedField === 'streamId' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded border mt-4">
                <p className="font-georgia-pro font-semibold mb-2">Add to . env. local:</p>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={response.spaceId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${response.spaceId}`, 'env1')}
                    >
                      {copiedField === 'env1' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {response.defaultChannelId && (
                    <div className="flex items-center justify-between gap-4">
                      <code className="flex-1">NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={response. defaultChannelId}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${response.defaultChannelId}`, 'env2')}
                      >
                        {copiedField === 'env2' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw result for debugging */}
              <details className="text-xs">
                <summary className="cursor-pointer font-georgia-pro font-semibold">
                  View Raw Response (Debug)
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                  {JSON.stringify(response.rawResult, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Error Response */}
        {response && ! response.success && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl text-red-700">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-white">
                <AlertDescription className="font-georgia-pro space-y-2">
                  <p className="font-semibold text-red-700">Error: </p>
                  <p className="text-sm">{response.error}</p>
                  {response.details && (
                    <>
                      <p className="font-semibold text-red-700 mt-2">Details:</p>
                      <pre className="text-xs overflow-auto max-h-40">{response.details}</pre>
                    </>
                  )}
                </AlertDescription>
              </Alert>
              <Button onClick={handleCreateSpace} className="w-full" variant="destructive">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
