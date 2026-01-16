'use client';

import React, { useState } from 'react';
import { useActiveWallet, ConnectButton } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { getContract, readContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, CheckCircle, Loader2, ArrowRight, Search, Shield } from 'lucide-react';
import { base } from 'thirdweb/chains';

// Space Owner NFT Contract on Base
const SPACE_NFT_CONTRACT = '0x2824d1235d1cbca6d61c00c3ceecb9155cd33a42';

// Engine wallet address
const ENGINE_WALLET_ADDRESS = '0x8659096DE4dc09b48F0414DbD868b3792b557A10';

// ERC721 ABI with approval
const SPACE_NFT_ABI = [
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "getApproved",
    outputs:  [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" }
    ],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" }
    ],
    name: "transferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type:  "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type:  "uint256" }
    ],
    name: "safeTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export default function CreateSpaceClientComponent() {
  const wallet = useActiveWallet();
  
  const [tokenId, setTokenId] = useState('463997');
  const [isChecking, setIsChecking] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [ownershipVerified, setOwnershipVerified] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Verify ownership and approval status
  const verifyOwnership = async () => {
    if (!wallet || !tokenId) return;

    setIsChecking(true);
    setOwnershipVerified(false);
    setIsApproved(false);
    setResponse(null);

    try {
      const userAddress = wallet.getAccount()?.address;
      if (!userAddress) return;

      console.log('🔍 Checking ownership of Space NFT #' + tokenId);

      const contract = getContract({
        client,
        chain: base,
        address: SPACE_NFT_CONTRACT,
        abi: SPACE_NFT_ABI,
      });

      // Check ownership
      const owner = await readContract({
        contract,
        method: "function ownerOf(uint256 tokenId) view returns (address)",
        params: [BigInt(tokenId)],
      });

      console.log('✅ Token owner:', owner);
      console.log('   Your address:', userAddress);

      if (owner. toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(`You don't own this Space NFT.  Current owner: ${owner}`);
      }

      setOwnershipVerified(true);

      // Check if already approved
      try {
        const approved = await readContract({
          contract,
          method: "function getApproved(uint256 tokenId) view returns (address)",
          params: [BigInt(tokenId)],
        });

        console.log('   Approved address:', approved);

        if (approved.toLowerCase() === ENGINE_WALLET_ADDRESS.toLowerCase()) {
          console.log('✅ Already approved for Engine wallet');
          setIsApproved(true);
        } else {
          console.log('⚠️ Not yet approved');
          setIsApproved(false);
        }
      } catch (approvalError) {
        console.log('⚠️ Could not check approval (might not be supported)');
        setIsApproved(false);
      }

    } catch (error:  any) {
      console.error('❌ Error verifying ownership:', error);
      setResponse({
        success: false,
        error: error.message || 'Failed to verify ownership',
        details: error.reason || 'Token might not exist or you may not own it',
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Approve Engine wallet to transfer the NFT
  const approveTransfer = async () => {
    if (!wallet || !tokenId || ! ownershipVerified) return;

    setIsApproving(true);
    setResponse(null);

    try {
      const userAddress = wallet.getAccount()?.address;
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      console.log(`🔐 Approving Engine wallet to transfer Space NFT #${tokenId}...`);

      const contract = getContract({
        client,
        chain: base,
        address: SPACE_NFT_CONTRACT,
        abi: SPACE_NFT_ABI,
      });

      // Prepare approval transaction
      const transaction = prepareContractCall({
        contract,
        method: "function approve(address to, uint256 tokenId)",
        params: [ENGINE_WALLET_ADDRESS, BigInt(tokenId)],
      });

      console.log('📝 Approval transaction prepared, waiting for user signature...');

      // Send approval transaction
      const receipt = await sendTransaction({
        transaction,
        account: wallet.getAccount()!,
      });

      console.log('✅ Approval successful:', receipt. transactionHash);

      setIsApproved(true);

      // Show success message but don't set full response
      alert('✅ Approval successful! Now click "Transfer to Engine Wallet"');

    } catch (error: any) {
      console.error('❌ Approval error:', error);
      setResponse({
        success: false,
        error: error.message || 'Failed to approve transfer',
        details: error.reason || error.stack,
      });
    } finally {
      setIsApproving(false);
    }
  };

  // Transfer Space NFT to Engine wallet (using regular transferFrom)
  const transferSpaceToEngine = async () => {
    if (!wallet || !tokenId || !ownershipVerified) return;

    setIsTransferring(true);
    setResponse(null);

    try {
      const userAddress = wallet. getAccount()?.address;
      if (!userAddress) {
        throw new Error('Wallet not connected');
      }

      console. log(`🔄 Transferring Space NFT #${tokenId} to Engine wallet...`);
      console.log(`   From: ${userAddress}`);
      console.log(`   To: ${ENGINE_WALLET_ADDRESS}`);

      const contract = getContract({
        client,
        chain:  base,
        address: SPACE_NFT_CONTRACT,
        abi: SPACE_NFT_ABI,
      });

      // Try regular transferFrom (not safeTransferFrom)
      const transaction = prepareContractCall({
        contract,
        method:  "function transferFrom(address from, address to, uint256 tokenId)",
        params: [userAddress, ENGINE_WALLET_ADDRESS, BigInt(tokenId)],
      });

      console.log('📝 Transaction prepared, waiting for user signature...');

      // Send transaction
      const receipt = await sendTransaction({
        transaction,
        account: wallet. getAccount()!,
      });

      console.log('✅ Transfer successful:', receipt.transactionHash);

      setResponse({
        success: true,
        transactionHash: receipt.transactionHash,
        spaceId: tokenId,
        defaultChannelId: tokenId,
        explorerUrl: `https://basescan.org/tx/${receipt.transactionHash}`,
        message: 'Space NFT transferred to Engine wallet successfully!',
      });

      setOwnershipVerified(false);
      setIsApproved(false);

    } catch (error: any) {
      console.error('❌ Transfer error:', error);
      
      // Check if it's the same error signature
      if (error.message?. includes('0xed551c30')) {
        setResponse({
          success: false,
          error: '⚠️ This Space NFT appears to be non-transferable (soulbound)',
          details:  'Towns Protocol Space NFTs might be locked to the original owner.  You may need to contact Towns team to enable transfer or use a different approach.',
        });
      } else {
        setResponse({
          success: false,
          error:  error.message || 'Failed to transfer Space NFT',
          details: error.reason || error.stack,
        });
      }
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
          <h1 className="font-adonis text-5xl">Setup Knead Space</h1>
          <p className="font-georgia-pro text-lg text-gray-600">
            Transfer your Space NFT to the Engine wallet for automated management
          </p>
        </div>

        {/* Wallet Connection */}
        {! wallet ? (
          <Card className="border-2">
            <CardContent className="pt-6 text-center space-y-4">
              <p className="font-georgia-pro text-gray-600">Connect your wallet to continue</p>
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
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Your Wallet</p>
                  <p className="font-mono text-sm break-all">{wallet.getAccount()?.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Engine Wallet (Transfer Destination)</p>
                  <p className="font-mono text-sm break-all text-blue-600">{ENGINE_WALLET_ADDRESS}</p>
                </div>
              </CardContent>
            </Card>

            {/* Token ID Input & Verification */}
            <Card className="border-2 border-blue-500 bg-blue-50">
              <CardHeader>
                <CardTitle className="font-adonis text-2xl">Enter Your Space NFT Token ID</CardTitle>
                <CardDescription className="font-georgia-pro">
                  Find your token ID on{' '}
                  <a
                    href={`https://basescan.org/token/0x2824d1235d1cbca6d61c00c3ceecb9155cd33a42? a=${wallet.getAccount()?.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline font-semibold"
                  >
                    BaseScan
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-georgia-pro font-semibold">Token ID</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={tokenId}
                      onChange={(e) => {
                        setTokenId(e.target.value);
                        setOwnershipVerified(false);
                        setIsApproved(false);
                        setResponse(null);
                      }}
                      placeholder="e.g.  463997"
                      className="font-mono"
                      disabled={isChecking || isApproving || isTransferring}
                    />
                    <Button
                      onClick={verifyOwnership}
                      disabled={! tokenId || isChecking || isApproving || isTransferring}
                      variant="outline"
                    >
                      {isChecking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Verify
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Your Space NFT:  <code className="bg-white px-1 rounded">463997</code> (pre-filled)
                  </p>
                </div>

                {ownershipVerified && (
                  <Alert className="bg-green-50 border-green-500">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="font-georgia-pro">
                      <strong className="text-green-700">✅ Ownership Verified!</strong> You own Space NFT #{tokenId}
                    </AlertDescription>
                  </Alert>
                )}

                {ownershipVerified && (
                  <div className="bg-white p-4 rounded-lg border-2 space-y-3">
                    <div className="space-y-2">
                      <p className="font-georgia-pro font-semibold text-lg">
                        Space #{tokenId}
                      </p>
                      <p className="text-xs text-gray-500">
                        Contract: <code className="bg-gray-100 px-1 rounded">{SPACE_NFT_CONTRACT}</code>
                      </p>
                    </div>

                    {/* Approval Status */}
                    {isApproved ? (
                      <Alert className="bg-green-50 border-green-500">
                        <Shield className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-xs">
                          <strong className="text-green-700">✅ Approved!</strong> Ready to transfer
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <>
                        <Alert className="bg-yellow-50 border-yellow-500">
                          <AlertDescription className="text-xs">
                            <strong>Step 1:</strong> Approve the Engine wallet to transfer this NFT
                          </AlertDescription>
                        </Alert>
                        <Button
                          onClick={approveTransfer}
                          disabled={isApproving || isTransferring}
                          className="w-full font-georgia-pro"
                          variant="outline"
                          size="lg"
                        >
                          {isApproving ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <Shield className="mr-2 h-5 w-5" />
                              Approve Transfer
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {/* Transfer Button */}
                    <Alert className="bg-blue-50 border-blue-200">
                      <AlertDescription className="text-xs">
                        <strong>Step 2:</strong> Transfer ownership to the Engine wallet
                      </AlertDescription>
                    </Alert>
                    <Button
                      onClick={transferSpaceToEngine}
                      disabled={isTransferring || isApproving}
                      className="w-full font-georgia-pro"
                      size="lg"
                    >
                      {isTransferring ?  (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Transferring... 
                        </>
                      ) : (
                        <>
                          Transfer to Engine Wallet
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Success Response */}
        {response && response.success && (
          <Card className="border-2 border-green-500 bg-green-50">
            <CardHeader>
              <CardTitle className="font-adonis text-2xl flex items-center gap-2">
                <CheckCircle className="text-green-600" />
                🎉 Space NFT Transferred Successfully!
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
                    {copiedField === 'spaceId' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="bg-gray-50 p-4 rounded border mt-4">
                <p className="font-georgia-pro font-semibold mb-3">📋 Final Steps:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm font-georgia-pro mb-4">
                  <li>Copy the environment variable below</li>
                  <li>Add to <code className="bg-gray-200 px-1 rounded">. env. local</code></li>
                  <li>Restart dev server:  <code className="bg-gray-200 px-1 rounded">npm run dev</code></li>
                  <li>Go to <code className="bg-gray-200 px-1 rounded">/chat-test</code> to test your space! </li>
                </ol>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between gap-4 bg-white p-3 rounded border-2 border-green-500">
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
