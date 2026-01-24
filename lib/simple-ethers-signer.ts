'use client';

import { ethers } from 'ethers-v5';

/**
 * Creates a simple ethers v5 signer from a wallet address and signing function
 */
export function createSimpleEthersV5Signer(
  address: string,
  chainId: number,
  rpcUrl: string,
  signMessage: (message: string) => Promise<string>,
  sendTransaction: (tx: any) => Promise<{ hash: string }>
): ethers.Signer {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
    chainId,
    name: 'Base',
  });

  // Create a custom signer
  const signer = new ethers.VoidSigner(address, provider);

  // Override signing methods
  (signer as any).signMessage = async (message: string | ethers.utils.Bytes) => {
    const messageString = typeof message === 'string' ? message : ethers.utils.toUtf8String(message);
    return await signMessage(messageString);
  };

  (signer as any).sendTransaction = async (transaction: ethers.providers.TransactionRequest) => {
    const result = await sendTransaction(transaction);
    return provider.getTransaction(result.hash);
  };

  return signer;
}
