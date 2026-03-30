import { NextResponse } from 'next/server';

// Temporary debug endpoint to check env vars - DELETE after debugging
export async function GET() {
  return NextResponse.json({
    REWARDS_CONTRACT: process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS,
    CONTRIBUTOR_NFT: process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS,
    USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  });
}
