/**
 * Award on Reaction Hook
 * 
 * Combines Towns Protocol reactions with USDC rewards.
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
    amount: number = 10,
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
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 1 (CRITICAL): Award USDC via blockchain
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      console.log('💰 [BLOCKCHAIN] Awarding USDC via Engine...');
      console.log('   From (contributor):', activeAccount.address);
      console.log('   To (participant):', recipientAddress);
      console.log('   Amount:', amount);
      console.log('   Message ID (Towns eventId):', messageId);
      
      const requestBody = {
        contributorAddress: activeAccount.address,
        participantAddress: recipientAddress,
        amount: amount.toString(),
        actionType: 'message_like',
        messageId: messageId, // Towns Protocol message ID (their eventId)
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

      console.log('✅ [BLOCKCHAIN] USDC awarded successfully:', data.transactionHash);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 2 (OPTIONAL): Send reaction to River Protocol
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // This is NOT critical - if it fails, the blockchain transaction
      // already succeeded, so we still show success to the user.
      try {
        console.log('📨 [RIVER] Sending reaction to Towns Protocol...');
        await sendReaction(messageId, reaction);
        console.log('✅ [RIVER] Reaction sent successfully');
      } catch (riverError: any) {
        // River failed, but blockchain succeeded - that's OK!
        console.warn('⚠️ [RIVER] Failed to send reaction (but USDC was awarded):', riverError);
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
      toast.success(`Tipped $${amount.toFixed(2)} ${reaction} (You get 20% cashback)`);

      // Notify earnings counters to refresh for this message
      window.dispatchEvent(new CustomEvent('message-tipped', {
        detail: { messageId }
      }));

    } catch (error: any) {
      // This only catches BLOCKCHAIN errors now
      console.error('❌ [BLOCKCHAIN] Error awarding USDC:', error);
      
      // Provide specific error messages
      if (error.message?.includes('contributors with NFT')) {
        toast.error('Only contributors can award USDC');
      } else if (error.message?.includes('yourself')) {
        toast.error('Cannot award USDC to yourself');
      } else if (error.message?.includes('Exceeds weekly budget')) {
        toast.error('You have exceeded your weekly budget');
      } else if (error.message?.includes('Cooldown')) {
        toast.error('Please wait before tipping this user again (cooldown active)');
      } else if (error.message?.includes('Participant not registered')) {
        toast.error('Recipient not registered (auto-registration failed)');
      } else {
        toast.error(`Failed to award USDC: ${error.message || 'Unknown error'}`);
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
