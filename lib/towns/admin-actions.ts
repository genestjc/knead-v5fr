// lib/towns/admin-actions.ts

import { client } from '@/lib/river-client'; // Your existing River client
import { ban, unban } from '@river-build/sdk';

/**
 * Ban user from Towns Protocol space
 * Requires ModifyBanning permission on your admin account
 */
export async function banUserFromTowns(userId: string, spaceId: string): Promise<void> {
  try {
    console.log('🚫 Banning user from Towns Protocol:', { userId, spaceId });
    
    await ban(client, {
      userId,
      spaceId,
    });
    
    console.log('✅ User banned from Towns Protocol');
  } catch (error) {
    console.error('❌ Failed to ban user from Towns:', error);
    throw error;
  }
}

/**
 * Unban user from Towns Protocol space
 */
export async function unbanUserFromTowns(userId: string, spaceId: string): Promise<void> {
  try {
    console.log('✅ Unbanning user from Towns Protocol:', { userId, spaceId });
    
    await unban(client, {
      userId,
      spaceId,
    });
    
    console.log('✅ User unbanned from Towns Protocol');
  } catch (error) {
    console.error('❌ Failed to unban user from Towns:', error);
    throw error;
  }
}

/**
 * Delete message from Towns Protocol
 * Requires Redact permission
 */
export async function deleteMessageFromTowns(
  channelId: string, 
  eventId: string
): Promise<void> {
  try {
    console.log('🗑️ Deleting message from Towns Protocol:', { channelId, eventId });
    
    // Use the River SDK to remove the event
    const channel = await client.stream(channelId);
    await channel.removeEvent(eventId);
    
    console.log('✅ Message deleted from Towns Protocol');
  } catch (error) {
    console.error('❌ Failed to delete message from Towns:', error);
    throw error;
  }
}
