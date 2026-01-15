'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';
import { Client as TownsClient } from '@towns-protocol/sdk';
import { makeSignerContext, makeCryptoStore, makeRpcClient } from '@towns-protocol/sdk';

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

      // Get Web3 provider and signer from ThirdWeb wallet
      const provider = new ethers.providers.Web3Provider(
        await wallet.getEthersProvider()
      );
      const signer = provider.getSigner();

      console.log('✅ Wallet connected:', await signer.getAddress());

      // Initialize Towns SDK Client
      const townsClient = new TownsClient({
        signerContext: await makeSignerContext(signer),
        rpcClient: makeRpcClient({ 
          env: 'omega', // Use 'omega' for testnet, 'prod' for mainnet
        }),
        cryptoStore: makeCryptoStore(),
      });

      console.log('✅ Towns client initialized');

      // Initialize user in Towns Protocol
      console.log('🔄 Initializing user.. .');
      await townsClient.initializeUser();
      console.log('✅ User initialized');

      // Create space
      console.log('🔄 Creating space...');
      const spaceResult = await townsClient.createSpace({
        spaceName: 'Knead Magazine',
        // Add other config as needed
      });

      console.log('✅ Space created! ', spaceResult);

      setResponse({
        success: true,
        spaceId: spaceResult.spaceId,
        streamId: spaceResult.streamId,
        defaultChannelId: spaceResult.spaceId, // Usually same as spaceId
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
            <CardTitle className="font-adonis text-2xl">Create Space with Towns SDK</CardTitle>
            <CardDescription className="font-georgia-pro">
              This uses the Towns Protocol SDK to create your space. 
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {! wallet ? (
              <div className="space-y-4 text-center">
                <p className="font-georgia-pro text-gray-600">Connect your wallet to continue</p>
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
                      Initializing Towns SDK and creating space...
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
                Space Created! 
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
                <p className="font-georgia-pro font-semibold mb-2">Add to . env. local: </p>
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
                </div>
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
                      <pre className="text-xs overflow-auto">{response.details}</pre>
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
