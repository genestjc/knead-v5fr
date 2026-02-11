/**
 * Event Management System
 * 
 * Utilities for managing on-chain events and syncing with Daily.co events.
 * Handles event creation, attendance tracking, and event ID mapping.
 */

import { createThirdwebClient, getContract, prepareContractCall, readContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { sendTransaction as sendEngineTransaction } from 'thirdweb/transaction';
import { serverWallet } from '@/thirdweb-server-wallet';

const client = createThirdwebClient({
  secretKey: process.env.THIRDWEB_SECRET_KEY!,
});

/**
 * Get the rewards contract instance
 */
function getRewardsContract() {
  const address = process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS;
  
  if (!address) {
    throw new Error(
      'NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS not set. This contract address is required for event management.'
    );
  }
  
  return getContract({
    client,
    address,
    chain: base,
  });
}

/**
 * Event type mapping
 * 0 = Live (Daily video events)
 * 1 = Discussion
 * 2 = Essay
 */
export enum EventType {
  Live = 0,
  Discussion = 1,
  Essay = 2,
}

/**
 * Create an on-chain event
 * 
 * @param title - Event title
 * @param startTime - Event start timestamp (Unix seconds)
 * @param endTime - Event end timestamp (Unix seconds)
 * @param eventType - Type of event (0=Live, 1=Discussion, 2=Essay)
 * @param rsvpCap - Maximum number of attendees (0 for unlimited)
 * @returns On-chain event ID
 * 
 * TODO: Parse event ID from transaction receipt logs
 * The contract emits an EventCreated event with the new event ID
 * Currently returns 0 as placeholder - needs log parsing implementation
 */
export async function createOnChainEvent(
  title: string,
  startTime: number,
  endTime: number,
  eventType: EventType = EventType.Live,
  rsvpCap: number = 0
): Promise<number> {
  try {
    const rewardsContract = getRewardsContract();
    
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function createEvent(string _title, uint256 _startTime, uint256 _endTime, uint8 _eventType, uint256 _rsvpCap) returns (uint256)',
      params: [title, BigInt(startTime), BigInt(endTime), eventType, BigInt(rsvpCap)],
    });
    
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ On-chain event created:', {
      title,
      startTime,
      endTime,
      eventType,
      rsvpCap,
      txHash: receipt.transactionHash,
    });
    
    // TODO: Parse the event ID from the transaction receipt logs
    // The createEvent function returns the eventId, which can be extracted from logs
    // For now, return 0 as placeholder
    // In production, parse from receipt.logs for EventCreated event
    console.warn('⚠️ Event ID parsing not implemented - returning placeholder 0');
    
    return 0;
  } catch (error) {
    console.error('Error creating on-chain event:', error);
    throw new Error(
      `Failed to create on-chain event: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Mark attendance for a user at an event
 * 
 * @param eventId - On-chain event ID
 * @param participantAddress - Participant's wallet address
 * @returns Transaction hash
 */
export async function markEventAttendance(
  eventId: number,
  participantAddress: string
): Promise<{ transactionHash: string }> {
  try {
    const rewardsContract = getRewardsContract();
    
    const transaction = prepareContractCall({
      contract: rewardsContract,
      method: 'function markAttendance(uint256 _eventId, address _participant)',
      params: [BigInt(eventId), participantAddress],
    });
    
    const receipt = await sendEngineTransaction({
      transaction,
      account: serverWallet,
    });
    
    console.log('✅ Attendance marked:', {
      eventId,
      participant: participantAddress,
      txHash: receipt.transactionHash,
    });
    
    return {
      transactionHash: receipt.transactionHash,
    };
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw new Error(
      `Failed to mark attendance: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get on-chain event ID from Daily event ID
 * 
 * In a production implementation, this would:
 * 1. Query a database mapping table (Daily ID -> On-chain ID)
 * 2. Or query the contract for event details by title/time
 * 
 * Current limitation: Since createOnChainEvent returns 0 as placeholder,
 * this function returns the Daily event ID as-is until proper log parsing
 * is implemented.
 * 
 * TODO: Implement proper event ID mapping
 * - Add on_chain_event_id column to chat_events table
 * - Store mapping when creating on-chain event
 * - Query from database instead of assuming IDs match
 * 
 * @param dailyEventId - Daily.co event ID from Supabase
 * @returns On-chain event ID
 */
export async function getOnChainEventId(dailyEventId: number): Promise<number> {
  // TODO: Query mapping from database
  // For now, return the Daily event ID as-is
  // This is a known limitation until proper event ID mapping is implemented
  console.warn('⚠️ Event ID mapping not implemented - using Daily event ID as placeholder');
  return dailyEventId;
}

/**
 * Check if an event exists on-chain
 * 
 * @param eventId - Event ID to check
 * @returns True if event exists
 */
export async function eventExists(eventId: number): Promise<boolean> {
  try {
    const rewardsContract = getRewardsContract();
    
    const eventData = await readContract({
      contract: rewardsContract,
      method: 'function getEventDetails(uint256) view returns (string title, uint256 startTime, uint256 endTime, uint8 eventType, uint256 rsvpCap, uint256 attendeeCount, bool isActive)',
      params: [BigInt(eventId)],
    });
    
    // If we got data back, the event exists
    return eventData !== null && eventData[0] !== '';
  } catch (error) {
    console.error('Error checking event existence:', error);
    return false;
  }
}
