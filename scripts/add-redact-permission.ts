import { RiverPermission } from '@towns-protocol/web3';
import { TownsClient } from '@towns-protocol/sdk';

const spaceId = process.env.NEXT_PUBLIC_TOWNS_SPACE_ID!;
const adminAddress = 'YOUR_ADMIN_WALLET_ADDRESS'; // The wallet that needs redact permission

// Initialize Towns client with your bot credentials
const client = new TownsClient({
  spaceId,
  // Add your bot credentials here
});

// Create or update a role with Redact permission
async function addRedactPermission() {
  try {
    // Option 1: Create a new Moderator role
    await client.createRole({
      name: 'Moderator',
      permissions: [
        RiverPermission.Read,
        RiverPermission.Write,
        RiverPermission.React,
        RiverPermission.Redact,           // ⭐ THIS IS CRITICAL
        RiverPermission.ModifyBanning,
      ],
      // Assign to specific users via UserEntitlement
      users: [adminAddress],
    });
    
    console.log('✅ Moderator role created with Redact permission');
  } catch (error) {
    console.error('❌ Failed to create role:', error);
  }
}

addRedactPermission();
