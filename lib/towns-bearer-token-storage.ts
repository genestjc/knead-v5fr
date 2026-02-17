// lib/towns-bearer-token-storage.ts

const BEARER_TOKEN_KEY = 'towns_bearer_token_v1';
const TOKEN_WALLET_KEY = 'towns_token_wallet_v1';

interface StoredToken {
  token: string;
  walletAddress: string;
  savedAt: number;
}

export function saveBearerToken(token: string, walletAddress: string) {
  try {
    const data: StoredToken = {
      token,
      walletAddress: walletAddress.toLowerCase(),
      savedAt: Date.now(),
    };
    
    localStorage.setItem(BEARER_TOKEN_KEY, JSON.stringify(data));
    localStorage.setItem(TOKEN_WALLET_KEY, walletAddress.toLowerCase());
    
    console.log('💾 Bearer token saved for instant reconnection');
  } catch (error) {
    console.error('❌ Failed to save bearer token:', error);
  }
}

export function getBearerToken(walletAddress: string): string | null {
  try {
    const serialized = localStorage.getItem(BEARER_TOKEN_KEY);
    const savedWallet = localStorage.getItem(TOKEN_WALLET_KEY);
    
    if (!serialized || !savedWallet) {
      return null;
    }
    
    // Verify it's for the current wallet
    if (savedWallet !== walletAddress.toLowerCase()) {
      console.log('⚠️ Saved token is for different wallet, clearing');
      clearBearerToken();
      return null;
    }
    
    const data: StoredToken = JSON.parse(serialized);
    
    // Check age (7 days max)
    const age = Date.now() - data.savedAt;
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    
    if (age > maxAge) {
      console.log('⏰ Bearer token expired (>7 days old)');
      clearBearerToken();
      return null;
    }
    
    console.log('✅ Valid bearer token found');
    return data.token;
  } catch (error) {
    console.error('❌ Failed to get bearer token:', error);
    clearBearerToken();
    return null;
  }
}

export function clearBearerToken() {
  try {
    localStorage.removeItem(BEARER_TOKEN_KEY);
    localStorage.removeItem(TOKEN_WALLET_KEY);
    console.log('🧹 Bearer token cleared');
  } catch (error) {
    console.error('❌ Failed to clear bearer token:', error);
  }
}
