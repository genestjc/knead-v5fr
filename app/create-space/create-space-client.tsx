'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { viemAdapter } from 'thirdweb/adapters/viem';
import { useAgentConnection } from '@towns-protocol/react-sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2 } from 'lucide-react';
import { ethers } from 'ethers-v5';
import type { WalletClient } from 'viem';
import { townsEnv } from '@towns-protocol/sdk';

// Helper to convert Viem WalletClient to Ethers v5 Signer
function walletClientToSigner(walletClient:  WalletClient) {
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
  const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  const [isCreating, setIsCreating] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleConnectAndCreateSpace = async () => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setIsCreating(true);
    setResponse(null);

    try {
      console.log('🚀 Connecting to Towns.. .');

      // Convert wallet to signer (matching your chat-test pattern)
      const viemWalletClient = viemAdapter. wallet. toViem({ 
        wallet, 
        client, 
        chain: activeChain 
      });
      const signer = await walletClientToSigner(viemWalletClient);
      
      const address = await signer.getAddress();
      console.log('✅ Wallet:', address);

      // Get Towns config
      const townsConfig = townsEnv().makeTownsConfig('omega');
      console.log('✅ Towns config created');

      // Connect to Towns using the React SDK hook
      if (! isAgentConnected) {
        console.log('🔄 Connecting to Towns agent...');
        await connect({ signer });
        console.log('✅ Connected to Towns agent');
      }

      // Now we need to create the space via API or contract
      // The Towns SDK might not have a direct "createSpace" method
      // Let's call your existing API route instead
      
      console.log('🔄 Creating space via API...');
      const apiResponse = await fetch('/api/towns/create-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'Knead Magazine',
        }),
      });

      const data = await apiResponse.json();
      
      if (! data.success) {
        throw new Error(data.error || 'API request failed');
      }

      console.log('✅ Space created via API:', data);

      setResponse({
        success: true,
        spaceId: data.spaceId,
        defaultChannelId: data.defaultChannelId,
        transactionHash: data.transactionHash,
        explorerUrl: data.explorerUrl,
      });

    } catch (error:  any) {
      console.error('❌ Error:', error);
      
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
      await navigator.clipboard. writeText(text);
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
            <CardContent className="space-y-2">
              <p className="font-mono text-sm break-all">{wallet.getAccount()?. address}</p>
              {isAgentConnected && (
                <p className="text-xs text-green-600">✅ Connected to Towns</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Action Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="font-adonis text-2xl">Create Space</CardTitle>
            <CardDescription className="font-georgia-pro">
              Using your Engine wallet via API (no gas cost to you)
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
                  onClick={handleConnectAndCreateSpace}
                  disabled={isCreating || isAgentConnecting}
                  className="w-full py-6 text-lg font-georgia-pro"
                  size="lg"
                >
                  {isCreating || isAgentConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {isAgentConnecting ? 'Connecting to Towns...' : 'Creating Space...'}
                    </>
                  ) : (
                    'Create Knead Space'
                  )}
                </Button>

                {(isCreating || isAgentConnecting) && (
                  <Alert>
                    <AlertDescription className="font-georgia-pro">
                      {isAgentConnecting 
                        ? 'Connecting to Towns Protocol.. .' 
                        : 'Creating space via Engine wallet...'}
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
              {/* Transaction Hash */}
              {response.transactionHash && (
                <div className="space-y-2">
                  <p className="font-georgia-pro font-semibold">Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">
                      {response.transactionHash}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(response.transactionHash, 'txHash')}
                    >
                      {copiedField === 'txHash' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {response.explorerUrl && (
                    <a
                      href={response.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View on BaseScan →
                    </a>
                  )}
                </div>
              )}

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
                    {copiedField === 'spaceId' ?  <CheckCircle className="h-4 w-4" /> :  <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Default Channel ID */}
              <div className="space-y-2">
                <p className="font-georgia-pro font-semibold">Default Channel ID</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">
                    {response.defaultChannelId}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(response.defaultChannelId, 'channelId')}
                  >
                    {copiedField === 'channelId' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded border mt-4">
                <p className="font-georgia-pro font-semibold mb-2">Add to . env. local: </p>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1 break-all">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={response.spaceId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${response.spaceId}`, 'env1')}
                    >
                      {copiedField === 'env1' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1 break-all">NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={response.defaultChannelId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${response.defaultChannelId}`, 'env2')}
                    >
                      {copiedField === 'env2' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-3">
                  After adding these, restart your dev server and go to /chat-test
                </p>
              </div>
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
                      <pre className="text-xs overflow-auto max-h-40 bg-gray-50 p-2 rounded">
                        {response.details}
                      </pre>
                    </>
                  )}
                </AlertDescription>
              </Alert>
              <Button onClick={handleConnectAndCreateSpace} className="w-full" variant="destructive">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
