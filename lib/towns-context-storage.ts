
import type { SignerContext } from '@towns-protocol/sdk';

const SIGNER_CONTEXT_KEY = 'towns_signer_context';

export function saveSignerContext(context: SignerContext) {
  try {
    // SignerContext contains: rootKey, delegateKey, delegateSignature, userId
    const serialized = JSON.stringify({
      rootKey: context.rootKey,
      delegateKey: context.delegateKey, 
      delegateSignature: context.delegateSignature,
      userId: context.userId,
      // Store expiry if available
      expiresAt: context.delegateKey?.expiresAt || Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days default
    });
    
    localStorage.setItem(SIGNER_CONTEXT_KEY, serialized);
    console.log('💾 SignerContext saved');
  } catch (error) {
    console.error('Failed to save SignerContext:', error);
  }
}

export function getSignerContext(): SignerContext | null {
  try {
    const serialized = localStorage.getItem(SIGNER_CONTEXT_KEY);
    if (!serialized) return null;
    
    const data = JSON.parse(serialized);
    
    // Check if expired (with 1 hour buffer)
    if (data.expiresAt && Date.now() >= data.expiresAt - 60 * 60 * 1000) {
      console.log('⏰ SignerContext expired');
      clearSignerContext();
      return null;
    }
    
    console.log('✅ Valid SignerContext found');
    return {
      rootKey: data.rootKey,
      delegateKey: data.delegateKey,
      delegateSignature: data.delegateSignature,
      userId: data.userId,
    } as SignerContext;
  } catch (error) {
    console.error('Failed to get SignerContext:', error);
    return null;
  }
}

export function clearSignerContext() {
  try {
    localStorage.removeItem(SIGNER_CONTEXT_KEY);
    console.log('🧹 SignerContext cleared');
  } catch (error) {
    console.error('Failed to clear SignerContext:', error);
  }
}
