/**
 * Award on Reaction Hook
 * 
 * Combines Towns Protocol reactions with $TOWNS token awards.
 * When a contributor "likes" a message, it sends both a reaction and awards tokens.
 */

'use client';

import { useState } from 'react';
import { useSendReaction } from '@towns-protocol/react-sdk';
import { prepareContractCall, sendTransaction } from 'thirdweb';
import { getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { client as thirdwebClient } from '@/thirdweb-client';
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

      // Step 2: Award $TOWNS tokens via smart contract
      console.log('Awarding $TOWNS tokens...');
      
      const rewardsContractAddress = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
      
      if (!rewardsContractAddress) {
        throw new Error('Rewards contract address not configured');
      }

      const rewardsContract = getContract({
        client: thirdwebClient,
        chain: base,
        address: rewardsContractAddress,
      });

      const transaction = prepareContractCall({
        contract: rewardsContract,
        method: 'function awardTowns(address recipient, uint256 amount, string memory actionType)',
        params: [recipientAddress, BigInt(Math.floor(parseFloat(amount) * 1e18)), 'message_like'],
      });

      const result = await sendTransaction({
        transaction,
        account: activeAccount,
      });

      console.log('✅ Tokens awarded successfully:', result.transactionHash);
      toast.success(`Awarded ${amount} $TOWNS! ${reaction}`);

    } catch (error: any) {
      console.error('Error awarding tokens:', error);
      
      // Provide specific error messages
      if (error.message?.includes('user rejected')) {
        toast.error('Transaction cancelled');
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction');
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
