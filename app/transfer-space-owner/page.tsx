// app/transfer-space-owner/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveWallet } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { createWallet } from 'thirdweb/wallets';
import { Button } from '@/components/ui/button';

const SPACE_OWNER_CONTRACT = '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42'; // From docs
const YOUR_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

const wallets = [createWallet("io.metamask")];

export default function TransferSpaceOwner() {
    const wallet = useActiveWallet();
    const [tokenId, setTokenId] = useState<string>('');
    const [currentOwner, setCurrentOwner] = useState<string>('');
    const [newOwner, setNewOwner] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);

    // Check current owner on mount
    useEffect(() => {
        if (!YOUR_SPACE_ID) return;
        
        const checkOwner = async () => {
            setChecking(true);
            try {
                const response = await fetch('/api/space-owner/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spaceId: YOUR_SPACE_ID }),
                });
                const data = await response.json();
                
                if (data.tokenId) {
                    setTokenId(data.tokenId);
                    setCurrentOwner(data.currentOwner);
                } else {
                    alert('Could not find Space Owner NFT. Please check the Space ID.');
                }
            } catch (error) {
                console.error('Error checking owner:', error);
                alert('Failed to check current owner');
            } finally {
                setChecking(false);
            }
        };
        
        checkOwner();
    }, []);

    const handleTransfer = async () => {
        if (!wallet || !newOwner || !tokenId) return;
        
        const walletAddress = wallet.getAccount()?.address;
        if (walletAddress?.toLowerCase() !== currentOwner?.toLowerCase()) {
            alert('You must be connected with the current owner wallet to transfer!');
            return;
        }
        
        setLoading(true);
        try {
            const response = await fetch('/api/space-owner/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    tokenId,
                    toAddress: newOwner 
                }),
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(`✅ Transfer successful!\n\nTransaction: ${data.transactionHash}\n\nYou can now install the bot via Towns UI at towns.com`);
                // Refresh the owner info
                setCurrentOwner(newOwner);
            } else {
                alert(`❌ Transfer failed: ${data.error}`);
            }
        } catch (error: any) {
            alert(`❌ Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
            <div className="max-w-2xl w-full space-y-6">
                <h1 className="font-adonis text-4xl text-center">Transfer Space Ownership</h1>
                
                {checking ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                        <p className="font-georgia-pro text-gray-600">Loading ownership info...</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                            <div>
                                <label className="font-georgia-pro text-sm text-gray-600">Space ID:</label>
                                <p className="font-mono text-xs break-all">{YOUR_SPACE_ID}</p>
                            </div>
                            
                            <div>
                                <label className="font-georgia-pro text-sm text-gray-600">Token ID:</label>
                                <p className="font-mono text-sm">{tokenId || 'Not found'}</p>
                            </div>
                            
                            <div>
                                <label className="font-georgia-pro text-sm text-gray-600">Current Owner:</label>
                                <p className="font-mono text-xs break-all">{currentOwner || 'Unknown'}</p>
                            </div>

                            <div className="text-xs text-gray-500 font-georgia-pro">
                                <a 
                                    href={`https://basescan.org/token/${SPACE_OWNER_CONTRACT}?a=${tokenId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                                    View on BaseScan →
                                </a>
                            </div>
                        </div>

                        {!wallet ? (
                            <div className="text-center">
                                <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                                <p className="font-georgia-pro text-sm text-gray-500 mt-2">
                                    Connect with the current owner wallet to transfer
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="font-georgia-pro text-sm text-gray-600 block mb-2">
                                        Transfer to (your MetaMask address):
                                    </label>
                                    <input
                                        type="text"
                                        value={newOwner}
                                        onChange={(e) => setNewOwner(e.target.value)}
                                        placeholder="0x..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                                    />
                                </div>
                                
                                <Button
                                    onClick={handleTransfer}
                                    disabled={loading || !newOwner || !tokenId}
                                    className="w-full bg-black text-white py-3 rounded-full font-georgia-pro hover:bg-gray-800 disabled:opacity-50"
                                >
                                    {loading ? 'Transferring...' : 'Transfer Ownership'}
                                </Button>
                            </div>
                        )}

                        <div className="bg-blue-50 p-4 rounded-lg">
                            <h3 className="font-georgia-pro font-bold mb-2">📋 Next Steps:</h3>
                            <ol className="font-georgia-pro text-sm space-y-2 list-decimal list-inside">
                                <li>Transfer ownership NFT to your MetaMask address</li>
                                <li>Go to <a href="https://towns.com" className="text-blue-600 underline" target="_blank">towns.com</a> and connect with MetaMask</li>
                                <li>Navigate to your Space → Settings → Bots</li>
                                <li>Install the official Key Sharer bot</li>
                                <li>(Optional) Transfer ownership back to server wallet afterward</li>
                            </ol>
                        </div>

                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <p className="font-georgia-pro text-sm">
                                ⚠️ <strong>Important:</strong> Transferring the Space Owner NFT gives complete control of your Space to the new address. Make sure you trust the recipient address!
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
