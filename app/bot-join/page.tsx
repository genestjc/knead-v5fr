'use client';

import { useState } from 'react';
import { ethers } from 'ethers-v5';
import { JoinSpace, townsEnv } from '@towns-protocol/sdk';

const SPACE_ID = '23';
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/w8-f4Y2PxFDqBK33ltv9s';

export default function BotJoinPage() {
  const [privateKey, setPrivateKey] = useState('');
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState<{ msg: string; color: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const log = (msg: string, color = '#666') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { msg: `[${timestamp}] ${msg}`, color }]);
    console.log(msg);
  };

  const handleJoin = async () => {
    if (!privateKey.startsWith('0x')) {
      alert('Enter private key starting with 0x');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    setResult(null);
    setStatus('Starting join process...');

    try {
      log('✅ Using installed Towns SDK', '#10b981');
      log('🔐 Creating bot wallet...');
      setStatus('Creating wallet...');

      const provider = new ethers.providers.StaticJsonRpcProvider(RPC_URL, {
        chainId: 8453,
        name: 'base',
      });

      const wallet = new ethers.Wallet(privateKey, provider);
      log(`✅ Bot wallet: ${wallet.address}`, '#10b981');

      setStatus('Checking balance...');
      const balance = await provider.getBalance(wallet.address);
      const balanceEth = ethers.utils.formatEther(balance);
      log(`💰 Balance: ${balanceEth} ETH`);

      if (balance.eq(0)) {
        throw new Error('Bot has no ETH for gas fees');
      }

      setStatus('Configuring Towns...');
      log('📝 Creating Towns config...');

      const TOWNS_CONFIG = townsEnv().makeTownsConfig('omega', {
        rpcUrl: RPC_URL,
      });

      log('✅ Towns config created', '#10b981');

      setStatus('Joining space (30-90 seconds)...');
      log('🚀 Calling JoinSpace...');
      log(`   Space ID: ${SPACE_ID}`);
      log('   This will mint the membership NFT...');
      log('   Please wait...');

      const joinResult = await JoinSpace({
        spaceId: SPACE_ID,
        signer: wallet,
        townsConfig: TOWNS_CONFIG,
        skipMintMembership: false,
      });

      log('✅ JOIN SUCCESSFUL!', '#10b981');
      log(`Result: ${JSON.stringify(joinResult, null, 2)}`);

      setStatus('success');
      setResult({ address: wallet.address, data: joinResult });

    } catch (error: any) {
      log(`❌ Error: ${error.message}`, '#ef4444');
      console.error('Full error:', error);
      setStatus('error');
      setResult({ error: error.message, stack: error.stack });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: '600px', margin: '50px auto', padding: '20px', background: '#f9f9f9' }}>
      <h1>🤖 Bot Join Space</h1>
      <p>Join bot to Towns Space #23 using installed SDK</p>

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
        onClick={handleJoin}
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
        {isLoading ? 'Joining...' : 'Join Space Now'}
      </button>

      {status && status !== 'success' && status !== 'error' && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #3b82f6' }}>
          <strong>Status:</strong> {status}
        </div>
      )}

      {status === 'success' && result && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #10b981' }}>
          <h3>✅ Bot Joined Successfully!</h3>
          <p><strong>Bot Address:</strong> <code>{result.address}</code></p>
          <p><strong>Space ID:</strong> {SPACE_ID}</p>
          <details>
            <summary>Show result details</summary>
            <pre style={{ background: '#f1f1f1', padding: '10px', overflow: 'auto', fontSize: '11px' }}>
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </details>
          <p style={{ marginTop: '20px' }}>
            <a href={`https://basescan.org/address/${result.address}`} target="_blank" style={{ color: '#000' }}>
              View on BaseScan →
            </a>
          </p>
        </div>
      )}

      {status === 'error' && result && (
        <div style={{ padding: '20px', margin: '20px 0', borderRadius: '8px', background: 'white', borderLeft: '4px solid #ef4444' }}>
          <h3>❌ Join Failed</h3>
          <p><strong>Error:</strong> {result.error}</p>
          <details>
            <summary>Show error details</summary>
            <pre style={{ background: '#f1f1f1', padding: '10px', overflow: 'auto', fontSize: '11px' }}>
              {result.stack}
            </pre>
          </details>
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
