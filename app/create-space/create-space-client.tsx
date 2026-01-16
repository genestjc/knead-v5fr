'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2 } from 'lucide-react';

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
      console.log('🚀 Creating space via API (Engine wallet pays gas)...');

      // Just call the API - no Towns SDK needed for creation
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

      console.log('✅ Space created:', data);

      setResponse({
        success: true,
        spaceId: data.spaceId,
        defaultChannelId: data.defaultChannelId,
        transactionHash: data.transactionHash,
        explorerUrl: data.explorerUrl,
        serverWallet: data.serverWallet,
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
            Deploy your Towns Protocol space on Base
          </p>
        </div>

        {/* Wallet Connection */}
        {wallet && (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="font-georgia-pro text-sm">Connected Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-mono text-sm break-all">{wallet.getAccount()?. address}</p>
              <p className="text-xs text-gray-500 mt-1">Logged in (no gas required from your wallet)</p>
            </CardContent>
          </Card>
        )}

        {/* Action Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="font-adonis text-2xl">Create Space</CardTitle>
            <CardDescription className="font-georgia-pro">
              Your Engine wallet will deploy the space contract.  No gas cost to you. 
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
                      Deploying space contract on Base.  This may take 30-60 seconds... 
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
                      className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
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
              {response.defaultChannelId && (
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
              )}

              {/* Server Wallet */}
              {response.serverWallet && (
                <div className="space-y-2">
                  <p className="font-georgia-pro font-semibold">Deployed By (Engine Wallet)</p>
                  <code className="block bg-white p-3 rounded border font-mono text-xs break-all">
                    {response.serverWallet}
                  </code>
                </div>
              )}

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded border mt-4">
                <p className="font-georgia-pro font-semibold mb-3">📋 Next Steps: </p>
                <ol className="list-decimal list-inside space-y-2 text-sm font-georgia-pro mb-4">
                  <li>Copy the environment variables below</li>
                  <li>Add to <code className="bg-gray-200 px-1 rounded">.env. local</code></li>
                  <li>Restart dev server:  <code className="bg-gray-200 px-1 rounded">npm run dev</code></li>
                  <li>Go to <code className="bg-gray-200 px-1 rounded">/chat-test</code> to test</li>
                </ol>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between gap-4 bg-white p-2 rounded">
                    <code className="flex-1 break-all">NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={response.spaceId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${response.spaceId}`, 'env1')}
                    >
                      {copiedField === 'env1' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  {response.defaultChannelId && (
                    <div className="flex items-center justify-between gap-4 bg-white p-2 rounded">
                      <code className="flex-1 break-all">NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={response. defaultChannelId}</code>
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
            </CardContent>
          </Card>
        )}

        {/* Error Response */}
        {response && ! response.success && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl text-red-700">Error Creating Space</CardTitle>
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
