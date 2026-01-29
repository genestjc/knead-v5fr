'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers-v5';
import { useAgentConnection, useJoinSpace } from '@towns-protocol/react-sdk';
import { townsEnv } from '@towns-protocol/sdk';

const SPACE_ID = '10616843f796b43e6ef972e7c345d2b06d855135430000000000000000000000';
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/w8-f4Y2PxFDqBK33ltv9s';

const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
  rpcUrl: RPC_URL,
});

export default function BotJoinClient() {
  const [privateKey, setPrivateKey] = useState('');
  const [logs, setLogs] = useState<{ msg: string; color: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [botAddress, setBotAddress] = useState('');
  const [botWallet, setBotWallet] = useState<ethers.Wallet | null>(null);

  // Agent connection
  const { connect, isAgentConnected, isAgentConnecting } = useAgentConnection();
  
  // Join space hook (only works after agent is connected)
  const { joinSpace, isPending, isError, error } = useJoinSpace();

  const log = (msg: string, color = '#666') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { msg: `[${timestamp}] ${msg}`, color }]);
    console.log(msg);
  };

  const handleConnect = async () => {
    if (!privateKey.startsWith('0x')) {
      alert('Enter private key starting with 0x');
      return;
    }

    setIsProcessing(true);
    setLogs([]);
    setResult(null);

    try {
      log('🔐 Creating bot wallet...');

      const provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, {
        chainId: 8453,
        name: 'base',
      });

      const wallet = new ethers.Wallet(privateKey, provider);
      setBotAddress(wallet.address);
      setBotWallet(wallet);
      log(`✅ Bot wallet: ${wallet.address}`, '#10b981');

      log('💰 Checking balance...');
      const balance = await provider.getBalance(wallet.address);
      const balanceEth = ethers.utils.formatEther(balance);
      log(`💰 Balance: ${balanceEth} ETH`);

      if (balance.eq(0)) {
        throw new Error('Bot has no ETH for gas fees');
      }

      log('🔌 Connecting to Towns sync agent...');
      await connect(wallet, {
        townsConfig: TOWNS_CONFIG,
        onTokenExpired: () => log('⚠️ Token expired', '#ff6600'),
      });

      log('✅ Connected to Towns!', '#10b981');

    } catch (err: any) {
      log(`❌ Error: ${err.message}`, '#ef4444');
      console.error('Full error:', err);
      setResult({ success: false, error: err.message, stack: err.stack });
      setIsProcessing(false);
    }
  };

  // Auto-join after agent connection
  useEffect(() => {
    if (!isAgentConnected || !botWallet || result) return;

    const performJoin = async () => {
      try {
        log('🚀 Calling joinSpace...');
        log(`   Space ID: ${SPACE_ID.substring(0, 16)}...`);
        log('   This will mint the membership NFT...');
        log('   Please wait (30-90 seconds)...');

        await joinSpace(SPACE_ID, botWallet, {
          skipMintMembership: false,
        });

        log('✅ JOIN SUCCESSFUL!', '#10b981');
        setResult({ success: true, address: botAddress });

      } catch (err: any) {
        log(`❌ Join Error: ${err.message}`, '#ef4444');
        console.error('Full error:', err);
        
        // Handle "already a member" as success
        if (err.message?.includes('already a member') || 
            err.message?.includes('already in space')) {
          log('ℹ️ Bot is already a member - treating as success', '#10b981');
          setResult({ success: true, address: botAddress, alreadyMember: true });
        } else {
          setResult({ success: false, error: err.message, stack: err.stack });
        }
      } finally {
        setIsProcessing(false);
      }
    };

    performJoin();
  }, [isAgentConnected, botWallet, joinSpace, result, botAddress]);

  const isLoading = isProcessing || isAgentConnecting || isPending;

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: '600px', margin: '50px auto', padding: '20px', background: '#f9f9f9' }}>
      <h1>🤖 Bot Join Space</h1>
      <p>Join bot to Knead Chat space using React SDK</p>

      {!isAgentConnected && !result && (
        <>
          <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white' }}>
            <label><strong>Bot Private Key:</strong></label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x..."
              style={{
                width: '100%',
                padding: '10px',
                margin: '10px 0',
                fontFamily: 'monospace',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            <small style={{ color: '#666' }}>Stays in your browser, never sent anywhere</small>
          </div>

          <button
            onClick={handleConnect}
            disabled={isLoading}
            style={{
              background: isLoading ? '#ccc' : '#000',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
            }}
          >
            {isLoading ? 'Connecting...' : 'Connect & Join Space'}
          </button>
        </>
      )}

      {isLoading && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #3b82f6' }}>
          <strong>Status:</strong> {
            isAgentConnecting ? 'Connecting to Towns...' :
            isPending ? 'Minting membership NFT...' :
            'Processing...'
          }
        </div>
      )}

      {result?.success && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #10b981' }}>
          <h3>✅ Bot Joined Successfully!</h3>
          {result.alreadyMember && <p style={{ color: '#666', fontSize: '14px' }}>Bot was already a member</p>}
          <p><strong>Bot Address:</strong> <code>{result.address}</code></p>
          <p><strong>Space ID:</strong> <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{SPACE_ID}</code></p>
          <p style={{ marginTop: '20px' }}>
            <a href={`https://basescan.org/address/${result.address}`} target="_blank" style={{ color: '#000', textDecoration: 'underline' }}>
              View on BaseScan →
            </a>
          </p>
          <p style={{ marginTop: '10px', color: '#666' }}>
            <strong>Next:</strong> Check if bot appears in Towns space member list!
          </p>
        </div>
      )}

      {result?.success === false && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #ef4444' }}>
          <h3>❌ Join Failed</h3>
          <p><strong>Error:</strong> {result.error || error?.message}</p>
          {result?.stack && (
            <details>
              <summary>Show error details</summary>
              <pre style={{ background: '#f1f1f1', padding: '10px', overflow: 'auto', fontSize: '11px' }}>
                {result.stack}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              setResult(null);
              setIsProcessing(false);
              setBotWallet(null);
              setBotAddress('');
            }}
            style={{
              marginTop: '10px',
              background: '#000',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        {logs.map((log, i) => (
          <p key={i} style={{ margin: '5px 0', fontSize: '14px', color: log.color }}>
            {log.msg}
          </p>
        ))}
      </div>
    </div>
  );
}
