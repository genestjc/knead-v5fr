'use client';

import { useRef, useCallback } from 'react';

interface UseTypingIndicatorOptions {
  clearDelay?: number;
}

interface UseTypingIndicatorResult {
  startTyping: () => void;
  stopTyping: () => void;
}

/**
 * Hook to manage typing indicator state.
 * Calls startTyping on input change, auto-clears after clearDelay ms of inactivity.
 * Call stopTyping on input blur.
 */
export function useTypingIndicator(
  options: UseTypingIndicatorOptions = {}
): UseTypingIndicatorResult {
  const { clearDelay = 3000 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const stopTyping = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isTypingRef.current = false;
  }, []);

  const startTyping = useCallback(() => {
    isTypingRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      timerRef.current = null;
    }, clearDelay);
  }, [clearDelay]);

  return { startTyping, stopTyping };
}
