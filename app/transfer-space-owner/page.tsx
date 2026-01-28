'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveWallet } from 'thirdweb/react';
import { client, activeChain } from '@/thirdweb-client';
import { createWallet } from 'thirdweb/wallets';
import { Button } from '@/components/ui/button';

const SPACE_OWNER_CONTRACT = '0x2824D1235d1CbcA6d61C00C3ceeCB9155cd33a42'; // Base
const YOUR_SPACE_ID = process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ID;

const wallets = [createWallet("io.metamask")];

export default function TransferSpaceOwner() {
    const wallet = useActiveWallet();
    const [tokenId, setTokenId] = useState<string>('');
    const [currentOwner, setCurrentOwner] = useState<string>('');
    const [newOwner, setNewOwner] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Check current owner
    useEffect(() => {
        if (!YOUR_SPACE_ID) return;
        
        const checkOwner = async () => {
            try {
                const response = await fetch('/api/space-owner/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spaceId: YOUR_SPACE_ID }),
                });
                const data = await response.json();
                setTokenId(data.tokenId);
                setCurrentOwner(data.currentOwner);
            } catch (error) {
                console.error('Error checking owner:', error);
            }
        };
        
        checkOwner();
    }, []);

    const handleTransfer = async () => {
        if (!wallet || !newOwner || !tokenId) return;
        
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
            
            if (response.ok) {
                alert('Transfer successful! You can now install the bot via Towns UI.');
            } else {
                const error = await response.json();
                alert(`Transfer failed: ${error.message}`);
            }
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
            <div className="max-w-2xl w-full space-y-6">
                <h1 className="font-adonis text-4xl text-center">Transfer Space Ownership</h1>
                
                <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                    <div>
                        <label className="font-georgia-pro text-sm text-gray-600">Space ID:</label>
                        <p className="font-mono text-sm break-all">{YOUR_SPACE_ID}</p>
                    </div>
                    
                    <div>
                        <label className="font-georgia-pro text-sm text-gray-600">Token ID:</label>
                        <p className="font-mono text-sm">{tokenId || 'Loading...'}</p>
                    </div>
                    
                    <div>
                        <label className="font-georgia-pro text-sm text-gray-600">Current Owner:</label>
                        <p className="font-mono text-sm break-all">{currentOwner || 'Loading...'}</p>
                    </div>
                </div>

                {!wallet ? (
                    <div className="text-center">
                        <ConnectButton client={client} chain={activeChain} wallets={wallets} />
                        <p className="font-georgia-pro text-sm text-gray-500 mt-2">
                            Connect with the current owner wallet
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
                            disabled={loading || !newOwner}
                            className="w-full bg-black text-white py-3 rounded-full font-georgia-pro hover:bg-gray-800"
                        >
                            {loading ? 'Transferring...' : 'Transfer Ownership'}
                        </Button>
                    </div>
                )}

                <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-georgia-pro font-bold mb-2">Next Steps:</h3>
                    <ol className="font-georgia-pro text-sm space-y-1 list-decimal list-inside">
                        <li>Transfer ownership to your MetaMask</li>
                        <li>Go to <a href="https://towns.com" className="text-blue-600 underline" target="_blank">towns.com</a></li>
                        <li>Connect with your MetaMask</li>
                        <li>Go to Space Settings → Bots</li>
                        <li>Install the Key Sharer bot</li>
                        <li>(Optional) Transfer ownership back to server wallet</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
