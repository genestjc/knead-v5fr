// lib/ethers-signer-adapter.ts
"use client";

import { signMessage as thirdwebSignMessage } from "thirdweb/wallets";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Uses EIP-1193 provider + Web3Provider for maximum compatibility
 */
export async function getEthersV5Signer(wallet: any, chain: any, client: any) {
  const { ethers } = await import("ethers-v5");
  
  const account = wallet.getAccount();
  if (!account) throw new Error("No account connected");

  const rpcUrl = chain.rpc;
  
  // Create a custom EIP-1193 provider that wraps ThirdWeb signing
  const eip1193Provider = {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      console.log('🔌 RPC request:', method);
      
      // Account-related methods
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return [account.address];
      }
      
      if (method === 'eth_chainId') {
        return `0x${chain.id.toString(16)}`;
      }
      
      // Signing methods - use ThirdWeb
      if (method === 'personal_sign') {
        const [message, address] = params || [];
        console.log('🔐 Signing with personal_sign');
        const signature = await thirdwebSignMessage({
          account,
          message,
        });
        return signature.startsWith('0x') ? signature : `0x${signature}`;
      }
      
      if (method === 'eth_sign') {
        const [address, message] = params || [];
        console.log('🔐 Signing with eth_sign');
        const signature = await thirdwebSignMessage({
          account,
          message,
        });
        return signature.startsWith('0x') ? signature : `0x${signature}`;
      }
      
      if (method === 'eth_signTypedData_v4') {
        console.log('🔐 Signing typed data');
        // For now, throw - can implement later if needed
        throw new Error('eth_signTypedData_v4 not implemented');
      }
      
      // For all other methods, proxy to the RPC endpoint
      console.log('📡 Proxying to RPC:', method);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params: params || [],
        }),
      });
      
      const json = await response.json();
      if (json.error) {
        console.error('❌ RPC error:', json.error);
        throw new Error(json.error.message);
      }
      return json.result;
    },
    
    // EIP-1193 event emitter (minimal implementation)
    on: () => {},
    removeListener: () => {},
  };

  // Create ethers Web3Provider from our EIP-1193 provider
  const provider = new ethers.providers.Web3Provider(eip1193Provider as any, {
    chainId: chain.id,
    name: chain.name || 'Base',
  });

  // Get the signer - this is a real JsonRpcSigner from ethers
  const signer = provider.getSigner(account.address);
  
  console.log('✅ Created ethers v5 signer');
  console.log('   Type:', signer.constructor.name);
  console.log('   _isSigner:', (signer as any)._isSigner);
  
  // Test that getAddress works
  const testAddress = await signer.getAddress();
  console.log('   Address:', testAddress);
  console.log('   Match:', testAddress.toLowerCase() === account.address.toLowerCase());
  
  return signer;
}
