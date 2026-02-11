/**
 * Award on Reaction Hook
 * 
 * Combines Towns Protocol reactions with $TOWNS token awards.
 * CRITICAL: Blockchain transaction is primary, River reaction is secondary.
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
    amount: number,
    reaction?: string,
    eventId?: number
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
    amount: number = 10,
    reaction: string = '❤️',
    eventId?: number
  ): Promise<void> {
    // ✅ VALIDATION: Check all required parameters
    console.log('🎯 awardTokensOnLike called with:', {
      messageId,
      recipientAddress,
      amount,
      reaction,
      eventId: eventId !== undefined ? eventId : 'none',
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
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 1 (CRITICAL): Award $TOWNS tokens via blockchain
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━
      console.log('💰 [BLOCKCHAIN] Awarding $TOWNS tokens via Engine...');
      console.log('   From (contributor):', activeAccount.address);
      console.log('   To (participant):', recipientAddress);
      console.log('   Amount:', amount);
      console.log('   Event ID:', eventId !== undefined ? eventId : 'general');
      
      const requestBody = {
        contributorAddress: activeAccount.address,
        participantAddress: recipientAddress,
        amount: amount.toString(),
        actionType: 'message_like',
        eventId: eventId,
      };

      console.log('📤 [BLOCKCHAIN] Request body:', requestBody);
      
      const response = await fetch('/api/chat/award-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 [BLOCKCHAIN] Response status:', response.status);
      const data = await response.json();
      console.log('📥 [BLOCKCHAIN] Response data:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to award tokens');
      }

      console.log('✅ [BLOCKCHAIN] Tokens awarded successfully:', data.transactionHash);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 2 (OPTIONAL): Send reaction to River Protocol
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // This is NOT critical - if it fails, the blockchain transaction
      // already succeeded, so we still show success to the user.
      try {
        console.log('📨 [RIVER] Sending reaction to Towns Protocol...');
        await sendReaction({
          eventId: messageId,
          reaction: reaction,
        });
        console.log('✅ [RIVER] Reaction sent successfully');
      } catch (riverError: any) {
        // River failed, but blockchain succeeded - that's OK!
        console.warn('⚠️ [RIVER] Failed to send reaction (but tokens were awarded):', riverError);
        console.warn('   Error type:', riverError.name);
        console.warn('   Error message:', riverError.message);
        
        // Don't throw - we already succeeded on blockchain
        // Just log for debugging
        if (riverError.message?.includes('QUORUM_FAILED')) {
          console.warn('   → River quorum failed (network sync issue)');
        } else if (riverError.message?.includes('deadline_exceeded')) {
          console.warn('   → River timeout (nodes too slow)');
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // SHOW SUCCESS (based on blockchain, not River)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const awardTypeMessage = eventId !== undefined 
        ? `Event bonus of ${amount} $TOWNS awarded! ${reaction}`
        : `Tipped ${amount} $TOWNS! ${reaction} (25% goes to contributor pool)`;
      
      toast.success(awardTypeMessage);

    } catch (error: any) {
      // This only catches BLOCKCHAIN errors now
      console.error('❌ [BLOCKCHAIN] Error awarding tokens:', error);
      
      // Provide specific error messages
      if (error.message?.includes('contributors with NFT')) {
        toast.error('Only contributors can award tokens');
      } else if (error.message?.includes('yourself')) {
        toast.error('Cannot award tokens to yourself');
      } else if (error.message?.includes('Exceeds weekly budget')) {
        toast.error('You have exceeded your weekly token budget');
      } else if (error.message?.includes('Cooldown')) {
        toast.error('Please wait before tipping this user again (2 hour cooldown)');
      } else if (error.message?.includes('Participant not registered')) {
        toast.error('Recipient not registered (auto-registration failed)');
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
