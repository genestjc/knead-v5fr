import { NextResponse } from 'next/server';

// This API route returns contract addresses at RUNTIME, not build time
// This ensures client components always get the latest env var values
export async function GET() {
  return NextResponse.json({
    contributorNftAddress: process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS,
    rewardsAddress: process.env.NEXT_PUBLIC_REWARDS_CONTRACT_ADDRESS,
    usdcAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  });
}
