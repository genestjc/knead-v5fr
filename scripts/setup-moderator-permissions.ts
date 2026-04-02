import { RiverPermission } from '@towns-protocol/web3';
import { TownsClient } from '@towns-protocol/sdk';

const spaceId = process.env.NEXT_PUBLIC_TOWNS_SPACE_ID!;
const adminAddress = 'YOUR_ADMIN_WALLET_ADDRESS'; // The wallet that needs moderator permissions

// Initialize Towns client with your bot credentials
const client = new TownsClient({
  spaceId,
  // Add your bot credentials here
});

/**
 * Sets up a Moderator role with the permissions required for chat moderation,
 * including ModifyBanning (on-chain ban/unban) and Redact (message deletion).
 *
 * Run once: npx tsx scripts/setup-moderator-permissions.ts
 */
async function setupModeratorPermissions() {
  try {
    await client.createRole({
      name: 'Moderator',
      permissions: [
        RiverPermission.Read,
        RiverPermission.Write,
        RiverPermission.React,
        RiverPermission.Redact,        // ⭐ Required for admin message deletion
        RiverPermission.ModifyBanning, // ⭐ Required for on-chain ban/unban
      ],
      // Assign to specific users via UserEntitlement
      users: [adminAddress],
    });

    console.log('✅ Moderator role created with Redact and ModifyBanning permissions');
  } catch (error) {
    console.error('❌ Failed to create role:', error);
  }
}

setupModeratorPermissions();
