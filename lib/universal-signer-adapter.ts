"use client";

import { getEthersV5Signer } from './ethers-signer-adapter';
import type { Signer } from 'ethers-v5';

/**
 * Creates the appropriate ethers v5 Signer based on wallet type
 * 
 * For MetaMask/browser wallets: Uses Wagmi signer (proper delegate signing)
 * For ThirdWeb wallets: Uses ThirdWeb adapter
 */
export async function createUniversalSigner(
  wallet: any,
  wagmiSigner: Promise<Signer> | undefined,
  activeChain: any,
  client: any
): Promise<Signer> {
  
  // Check if this is a MetaMask or browser wallet
  const walletId = wallet?.id;
  const isMetaMask = walletId === 'io.metamask' || walletId === 'metamask';
  const isBrowserWallet = walletId?.includes('injected') || isMetaMask;
  
  console.log('🔍 Wallet Detection:', {
    walletId,
    isMetaMask,
    isBrowserWallet,
    hasWagmiSigner: !!wagmiSigner,
  });
  
  // For MetaMask and browser wallets: Use Wagmi signer
  if (isBrowserWallet && wagmiSigner) {
    console.log('✅ Using Wagmi signer for MetaMask/browser wallet');
    return await wagmiSigner;
  }
  
  // For ThirdWeb wallets (in-app, social, etc.): Use ThirdWeb adapter
  console.log('✅ Using ThirdWeb adapter for ThirdWeb wallet');
  return await getEthersV5Signer(wallet, activeChain, client);
}
