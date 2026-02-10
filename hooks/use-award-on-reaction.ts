/**
 * Award on Reaction Hook
 * 
 * Combines Towns Protocol reactions with $TOWNS token awards.
 * When a contributor "likes" a message, it sends both a reaction and awards tokens.
 */

'use client';

import { useState } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { useActiveAccount } from 'thirdweb/react';
import { toast } from 'sonner';

interface UseAwardOnReactionResult {
  awardTokensOnLike: (
    messageId: string,
    recipientAddress: string,
    amount: string,
    reaction?: string
  ) => Promise<void>;
  isReacting: boolean;
}

/**
 * Hook to award tokens when reacting to messages
 * 
 * @param streamId - Towns Protocol stream/channel ID
 * @returns Functions to award tokens and track state
 */
export function useAwardOnReaction(streamId: string): UseAwardOnReactionResult {
  const [isReacting, setIsReacting] = useState(false);
  const { sendReaction } = useSendReaction(streamId);
  const activeAccount = useActiveAccount();

  async function awardTokensOnLike(
    messageId: string,
    recipientAddress: string,
    amount: string,
    reaction: string = '❤️'
  ): Promise<void> {
    if (!activeAccount) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsReacting(true);

    try {
      // Step 1: Send reaction to Towns Protocol
      console.log('Sending reaction to Towns Protocol...');
      await sendReaction({
        eventId: messageId,
        reaction: reaction,
      });

      // Step 2: Award $TOWNS tokens via Engine wallet (no signature required)
      console.log('Awarding $TOWNS tokens via Engine...');
      
      const response = await fetch('/api/chat/award-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contributorAddress: activeAccount.address,
          participantAddress: recipientAddress,
          amount: amount,
          actionType: 'message_like',
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to award tokens');
      }

      console.log('✅ Tokens awarded successfully:', data.transactionHash);
      toast.success(`Awarded ${amount} $TOWNS! ${reaction}\n25% goes to contributor pool.`);

    } catch (error: any) {
      console.error('Error awarding tokens:', error);
      
      // Provide specific error messages
      if (error.message?.includes('contributors with NFT')) {
        toast.error('Only contributors can award tokens');
      } else if (error.message?.includes('yourself')) {
        toast.error('Cannot award tokens to yourself');
      } else {
        toast.error(`Failed to award tokens: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsReacting(false);
    }
  }

  return {
    awardTokensOnLike,
    isReacting,
  };
}
