'use client';

import React, { useState, useEffect } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { getContract, readContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { base } from 'thirdweb/chains';

const SPACE_NFT_CONTRACT = '0x.. .' // TODO: Get actual Space NFT contract address from Towns
const ENGINE_WALLET_ADDRESS = process.env.NEXT_PUBLIC_ENGINE_SERVER_WALLET_ADDRESS || '';

// Space NFT ABI (ERC721-like)
const SPACE_NFT_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" }
    ],
    name: "tokenOfOwnerByIndex",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type:  "uint256" }
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
];

interface SpaceNFT {
  tokenId: string;
  spaceId: string;
}

export default function CreateSpaceClientComponent() {
  const wallet = useActiveWallet();
  
  const [isChecking, setIsChecking] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [ownedSpaces, setOwnedSpaces] = useState<SpaceNFT[]>([]);
  const [response, setResponse] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Check for owned Space NFTs
  const checkOwnedSpaces = async () => {
    if (!wallet) return;

    setIsChecking(true);
    try {
      const userAddress = wallet.getAccount()?.address;
      if (!userAddress) return;

      console.log('🔍 Checking for Space NFTs owned by:', userAddress);

      const contract = getContract({
        client,
        chain: base,
        address: SPACE_NFT_CONTRACT,
        abi: SPACE_NFT_ABI,
      });

      // Get balance
      const balance = await readContract({
        contract,
        method: "function balanceOf(address owner) view returns (uint256)",
        params: [userAddress],
      });

      console.log('✅ Space NFT balance:', balance. toString());

      if (balance === 0n) {
        setOwnedSpaces([]);
        return;
      }

      // Get all token IDs
      const spaces:  SpaceNFT[] = [];
      for (let i = 0; i < Number(balance); i++) {
        const tokenId = await readContract({
          contract,
          method:  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
          params: [userAddress, BigInt(i)],
        });

        spaces.push({
          tokenId:  tokenId.toString(),
          spaceId: tokenId.toString(), // Space ID = Token ID
        });
      }

      console.log('✅ Found spaces:', spaces);
      setOwnedSpaces(spaces);

    } catch (error) {
      console.error('❌ Error checking spaces:', error);
      setOwnedSpaces([]);
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check when wallet connects
  useEffect(() => {
    if (wallet) {
      checkOwnedSpaces();
    }
  }, [wallet]);

  // Transfer Space NFT to Engine wallet
  const transferSpaceToEngine = async (tokenId: string) => {
    if (!wallet) return;

    setIsTransferring(true);
    setResponse(null);

    try {
      const userAddress = wallet.getAccount()?.address;
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log(`🔄 Transferring Space NFT ${tokenId} to Engine wallet...`);

      const contract = getContract({
        client,
        chain: base,
        address: SPACE_NFT_CONTRACT,
        abi:  SPACE_NFT_ABI,
      });

      // Prepare transfer transaction
      const transaction = prepareContractCall({
        contract,
        method: "function transferFrom(address from, address to, uint256 tokenId)",
        params: [userAddress, ENGINE_WALLET_ADDRESS, BigInt(tokenId)],
      });

      // Send transaction
      const receipt = await sendTransaction({
        transaction,
        account: wallet.getAccount()!,
      });

      console.log('✅ Transfer successful:', receipt. transactionHash);

      setResponse({
        success: true,
        transactionHash: receipt.transactionHash,
        spaceId: tokenId,
        defaultChannelId: tokenId,
        explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        message: 'Space NFT transferred to Engine wallet',
      });

      // Refresh owned spaces
      await checkOwnedSpaces();

    } catch (error:  any) {
      console.error('❌ Transfer error:', error);
      setResponse({
        success: false,
        error: error.message || 'Failed to transfer Space NFT',
        details: error.stack,
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Create space via API (original functionality)
  const handleCreateSpace = async () => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setIsTransferring(true);
    setResponse(null);

    try {
      console.log('🚀 Creating space via API (Engine wallet pays gas)...');

      const apiResponse = await fetch('/api/towns/create-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'Knead Magazine',
        }),
      });

      const data = await apiResponse.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      console.log('✅ Space created:', data);

      setResponse({
        success: true,
        spaceId: data. spaceId,
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
      setIsTransferring(false);
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
            Transfer your Space NFT to the Engine wallet for automated management
          </p>
        </div>

        {/* Wallet Connection */}
        {!wallet ? (
          <Card className="border-2">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="font-georgia-pro text-gray-600">Connect wallet to continue</p>
              <ConnectButton client={client} chain={activeChain} />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Connected Wallet Info */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="font-georgia-pro text-sm">Connected Wallet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-mono text-sm break-all">{wallet.getAccount()?.address}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkOwnedSpaces}
                  disabled={isChecking}
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking... 
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Spaces
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Owned Spaces */}
            {ownedSpaces.length > 0 && (
              <Card className="border-2 border-blue-500 bg-blue-50">
                <CardHeader>
                  <CardTitle className="font-adonis text-2xl">Your Space NFTs</CardTitle>
                  <CardDescription className="font-georgia-pro">
                    Transfer a space to your Engine wallet to use it with Knead
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ownedSpaces.map((space) => (
                    <div key={space.tokenId} className="bg-white p-4 rounded border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-georgia-pro font-semibold">Space #{space.spaceId}</p>
                          <p className="text-sm text-gray-600">Token ID: {space.tokenId}</p>
                        </div>
                        <Button
                          onClick={() => transferSpaceToEngine(space.tokenId)}
                          disabled={isTransferring}
                          className="font-georgia-pro"
                        >
                          {isTransferring ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Transferring...
                            </>
                          ) : (
                            <>
                              Transfer to Engine
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </div>
                      <Alert>
                        <AlertDescription className="text-xs">
                          Engine Wallet: <code className="bg-gray-100 px-1 rounded">{ENGINE_WALLET_ADDRESS}</code>
                        </AlertDescription>
                      </Alert>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* No Spaces Found */}
            {! isChecking && ownedSpaces.length === 0 && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="font-adonis text-2xl">No Space NFTs Found</CardTitle>
                  <CardDescription className="font-georgia-pro">
                    You don't own any Space NFTs yet. Create one on Towns.com first, then return here to transfer it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <AlertDescription className="font-georgia-pro space-y-2">
                      <p className="font-semibold">How to get a Space NFT:</p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        <li>Go to <a href="https://www.towns.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">towns.com</a></li>
                        <li>Connect this wallet:  <code className="bg-gray-100 px-1 rounded text-xs">{wallet.getAccount()?.address}</code></li>
                        <li>Create a space called "Knead Magazine"</li>
                        <li>Return here and click "Refresh Spaces"</li>
                        <li>Transfer the Space NFT to the Engine wallet</li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            {/* Alternative: Create via API (kept for debugging) */}
            <details>
              <summary className="cursor-pointer font-georgia-pro text-sm text-gray-600 hover:text-gray-900">
                Advanced:  Try creating via API (currently not working)
              </summary>
              <Card className="border-2 mt-4">
                <CardHeader>
                  <CardTitle className="font-adonis text-2xl">Create Space via API</CardTitle>
                  <CardDescription className="font-georgia-pro">
                    Engine wallet will deploy the space contract (experimental)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={handleCreateSpace}
                    disabled={isTransferring}
                    className="w-full"
                    variant="outline"
                  >
                    {isTransferring ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating... 
                      </>
                    ) : (
                      'Try Creating via API'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </details>
          </>
        )}

        {/* Success Response */}
        {response && response.success && (
          <Card className="border-2 border-green-500 bg-green-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl flex items-center gap-2">
                <CheckCircle className="text-green-600" />
                {response.message || 'Success!'}
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
                      className="text-sm text-blue-600 hover: underline"
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

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded border mt-4">
                <p className="font-georgia-pro font-semibold mb-3">📋 Next Steps:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm font-georgia-pro mb-4">
                  <li>Copy the environment variable below</li>
                  <li>Add to <code className="bg-gray-200 px-1 rounded">. env. local</code></li>
                  <li>Restart dev server: <code className="bg-gray-200 px-1 rounded">npm run dev</code></li>
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
                  <p className="font-semibold text-red-700">Error:</p>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
