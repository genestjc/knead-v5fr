import { createThirdwebClient } from 'thirdweb';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { base } from 'thirdweb/chains';
import { getContract, prepareContractCall, sendTransaction, readContract } from 'thirdweb';

// Configuration
const SPACE_FACTORY_ADDRESS = '0x8762Fa32Dd5e9B83d137C32A6CF5556292f385f3';
const YOUR_SPACE_ADDRESS = '0x616843F796B43E6ef972e7C345D2B06d85513543';
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!; // Set this in .env
const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!;

// ABI fragments we need
const PRICING_MODULES_ABI = [
  {
    "inputs": [],
    "name": "listPricingModules",
    "outputs": [
      {
        "components": [
          { "name": "name", "type": "string" },
          { "name": "module", "type": "address" }
        ],
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const MEMBERSHIP_ABI = [
  {
    "inputs": [{ "name": "module", "type": "address" }],
    "name": "setMembershipPricingModule",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "price", "type": "uint256" }],
    "name": "setMembershipPrice",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMembershipPrice",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getMembershipPricingModule",
    "outputs": [{ "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

async function main() {
  console.log('🚀 Starting Free Pricing Setup...\n');

  // Initialize client
  const client = createThirdwebClient({
    clientId: THIRDWEB_CLIENT_ID,
  });

  // Create account from private key
  const account = privateKeyToAccount({
    client,
    privateKey: PRIVATE_KEY,
  });

  console.log(`📍 Using wallet: ${account.address}\n`);

  // Step 1: Get FixedPricing module address from Space Factory
  console.log('Step 1: Fetching pricing modules from Space Factory...');
  
  const spaceFactory = getContract({
    client,
    chain: base,
    address: SPACE_FACTORY_ADDRESS,
    abi: PRICING_MODULES_ABI,
  });

  const pricingModules = await readContract({
    contract: spaceFactory,
    method: "function listPricingModules() view returns ((string name, address module)[])",
    params: [],
  });

  console.log('Available pricing modules:');
  pricingModules.forEach((module: any) => {
    console.log(`  - ${module.name}: ${module.module}`);
  });

  const fixedPricingModule = pricingModules.find(
    (m: any) => m.name === 'FixedPricing'
  );

  if (!fixedPricingModule) {
    throw new Error('❌ FixedPricing module not found!');
  }

  console.log(`\n✅ Found FixedPricing module: ${fixedPricingModule.module}\n`);

  // Step 2: Set pricing module on your space
  console.log('Step 2: Setting pricing module to FixedPricing...');
  
  const space = getContract({
    client,
    chain: base,
    address: YOUR_SPACE_ADDRESS,
    abi: MEMBERSHIP_ABI,
  });

  const setPricingModuleTx = prepareContractCall({
    contract: space,
    method: "function setMembershipPricingModule(address module)",
    params: [fixedPricingModule.module],
  });

  const receipt1 = await sendTransaction({
    transaction: setPricingModuleTx,
    account,
  });

  console.log(`✅ Pricing module set! Tx: ${receipt1.transactionHash}\n`);

  // Step 3: Set price to 0
  console.log('Step 3: Setting price to 0...');
  
  const setPriceTx = prepareContractCall({
    contract: space,
    method: "function setMembershipPrice(uint256 price)",
    params: [0n],
  });

  const receipt2 = await sendTransaction({
    transaction: setPriceTx,
    account,
  });

  console.log(`✅ Price set to 0! Tx: ${receipt2.transactionHash}\n`);

  // Step 4: Verify the changes
  console.log('Step 4: Verifying changes...');
  
  const currentModule = await readContract({
    contract: space,
    method: "function getMembershipPricingModule() view returns (address)",
    params: [],
  });

  const currentPrice = await readContract({
    contract: space,
    method: "function getMembershipPrice() view returns (uint256)",
    params: [],
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SUCCESS! Your space is now FREE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Current Pricing Module: ${currentModule}`);
  console.log(`Current Price: ${currentPrice.toString()} (should be 0)`);
  console.log(`\nView on BaseScan: https://basescan.org/address/${YOUR_SPACE_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
