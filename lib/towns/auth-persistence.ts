const TOWNS_AUTH_KEY = 'knead_towns_bearer_token';
const TOWNS_AUTH_EXPIRY_KEY = 'knead_towns_token_expiry';
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function saveTownsAuth(token: string) {
  // ❌ DISABLED - bearer tokens causing 400 errors
  console.log('⚠️ Bearer token caching disabled');
  return;
}

export function getSavedTownsAuth(): string | null {
  // ❌ DISABLED - always return null to force fresh signatures
  return null;
}

export function clearTownsAuth() {
  try {
    localStorage.removeItem(TOWNS_AUTH_KEY);
    localStorage.removeItem(TOWNS_AUTH_EXPIRY_KEY);
    console.log('🧹 Cleared Towns authentication');
  } catch (error) {
    console.error('❌ Failed to clear Towns auth:', error);
  }
}

export function getTownsBearerToken(): string | null {
  return null;
}
