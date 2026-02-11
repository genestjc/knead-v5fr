export function clearTownsCache() {
  console.log('🧹 Clearing Towns cache...');
  
  const keysToRemove = Object.keys(localStorage).filter(key => 
    key.startsWith('river-') || 
    key.startsWith('towns-') || 
    key.startsWith('csb-') ||
    key.includes('stream') ||
    key.includes('miniblock')
  );
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log(`✅ Cleared ${keysToRemove.length} Towns cache keys`);
}

export function trackUserState(role: string, isContributor: boolean) {
  const stateKey = 'knead_user_state';
  const currentState = `${role}:${isContributor}`;
  const previousState = localStorage.getItem(stateKey);
  
  // ✅ Towns recommendation: Clear cache on first load if state exists
  if (previousState && previousState !== currentState) {
    console.log(`🔄 State changed: ${previousState} → ${currentState}`);
    clearTownsCache();
    localStorage.setItem(stateKey, currentState);
    return true; // Cache was cleared
  }
  
  localStorage.setItem(stateKey, currentState);
  return false; // No cache clear needed
}

/**
 * ✅ Towns recommendation: Clear cache if error detected on first load
 */
export function clearCacheOnError() {
  const errorKey = 'knead_last_sync_error';
  const lastError = localStorage.getItem(errorKey);
  const now = Date.now();
  
  if (lastError) {
    const errorTime = parseInt(lastError);
    // If last error was within 30 seconds, clear cache
    if (now - errorTime < 30000) {
      console.log('🔄 Recent sync error detected - clearing cache...');
      clearTownsCache();
      localStorage.removeItem(errorKey);
      return true;
    }
  }
  
  return false;
}

/**
 * Mark that a sync error occurred
 */
export function recordSyncError() {
  localStorage.setItem('knead_last_sync_error', Date.now().toString());
}
