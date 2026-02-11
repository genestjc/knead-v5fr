const TOWNS_AUTH_KEY = 'knead_towns_bearer_token';
const TOWNS_AUTH_EXPIRY_KEY = 'knead_towns_token_expiry';
const TOKEN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function saveTownsAuth(token: string) {
  try {
    const expiry = Date.now() + TOKEN_LIFETIME_MS;
    localStorage.setItem(TOWNS_AUTH_KEY, token);
    localStorage.setItem(TOWNS_AUTH_EXPIRY_KEY, expiry.toString());
    console.log('✅ Saved Towns bearer token (expires in 7 days)');
  } catch (error) {
    console.error('❌ Failed to save Towns auth:', error);
  }
}

export function getSavedTownsAuth(): string | null {
  try {
    const token = localStorage.getItem(TOWNS_AUTH_KEY);
    const expiry = localStorage.getItem(TOWNS_AUTH_EXPIRY_KEY);
    
    if (!token || !expiry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > parseInt(expiry)) {
      console.log('⚠️ Towns token expired, clearing...');
      clearTownsAuth();
      return null;
    }
    
    console.log('✅ Found saved Towns bearer token');
    return token;
  } catch (error) {
    console.error('❌ Failed to get saved Towns auth:', error);
    return null;
  }
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
  try {
    // The Towns SDK stores the token internally, we need to get it after connection
    // This is a bit hacky but works - we'll save it after first connect
    return getSavedTownsAuth();
  } catch (error) {
    console.error('❌ Failed to get bearer token:', error);
    return null;
  }
}
