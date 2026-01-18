'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ethers } from 'ethers-v5';

export default function ExtractSpaceIdPage() {
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const extractFromTransaction = async () => {
    if (!txHash. startsWith('0x') || txHash.length !== 66) {
      setResult({ error: 'Invalid transaction hash format' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Connect to Base RPC
      const provider = new ethers.providers.JsonRpcProvider(
        'https://mainnet.base.org'
      );

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        setResult({ error: 'Transaction not found or not confirmed yet' });
        setLoading(false);
        return;
      }

      console.log('Receipt:', receipt);

      // Look for SpaceCreated event
      // Event signature: SpaceCreated(uint256 indexed spaceId, address indexed owner, string name)
      const spaceCreatedTopic = '0xe50fc3942f8a2d7e5a7c8fb9488499eba5255b41e18bc3f1b479140297d1d0b'; // SpaceCreated event signature

      const spaceCreatedLog = receipt.logs.find(
        log => log.topics[0] === spaceCreatedTopic
      );

      if (! spaceCreatedLog) {
        setResult({ 
          error: 'SpaceCreated event not found in transaction',
          hint: 'Make sure this is a "Create Space" transaction'
        });
        setLoading(false);
        return;
      }

      // Extract spaceId from topic[1] (indexed parameter)
      const spaceIdHex = spaceCreatedLog.topics[1];
      const spaceId = ethers.BigNumber.from(spaceIdHex).toString();
      
      // Extract space address from topic[2]
      const spaceAddressHex = spaceCreatedLog.topics[2];
      const spaceAddress = ethers. utils.getAddress('0x' + spaceAddressHex.slice(26));

      // Default channel ID is typically the same as spaceId
      const defaultChannelId = spaceId;

      setResult({
        success: true,
        spaceId,
        spaceIdHex,
        defaultChannelId,
        spaceAddress,
        transactionHash: txHash,
      });

    } catch (error:  any) {
      console.error(error);
      setResult({ 
        error: error.message || 'Failed to extract space ID',
        details: error.stack
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl w-full space-y-6 bg-white p-8 rounded-lg shadow">
        <h1 className="font-adonis text-4xl">Extract Space ID from Transaction</h1>
        <p className="font-georgia-pro text-gray-600">
          Paste the transaction hash from your "Create Space" transaction to extract the Space ID and Channel ID.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Transaction Hash
            </label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <Button
            onClick={extractFromTransaction}
            disabled={loading || !txHash}
            className="w-full py-6 text-lg"
          >
            {loading ?  'Extracting...' :  'Extract Space ID'}
          </Button>
        </div>

        {result && (
          <div className="bg-gray-50 p-6 rounded-lg border">
            {result.success ? (
              <>
                <div className="mb-4 p-4 bg-green-50 rounded border border-green-200">
                  <p className="font-bold text-green-800 mb-2">✅ Space ID Extracted!</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Space ID (Decimal)</p>
                    <code className="block bg-white px-4 py-2 rounded border font-mono text-sm mt-1">
                      {result.spaceId}
                    </code>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600">Default Channel ID</p>
                    <code className="block bg-white px-4 py-2 rounded border font-mono text-sm mt-1">
                      {result.defaultChannelId}
                    </code>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-600">Space Address</p>
                    <code className="block bg-white px-4 py-2 rounded border font-mono text-sm mt-1">
                      {result.spaceAddress}
                    </code>
                  </div>
                </div>

                <div className="mt-6 bg-white p-4 rounded border">
                  <p className="font-bold mb-2">📋 Add to .env.local:</p>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs overflow-x-auto">
{`NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID=${result.spaceId}
NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID=${result. defaultChannelId}
NEXT_PUBLIC_TOWNS_NETWORK=omega`}
                  </pre>
                </div>
              </>
            ) : (
              <div className="p-4 bg-red-50 rounded border border-red-200">
                <p className="font-bold text-red-800 mb-2">❌ Error</p>
                <p className="text-sm text-red-700">{result.error}</p>
                {result.hint && (
                  <p className="text-sm text-red-600 mt-2 italic">{result.hint}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
