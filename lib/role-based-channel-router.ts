/**
 * Role-Based Channel Router
 * 
 * Routes messages to appropriate channels based on user role and content type.
 * 
 * Channel Distribution Strategy:
 * - knead-contributors: Text messages from contributors only
 * - knead-participants-a: Text messages from participants (address ends 0-7)
 * - knead-participants-b: Text messages from participants (address ends 8-f)
 * - knead-files: All file uploads and IPFS content
 * 
 * This sharding reduces messages per channel from 1000+ to ~250, improving performance.
 */

import type { UserRole } from '@/lib/blockchain/check-nft-ownership';

export interface ChannelConfig {
  contributors: string;
  participantsA: string;
  participantsB: string;
  files: string;
}

/**
 * Get channel configuration from environment variables
 */
export function getChannelConfig(): ChannelConfig {
  const config = {
    contributors: process.env.NEXT_PUBLIC_CHANNEL_CONTRIBUTORS || '',
    participantsA: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_A || '',
    participantsB: process.env.NEXT_PUBLIC_CHANNEL_PARTICIPANTS_B || '',
    files: process.env.NEXT_PUBLIC_CHANNEL_FILES || '',
  };

  // Validate all channels are configured
  const missingChannels = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingChannels.length > 0) {
    console.warn('⚠️ Missing channel configuration:', missingChannels.join(', '));
    console.warn('⚠️ Falling back to default channel behavior');
  }

  return config;
}

/**
 * Determine which channel to use based on user role and content type
 * 
 * @param userAddress - Wallet address of the user
 * @param userRole - Role of the user (contributor, participant, freemium)
 * @param hasFile - Whether the message contains a file upload
 * @returns Channel ID to use for this message
 */
export function getRoleBasedChannelId(
  userAddress: string,
  userRole: UserRole,
  hasFile: boolean = false
): string {
  const config = getChannelConfig();

  // If channels not configured, return empty string to use fallback
  if (!config.contributors || !config.participantsA || !config.participantsB || !config.files) {
    return '';
  }

  // All file uploads go to files channel
  if (hasFile) {
    console.log('📎 Routing to files channel');
    return config.files;
  }

  // Contributors get their dedicated channel
  if (userRole === 'contributor') {
    console.log('👨‍💻 Routing to contributors channel');
    return config.contributors;
  }

  // Participants are sharded by last character of address
  if (userRole === 'participant') {
    const lastChar = userAddress.slice(-1).toLowerCase();
    const isGroupA = ['0', '1', '2', '3', '4', '5', '6', '7'].includes(lastChar);
    
    if (isGroupA) {
      console.log(`👥 Routing to participants-a channel (address ends with ${lastChar})`);
      return config.participantsA;
    } else {
      console.log(`👥 Routing to participants-b channel (address ends with ${lastChar})`);
      return config.participantsB;
    }
  }

  // Freemium users default to participants-a
  console.log('👀 Routing freemium user to participants-a channel');
  return config.participantsA;
}

/**
 * Get all channel IDs for subscribing to the unified timeline
 */
export function getAllChannelIds(): string[] {
  const config = getChannelConfig();
  return [
    config.contributors,
    config.participantsA,
    config.participantsB,
    config.files,
  ].filter(Boolean); // Remove any empty strings
}

/**
 * Check if virtual sharding is enabled
 */
export function isVirtualShardingEnabled(): boolean {
  const config = getChannelConfig();
  return !!(config.contributors && config.participantsA && config.participantsB && config.files);
}
