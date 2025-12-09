'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CreateSpaceResponse {
  success: boolean;
  transactionHash?: string;
  spaceId?: string;
  defaultChannelId?: string;
  explorerUrl?: string;
  error?: string;
  details?: string;
}

export default function CreateSpaceClientComponent() {
  const wallet = useActiveWallet();
  const router = useRouter();
  
  const [isCreating, setIsCreating] = useState(false);
  const [response, setResponse] = useState<CreateSpaceResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreateSpace = async () => {
    setIsCreating(true);
    setResponse(null);

    try {
      const res = await fetch('/api/towns/create-space', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Knead Space',
        }),
      });

      const data: CreateSpaceResponse = await res.json();
      setResponse(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResponse({
        success: false,
        error: 'Failed to create space',
        details: errorMessage,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRedirectToChat = () => {
    router.push('/chat-test');
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-adonis text-5xl">Create Knead Space</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            Set up your Towns Protocol space for Knead chat
          </p>
        </div>

        {/* Wallet Connection Status */}
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

        {/* Main Action Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="font-adonis text-2xl">Space Creation</CardTitle>
            <CardDescription className="font-georgia-pro">
              Click the button below to create a new Towns Protocol space for Knead.
              This will deploy a smart contract transaction on Base.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!wallet ? (
              <div className="space-y-4 text-center">
                <p className="font-georgia-pro text-gray-600">
                  Please connect your wallet to create a space.
                </p>
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
                      Transaction is being processed on Base. This may take a minute...
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Success Response */}
        {response && response.success && (
          <>
            <Card className="border-2 border-green-500 bg-green-50">
              <CardHeader>
                <CardTitle className="font-adonis text-2xl flex items-center gap-2">
                  <CheckCircle className="text-green-600" />
                  Space Created Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Transaction Hash */}
                <div className="space-y-2">
                  <p className="font-georgia-pro font-semibold">Transaction Hash</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white p-3 rounded border font-mono text-sm break-all">
                      {response.transactionHash}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(response.transactionHash!, 'txHash')}
                    >
                      {copiedField === 'txHash' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {response.explorerUrl && (
                    <a
                      href={response.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:underline font-georgia-pro"
                    >
                      View on BaseScan <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>

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
                      onClick={() => handleCopy(response.spaceId!, 'spaceId')}
                    >
                      {copiedField === 'spaceId' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
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
                      onClick={() => handleCopy(response.defaultChannelId!, 'channelId')}
                    >
                      {copiedField === 'channelId' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Redirect Button */}
                <Button
                  onClick={handleRedirectToChat}
                  className="w-full py-6 text-lg font-georgia-pro"
                  variant="default"
                >
                  Go to Chat Test
                </Button>
              </CardContent>
            </Card>

            {/* Environment Variables */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="font-adonis text-2xl">Environment Variables</CardTitle>
                <CardDescription className="font-georgia-pro">
                  Add these to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file and restart your development server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="bg-gray-50 p-4 rounded border font-mono text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <code>NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID={response.spaceId}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${response.spaceId}`, 'envSpace')}
                      >
                        {copiedField === 'envSpace' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <code>NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={response.defaultChannelId}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${response.defaultChannelId}`, 'envChannel')}
                      >
                        {copiedField === 'envChannel' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertDescription className="font-georgia-pro space-y-2">
                    <p className="font-semibold">Deployment Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Copy the environment variables above</li>
                      <li>Add them to your <code className="bg-gray-100 px-1 rounded">.env.local</code> file</li>
                      <li>Restart your development server (<code className="bg-gray-100 px-1 rounded">npm run dev</code>)</li>
                      <li>For production, add these to your Vercel environment variables</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </>
        )}

        {/* Error Response */}
        {response && !response.success && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl text-red-700">
                Error Creating Space
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-white">
                <AlertDescription className="font-georgia-pro space-y-2">
                  <p className="font-semibold text-red-700">Error:</p>
                  <p>{response.error}</p>
                  {response.details && (
                    <>
                      <p className="font-semibold text-red-700">Details:</p>
                      <p className="text-sm">{response.details}</p>
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleCreateSpace}
                className="w-full font-georgia-pro"
                variant="destructive"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
