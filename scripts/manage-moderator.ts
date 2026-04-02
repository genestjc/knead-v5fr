import 'dotenv/config';
import { ethers } from 'ethers';

/**
 * Grant Moderator role to a wallet address
 * 
 * Usage: npx tsx scripts/manage-moderator.ts <wallet-address>
 * Example: npx tsx scripts/manage-moderator.ts 0x506B26c791D0d9A6aa159C3F0dfa686Dc16Af382
 */

const ROLES_ABI = [
  {
    "type": "function",
    "name": "addRoleToEntitlement",
    "inputs": [
      { "name": "roleId", "type": "uint256" },
      {
        "name": "entitlement",
        "type": "tuple",
        "components": [
          { "name": "module", "type": "address" },
          { "name": "data", "type": "bytes" }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

async function main() {
  const targetWallet = process.argv[2];
  
  if (!targetWallet || !ethers.isAddress(targetWallet)) {
    console.error('❌ Please provide a valid wallet address');
    console.log('Usage: npx tsx scripts/manage-moderator.ts <wallet-address>');
    process.exit(1);
  }

  const spaceAddress = '0x616843f796b43e6ef972e7c345d2b06d85513543';
  const userEntitlementAddress = '0xF48ACE0BE661aCCEaf28B6C6f73a3651A7407712';
  const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL!;
  const privateKey = process.env.SPACE_OWNER_PRIVATE_KEY!;

  if (!rpcUrl || !privateKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const rolesContract = new ethers.Contract(spaceAddress, ROLES_ABI, wallet);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👥 Granting Moderator Role');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📍 Space: ${spaceAddress}`);
  console.log(`👤 Target wallet: ${targetWallet}`);
  console.log(`🔐 From wallet: ${wallet.address}\n`);

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encodedUsers = abiCoder.encode(['address[]'], [[targetWallet]]);

  const roleId = 3; // Moderator role

  const entitlement = {
    module: userEntitlementAddress,
    data: encodedUsers
  };

  try {
    const tx = await rolesContract.addRoleToEntitlement(roleId, entitlement);
    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log(`⏳ Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`✅ Moderator role granted! Block: ${receipt.blockNumber}\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✨ SUCCESS!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('EntitlementAlreadyExists')) {
      console.log('\n💡 This wallet may already have the Moderator role.');
    }
  }
}

main().catch(console.error);
