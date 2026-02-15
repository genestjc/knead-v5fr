/**
 * Role-Based Channel Router
 * 
 * Routes messages to different channels based on user role to distribute load.
 * This creates "virtual sharding" - messages are split across channels but
 * displayed as one unified timeline.
 */

/**
 * Get all channel IDs for sharding
 */
export function getAllChannelIds(): string[] {
  return [
    process.env.NEXT_PUBLIC_CHANNEL_CONTRIBUTORS || '',
    process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A || '',
    process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B || '',
    process.env.NEXT_PUBLIC_CHANNEL_FILES || '',
  ];
}

/**
 * Check if virtual sharding is enabled
 * Returns true only if all channel IDs are configured
 */
export function isVirtualShardingEnabled(): boolean {
  return false; // ✅ TEMPORARILY DISABLED FOR TESTING
  
  // Original logic - re-enable once channels are verified to work:
  // const channelIds = getAllChannelIds();
  // return channelIds.every(id => id && id.length > 0);
}

/**
 * Get the appropriate channel ID for a user based on their role and address
 */
export function getChannelForUser(
  userRole: 'contributor' | 'participant' | 'freemium',
  userAddress: string,
  isFileUpload: boolean = false
): string | null {
  if (!isVirtualShardingEnabled()) {
    return null; // Use fallback channel
  }

  const channelIds = getAllChannelIds();

  // Files always go to files channel
  if (isFileUpload) {
    return channelIds[3] || null;
  }

  // Contributors go to contributors channel
  if (userRole === 'contributor') {
    return channelIds[0] || null;
  }

  // Participants are split by last character of address
  // 0-7 go to participants_a, 8-f go to participants_b
  const lastChar = userAddress.slice(-1).toLowerCase();
  const isGroupA = ['0', '1', '2', '3', '4', '5', '6', '7'].includes(lastChar);
  
  return isGroupA ? (channelIds[1] || null) : (channelIds[2] || null);
}
