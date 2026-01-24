// lib/thirdweb-to-ethers5.ts
'use client';

/**
 * Converts ThirdWeb wallet to Ethers v5 Signer
 * Uses dynamic imports to avoid SSR issues
 */
export async function thirdwebWalletToEthersV5Signer(wallet: any, client: any, chain: any) {
  // Dynamic import to avoid hydration issues
  const { ethers } = await import('ethers-v5');
  
  const account = wallet.getAccount();
  if (!account) {
    throw new Error('No account connected');
  }

  const rpcUrl = chain.rpc;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId: chain.id,
    name: chain.name || 'Base',
  });

  // Use VoidSigner as base
  const voidSigner = new ethers.VoidSigner(account.address, provider);

  // Override signMessage
  const customSigner = Object.create(voidSigner);
  customSigner.signMessage = async (message: any) => {
    const messageString = typeof message === 'string' ? message : message.toString();
    // Use ThirdWeb's signing
    const signature = await (wallet as any).signMessage({ message: messageString });
    return signature;
  };

  customSigner.getAddress = () => Promise.resolve(account.address);

  return customSigner;
}
