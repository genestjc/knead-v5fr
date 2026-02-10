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
    amount: number, // ✅ Changed from string to number
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
    amount: number = 10, // ✅ Default to 10 TOWNS
    reaction: string = '❤️'
  ): Promise<void> {
    // ✅ VALIDATION: Check all required parameters
    console.log('🎯 awardTokensOnLike called with:', {
      messageId,
      recipientAddress,
      amount,
      reaction,
      activeAccount: activeAccount?.address,
    });

    if (!activeAccount?.address) {
      console.error('❌ No active account');
      toast.error('Please connect your wallet');
      return;
    }

    if (!messageId) {
      console.error('❌ No message ID provided');
      toast.error('Invalid message');
      return;
    }

    if (!recipientAddress) {
      console.error('❌ No recipient address provided');
      toast.error('Cannot identify message recipient');
      return;
    }

    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      toast.error('Invalid tip amount');
      return;
    }

    // ✅ Prevent self-tipping
    if (activeAccount.address.toLowerCase() === recipientAddress.toLowerCase()) {
      toast.error('You cannot tip yourself');
      return;
    }

    setIsReacting(true);

    try {
      // Step 1: Send reaction to Towns Protocol
      console.log('📨 Sending reaction to Towns Protocol...');
      await sendReaction({
        eventId: messageId,
        reaction: reaction,
      });
      console.log('✅ Reaction sent');

      // Step 2: Award $TOWNS tokens via Engine wallet
      console.log('💰 Awarding $TOWNS tokens via Engine...');
      console.log('   From (contributor):', activeAccount.address);
      console.log('   To (participant):', recipientAddress);
      console.log('   Amount:', amount);
      
      const requestBody = {
        contributorAddress: activeAccount.address,
        participantAddress: recipientAddress,
        amount: amount.toString(), // ✅ Convert to string for API
        actionType: 'message_like',
      };

      console.log('📤 Request body:', requestBody);
      
      const response = await fetch('/api/chat/award-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status);
      const data = await response.json();
      console.log('📥 Response data:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to award tokens');
      }

      console.log('✅ Tokens awarded successfully:', data.transactionHash);
      toast.success(`Tipped ${amount} $TOWNS! ${reaction} (25% goes to contributor pool)`);

    } catch (error: any) {
      console.error('❌ Error awarding tokens:', error);
      
      // Provide specific error messages
      if (error.message?.includes('contributors with NFT')) {
        toast.error('Only contributors can award tokens');
      } else if (error.message?.includes('yourself')) {
        toast.error('Cannot award tokens to yourself');
      } else if (error.message?.includes('Exceeds weekly budget')) {
        toast.error('You have exceeded your weekly token budget');
      } else if (error.message?.includes('Cooldown')) {
        toast.error('Please wait before tipping this user again (2 hour cooldown)');
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
