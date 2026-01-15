'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';

const SPACE_FACTORY_ADDRESS = '0x9978c826d93883701522d2ca645d5436e5654252';

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
      console.log('🚀 Creating space with wallet:', wallet.getAccount()?.address);

      // Get SpaceFactory contract
      const contract = getContract({
        client,
        chain: base,
        address: SPACE_FACTORY_ADDRESS,
      });

      // Prepare transaction
      const transaction = prepareContractCall({
        contract,
        method: "function createSpace(string name) returns (uint256)",
        params: ["Knead Magazine"],
      });

      console.log('📝 Transaction prepared, sending...');

      // Send transaction (YOUR wallet signs and pays)
      const receipt = await sendTransaction({
        transaction,
        account: wallet.getAccount()!,
      });

      console.log('✅ Transaction confirmed:', receipt. transactionHash);
      console.log('📋 Receipt:', receipt);

      // Extract spaceId from logs
      let spaceId = null;
      
      // The SpaceCreated event has signature: SpaceCreated(uint256 indexed spaceId, address indexed owner, string name)
      // Look for the event in logs
      if (receipt.logs && receipt.logs.length > 0) {
        for (const log of receipt.logs) {
          // The spaceId is the first indexed parameter (topics[1])
          if (log.topics && log.topics.length > 1) {
            // Convert from hex to decimal
            spaceId = BigInt(log.topics[1]).toString();
            console.log('🎉 Found spaceId:', spaceId);
            break;
          }
        }
      }

      if (! spaceId) {
        console.warn('⚠️ Could not extract spaceId from logs, using fallback');
        // If we can't parse it, at least show the transaction succeeded
        spaceId = 'Check transaction logs';
      }

      setResponse({
        success: true,
        transactionHash: receipt.transactionHash,
        spaceId:  spaceId,
        defaultChannelId: spaceId, // Towns uses spaceId as default channel
        explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        owner: wallet.getAccount()?.address,
      });

      console.log('✅ Space created successfully!');
      console.log('Space ID:', spaceId);
      console.log('Default Channel ID:', spaceId);

    } catch (error:  any) {
      console.error('❌ Error creating space:', error);
      
      setResponse({
        success: false,
        error: error.message || 'Failed to create space',
        details: error.reason || error.data?.message || 'Unknown error',
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
              <p className="font-mono text-sm break-all">{wallet.getAccount()?.address}</p>
              <p className="text-xs text-gray-500 mt-1">You will own this space</p>
            </CardContent>
          </Card>
        )}

        {/* Action Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="font-adonis text-2xl">Space Creation</CardTitle>
            <CardDescription className="font-georgia-pro">
              Click to deploy a Towns space.  You'll pay gas (~$1-3 on Base) and own the space.
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
                      Please confirm the transaction in your wallet, then wait for confirmation... 
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
                {/* Transaction */}
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
                  <a
                    href={response.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:underline font-georgia-pro text-sm"
                  >
                    View on BaseScan <ExternalLink className="h-4 w-4" />
                  </a>
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

                {/* Owner */}
                <div className="space-y-2">
                  <p className="font-georgia-pro font-semibold">Space Owner</p>
                  <code className="block bg-white p-3 rounded border font-mono text-sm break-all">
                    {response. owner}
                  </code>
                  <p className="text-xs text-gray-600">This is your wallet - you control the space</p>
                </div>
              </CardContent>
            </Card>

            {/* Environment Variables */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="font-adonis text-2xl">Next Steps</CardTitle>
                <CardDescription className="font-georgia-pro">
                  Add these to your <code className="bg-gray-100 px-1 rounded">. env. local</code> file
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 p-4 rounded border font-mono text-sm space-y-2">
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
                  <div className="flex items-center justify-between gap-4">
                    <code className="flex-1">NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID={response.defaultChannelId}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${response.defaultChannelId}`, 'env2')}
                    >
                      {copiedField === 'env2' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Alert>
                  <AlertDescription className="font-georgia-pro">
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Copy the environment variables above</li>
                      <li>Add to <code className="bg-gray-100 px-1 rounded">. env.local</code></li>
                      <li>Restart dev server:  <code className="bg-gray-100 px-1 rounded">npm run dev</code></li>
                      <li>Go to <code className="bg-gray-100 px-1 rounded">/chat-test</code> to test</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </>
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
                      <p className="text-sm">{response.details}</p>
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
