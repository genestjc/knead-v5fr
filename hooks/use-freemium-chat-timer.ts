/**
 * Freemium Chat Timer Hook
 * 
 * Tracks and enforces the 1 hour/month viewing limit for freemium users (Token ID 0 only).
 * Uses Supabase to store session data and calculate remaining time.
 */

'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
  
  const supabase = createClientComponentClient();
  const sessionStartRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Save session duration when component unmounts or wallet changes
  useEffect(() => {
    return () => {
      saveSessionDuration();
    };
  }, [walletAddress]);

  async function saveSessionDuration() {
    if (!walletAddress || !isFreemiumUser || !sessionStartRef.current) {
      return;
    }

    const sessionEnd = new Date();
    const durationSeconds = Math.floor(
      (sessionEnd.getTime() - sessionStartRef.current.getTime()) / 1000
    );

    // Only save if session was longer than 5 seconds
    if (durationSeconds < 5) return;

    try {
      await supabase.from('freemium_chat_sessions').insert({
        wallet_address: walletAddress.toLowerCase(),
        session_start: sessionStartRef.current.toISOString(),
        session_end: sessionEnd.toISOString(),
        duration_seconds: durationSeconds,
      });

      console.log(`Saved freemium session: ${durationSeconds} seconds`);
    } catch (error) {
      console.error('Error saving session duration:', error);
    }

    // Reset session start
    sessionStartRef.current = null;
  }

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
