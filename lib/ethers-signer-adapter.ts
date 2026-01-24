// lib/ethers-signer-adapter.ts
"use client";

import { signMessage as thirdwebSignMessage } from "thirdweb/wallets";

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Creates a wrapped JsonRpcSigner with properly bound methods
 */
export async function getEthersV5Signer(wallet: any, chain: any, client: any) {
  const { ethers } = await import("ethers-v5");
  
  const account = wallet.getAccount();
  if (!account) throw new Error("No account connected");

  const rpcUrl = chain.rpc;
  
  // Create a custom EIP-1193 provider
  const eip1193Provider = {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      console.log('🔌 RPC request:', method);
      
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') {
        return [account.address];
      }
      
      if (method === 'eth_chainId') {
        return `0x${chain.id.toString(16)}`;
      }
      
      if (method === 'personal_sign') {
        const [message, address] = params || [];
        console.log('🔐 Signing message');
        const signature = await thirdwebSignMessage({
          account,
          message,
        });
        return signature.startsWith('0x') ? signature : `0x${signature}`;
      }
      
      if (method === 'eth_sign') {
        const [address, message] = params || [];
        console.log('🔐 Signing message');
        const signature = await thirdwebSignMessage({
          account,
          message,
        });
        return signature.startsWith('0x') ? signature : `0x${signature}`;
      }
      
      // Proxy to RPC
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
      if (json.error) throw new Error(json.error.message);
      return json.result;
    },
    on: () => {},
    removeListener: () => {},
  };

  // Create Web3Provider
  const provider = new ethers.providers.Web3Provider(eip1193Provider as any, {
    chainId: chain.id,
    name: chain.name || 'Base',
  });

  // Get the base signer
  const baseSigner = provider.getSigner(account.address);
  
  // Create a wrapper object with properly bound methods
  const wrappedSigner = {
    // Copy all properties
    _isSigner: true,
    provider: baseSigner.provider,
    _address: account.address,
    
    // Bind getAddress
    getAddress: async function() {
      return account.address;
    },
    
    // Bind signMessage - call through provider.send
    signMessage: async function(message: string | ethers.utils.Bytes) {
      console.log('🔐 signMessage called on wrapper');
      
      let messageString: string;
      if (typeof message === 'string') {
        messageString = message;
      } else if (message instanceof Uint8Array) {
        messageString = ethers.utils.hexlify(message);
      } else {
        messageString = ethers.utils.toUtf8String(message);
      }
      
      // Call ThirdWeb's signMessage directly
      const signature = await thirdwebSignMessage({
        account,
        message: messageString,
      });
      
      console.log('✅ Signature from ThirdWeb');
      return signature.startsWith('0x') ? signature : `0x${signature}`;
    },
    
    // Other required methods
    signTransaction: async function() {
      throw new Error('signTransaction not supported');
    },
    
    connect: function(newProvider: any) {
      return baseSigner.connect(newProvider);
    },
    
    sendTransaction: async function(transaction: any) {
      return baseSigner.sendTransaction(transaction);
    },
  };
  
  console.log('✅ Created wrapped signer');
  console.log('   Address:', account.address);
  console.log('   Has signMessage:', typeof wrappedSigner.signMessage === 'function');
  console.log('   Has getAddress:', typeof wrappedSigner.getAddress === 'function');
  
  // Test the methods
  const testAddress = await wrappedSigner.getAddress();
  console.log('   Test getAddress():', testAddress);
  
  return wrappedSigner as any as ethers.Signer;
}
