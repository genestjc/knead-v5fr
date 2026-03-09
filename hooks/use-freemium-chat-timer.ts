/**
 * Freemium Chat Timer Hook
 * 
 * Tracks and enforces the 1 hour/month viewing limit for freemium users (Token ID 0 only).
 * Uses Supabase to store session data and calculate remaining time.
 */

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { getUserRole } from '@/lib/blockchain/check-nft-ownership';

interface FreemiumTimerState {
  isFreemiumUser: boolean;
  remainingSeconds: number | null;
  remainingMinutes: number | null;
  hasTimeLeft: boolean;
  isLoading: boolean;
}

/**
 * Hook to manage freemium chat timer
 * 
 * @param walletAddress - User's wallet address
 * @returns Timer state and remaining time
 */
export function useFreemiumChatTimer(walletAddress: string | null): FreemiumTimerState {
  const [isFreemiumUser, setIsFreemiumUser] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Stable supabase client reference — avoids triggering effects on every render
  const supabaseRef = useRef(createClientComponentClient());
  const supabase = supabaseRef.current;

  const sessionStartRef = useRef<Date | null>(null);
  // Tracks the start of the current unsaved window; updated after each partial save
  const lastSaveRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is freemium on mount and when wallet changes
  useEffect(() => {
    let mounted = true;

    async function checkUserRole() {
      if (!walletAddress) {
        setIsLoading(false);
        return;
      }

      try {
        const roleInfo = await getUserRole(walletAddress);
        
        if (mounted) {
          setIsFreemiumUser(roleInfo.role === 'freemium');
          
          // Only fetch remaining time if user is freemium
          if (roleInfo.role === 'freemium') {
            await fetchRemainingTime();
          } else {
            setRemainingSeconds(null);
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    checkUserRole();

    return () => {
      mounted = false;
    };
  }, [walletAddress]);

  // Fetch remaining time from Supabase
  async function fetchRemainingTime() {
    if (!walletAddress) return;

    try {
      const { data, error } = await supabase.rpc('get_freemium_chat_time_remaining', {
        p_wallet_address: walletAddress.toLowerCase(),
      });

      if (error) throw error;

      setRemainingSeconds(data || 0);
      setIsLoading(false);

      // Start session tracking
      if (!sessionStartRef.current) {
        sessionStartRef.current = new Date();
        lastSaveRef.current = null;
      }
    } catch (error) {
      console.error('Error fetching remaining time:', error);
      setIsLoading(false);
    }
  }

  // Start countdown timer for freemium users
  useEffect(() => {
    if (!isFreemiumUser || remainingSeconds === null || remainingSeconds <= 0) {
      return;
    }

    // Update countdown every second
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isFreemiumUser, remainingSeconds]);

  /**
   * Saves the unsaved portion of the current session to Supabase.
   * Uses `lastSaveRef` as the window start so periodic calls don't
   * double-count time; updates `lastSaveRef` after each successful save.
   */
  const saveSessionDuration = useCallback(async () => {
    if (!walletAddress || !isFreemiumUser || !sessionStartRef.current) {
      return;
    }

    const saveFrom = lastSaveRef.current ?? sessionStartRef.current;
    const sessionEnd = new Date();
    const durationSeconds = Math.floor(
      (sessionEnd.getTime() - saveFrom.getTime()) / 1000
    );

    // Only save if the unsaved window is longer than 5 seconds
    if (durationSeconds < 5) return;

    try {
      await supabase.from('freemium_chat_sessions').insert({
        wallet_address: walletAddress.toLowerCase(),
        session_start: saveFrom.toISOString(),
        session_end: sessionEnd.toISOString(),
        duration_seconds: durationSeconds,
      });

      console.log(`Saved freemium session: ${durationSeconds} seconds`);
      // Advance the window start so the next save only covers new time
      lastSaveRef.current = sessionEnd;
    } catch (error) {
      console.error('Error saving session duration:', error);
    }
  }, [walletAddress, isFreemiumUser, supabase]);

  // Periodic save every 30 seconds while the user is actively viewing
  useEffect(() => {
    if (!isFreemiumUser) return;

    saveIntervalRef.current = setInterval(() => {
      saveSessionDuration();
    }, 30000);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [isFreemiumUser, saveSessionDuration]);

  // Save on tab/browser close and on tab visibility change
  useEffect(() => {
    if (!isFreemiumUser) return;

    /**
     * `beforeunload` fires synchronously; async Supabase client calls are not
     * guaranteed to complete before the browser tears down the page.  Use a
     * `keepalive` fetch directly against the Supabase REST API so the browser
     * keeps the request alive even after the page unloads.
     */
    const handleBeforeUnload = () => {
      if (!walletAddress || !sessionStartRef.current) return;

      const saveFrom = lastSaveRef.current ?? sessionStartRef.current;
      const sessionEnd = new Date();
      const durationSeconds = Math.floor(
        (sessionEnd.getTime() - saveFrom.getTime()) / 1000
      );

      if (durationSeconds < 5) return;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return;

      // Update lastSaveRef optimistically so any subsequent cleanup doesn't double-save
      lastSaveRef.current = sessionEnd;

      fetch(`${supabaseUrl}/rest/v1/freemium_chat_sessions`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          wallet_address: walletAddress.toLowerCase(),
          session_start: saveFrom.toISOString(),
          session_end: sessionEnd.toISOString(),
          duration_seconds: durationSeconds,
        }),
      }).then(() => {
        console.log(`Saved freemium session on unload: ${durationSeconds} seconds`);
      }).catch((error) => {
        console.error('Error saving session on unload:', error);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveSessionDuration();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isFreemiumUser, walletAddress, saveSessionDuration]);

  // Save final session duration when the component unmounts or wallet changes
  useEffect(() => {
    return () => {
      saveSessionDuration();
    };
  }, [saveSessionDuration]);

  const remainingMinutes = remainingSeconds !== null 
    ? Math.ceil(remainingSeconds / 60) 
    : null;

  const hasTimeLeft = remainingSeconds !== null && remainingSeconds > 0;

  // ✅ MEMOIZE: Prevent new object reference on every render
  return useMemo(() => ({
    isFreemiumUser,
    remainingSeconds,
    remainingMinutes,
    hasTimeLeft,
    isLoading,
  }), [isFreemiumUser, remainingSeconds, remainingMinutes, hasTimeLeft, isLoading]);
}
