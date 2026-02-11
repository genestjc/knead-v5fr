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

export function clearAllUserCaches() {
  console.log('🧹 Clearing ALL user-specific Towns caches...');
  
  const keysToRemove = Object.keys(localStorage).filter(key => 
    key.startsWith('river-') || 
    key.startsWith('towns-') || 
    key.startsWith('csb-') ||
    key.includes('stream') ||
    key.includes('miniblock') ||
    key.includes('timeline') ||
    key.includes('user-')
  );
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  // Also clear session storage
  const sessionKeys = Object.keys(sessionStorage).filter(key =>
    key.startsWith('river-') ||
    key.startsWith('towns-') ||
    key.startsWith('csb-')
  );
  
  sessionKeys.forEach(key => {
    sessionStorage.removeItem(key);
  });
  
  console.log(`✅ Cleared ${keysToRemove.length} localStorage keys and ${sessionKeys.length} sessionStorage keys`);
}

export function trackUserState(role: string, isContributor: boolean) {
  const stateKey = 'knead_user_state';
  const currentState = `${role}:${isContributor}`;
  const previousState = localStorage.getItem(stateKey);
  
  // ✅ Only log state changes, don't auto-clear cache
  if (previousState && previousState !== currentState) {
    console.log(`🔄 User state changed: ${previousState} → ${currentState}`);
    // ❌ REMOVED: clearTownsCache() - was too aggressive and caused infinite loops
    // Users can manually refresh if needed
  }
  
  // Always update stored state
  localStorage.setItem(stateKey, currentState);
  return false; // ✅ Never return true to prevent auto-reload
}

/**
 * ✅ Clear cache if error detected on first load
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
