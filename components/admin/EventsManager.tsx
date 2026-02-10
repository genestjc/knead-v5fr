import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import { client as thirdwebClient } from '@/thirdweb-client';

// ... (keep all your existing interfaces and state)

// ✅ NEW: Helper to get all Participant NFT holders
async function fetchAllParticipantAddresses(): Promise<string[]> {
  try {
    const participantContract = getContract({
      client: thirdwebClient,
      chain: base,
      address: process.env.NEXT_PUBLIC_NFT_CONTRACT_ADDRESS!,
    });

    // Query Transfer events for Token ID 1 (Participant/Monthly)
    // Note: ThirdWeb doesn't have a simple event query, so we'll use a simpler approach
    // For now, return empty array - you can populate this manually or via API
    console.warn('⚠️ Participant address fetching not implemented yet - using empty array');
    return [];
    
    // TODO: Implement proper event querying or maintain a list in your database
  } catch (error) {
    console.error('Error fetching participant addresses:', error);
    return [];
  }
}

// Update the handleUpdateEventStatus function:
const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
  if (isUpdating) {
    alert('Please wait for the current update to complete.');
    return;
  }

  try {
    setIsUpdating(true);
    
    // 1. Update event status in database
    const response = await fetch(`/api/admin/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminAddress, status: newStatus }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);

    console.log('✅ Event status updated in database');

    // 2. Update Event Pass NFTs on-chain (only for live/ended)
    if (newStatus === 'live' || newStatus === 'ended') {
      console.log('🎫 Updating Event Pass NFTs...');
      
      // ✅ FOR NOW: Manually enter participant addresses
      // TODO: Implement automatic fetching
      const participantAddressesInput = prompt(
        `Enter Participant wallet addresses (comma-separated):\n\nExample:\n0x123...,0x456...,0x789...`
      );
      
      if (!participantAddressesInput) {
        alert('No addresses entered. Event status updated but no passes minted/burned.');
        await fetchEvents();
        setIsUpdating(false);
        return;
      }
      
      const participantAddresses = participantAddressesInput
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.startsWith('0x'));
      
      if (participantAddresses.length === 0) {
        alert('No valid addresses found.');
        await fetchEvents();
        setIsUpdating(false);
        return;
      }

      console.log(`📋 ${participantAddresses.length} addresses provided`);

      // Get Event Pass contract
      const eventPassContract = getContract({
        client: thirdwebClient,
        chain: base,
        address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
      });

      if (newStatus === 'live') {
        // Mint Event Passes
        console.log(`🎫 Minting passes to ${participantAddresses.length} participants...`);
        
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchMintPasses(address[] memory recipients, string memory eventId)",
          params: [participantAddresses, eventId],
        });

        alert(`⏳ Minting ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
        
        // Use active account from ThirdWeb hook
        const account = useActiveAccount();
        if (!account) {
          throw new Error('No active wallet account');
        }

        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        console.log(`✅ Passes minted! Tx: ${txResult.transactionHash}`);
        alert(`✅ Event Started!\n\n${participantAddresses.length} Event Passes minted!\n\nParticipants can now message in chat.\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
        
      } else if (newStatus === 'ended') {
        // Burn Event Passes
        console.log(`🔥 Burning passes from ${participantAddresses.length} participants...`);
        
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchBurnPasses(address[] memory holders)",
          params: [participantAddresses],
        });

        alert(`⏳ Burning ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
        
        const account = useActiveAccount();
        if (!account) {
          throw new Error('No active wallet account');
        }

        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        console.log(`✅ Passes burned! Tx: ${txResult.transactionHash}`);
        alert(`✅ Event Ended!\n\n${participantAddresses.length} Event Passes burned!\n\nParticipants can no longer message.\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
      }
    } else {
      alert(`Event status updated to: ${newStatus}`);
    }

    // Refresh events list
    await fetchEvents();
  } catch (err: any) {
    console.error('Error updating event:', err);
    alert(`Failed to update event: ${err.message || 'Unknown error'}`);
  } finally {
    setIsUpdating(false);
  }
};
