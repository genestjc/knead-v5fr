// lib/towns-context-storage.ts

import type { SignerContext } from '@towns-protocol/sdk';

const SIGNER_CONTEXT_KEY = 'towns_signer_context_v1';
const CONTEXT_WALLET_KEY = 'towns_context_wallet_v1';

interface StoredContext {
  context: {
    rootKey: any;
    delegateKey: any;
    delegateSignature: any;
    userId: string;
  };
  walletAddress: string;
  savedAt: number;
}

export function saveSignerContext(context: SignerContext, walletAddress: string) {
  try {
    const data: StoredContext = {
      context: {
        rootKey: context.rootKey,
        delegateKey: context.delegateKey,
        delegateSignature: context.delegateSignature,
        userId: context.userId,
      },
      walletAddress: walletAddress.toLowerCase(),
      savedAt: Date.now(),
    };
    
    localStorage.setItem(SIGNER_CONTEXT_KEY, JSON.stringify(data));
    localStorage.setItem(CONTEXT_WALLET_KEY, walletAddress.toLowerCase());
    
    console.log('💾 SignerContext saved for instant reconnection');
  } catch (error) {
    console.error('❌ Failed to save SignerContext:', error);
  }
}

export function getSignerContext(walletAddress: string): SignerContext | null {
  try {
    const serialized = localStorage.getItem(SIGNER_CONTEXT_KEY);
    const savedWallet = localStorage.getItem(CONTEXT_WALLET_KEY);
    
    if (!serialized || !savedWallet) {
      return null;
    }
    
    // Verify it's for the current wallet
    if (savedWallet !== walletAddress.toLowerCase()) {
      console.log('⚠️ Saved context is for different wallet, clearing');
      clearSignerContext();
      return null;
    }
    
    const data: StoredContext = JSON.parse(serialized);
    
    // Check age (7 days max)
    const age = Date.now() - data.savedAt;
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    
    if (age > maxAge) {
      console.log('⏰ SignerContext expired (>7 days old)');
      clearSignerContext();
      return null;
    }
    
    console.log('✅ Valid SignerContext found');
    return data.context as SignerContext;
  } catch (error) {
    console.error('❌ Failed to get SignerContext:', error);
    clearSignerContext();
    return null;
  }
}

export function clearSignerContext() {
  try {
    localStorage.removeItem(SIGNER_CONTEXT_KEY);
    localStorage.removeItem(CONTEXT_WALLET_KEY);
    console.log('🧹 SignerContext cleared');
  } catch (error) {
    console.error('❌ Failed to clear SignerContext:', error);
  }
}
