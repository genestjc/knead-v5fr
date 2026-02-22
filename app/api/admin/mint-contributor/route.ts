import { NextRequest, NextResponse } from 'next/server';
import { mintContributorNFT } from '@/lib/blockchain/contributor-nft';
import { addContributorToRewards } from '@/lib/blockchain/add-contributor';

export async function POST(req: NextRequest) {
  try {
    const { recipientAddress, role, weeklyBudget, adminAddress } = await req.json();

    // Validate inputs
    if (!recipientAddress || !role || !adminAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields: recipientAddress, role, and adminAddress are required' 
      }, { status: 400 });
    }

    if (!weeklyBudget || weeklyBudget <= 0) {
      return NextResponse.json({ 
        error: 'Weekly budget must be greater than 0' 
      }, { status: 400 });
    }

    // Map role to contributor type
    const contributorTypeMap = {
      'appointed': 0,
      'invited': 1,
      'earned': 2,
    } as const;

    const contributorType = contributorTypeMap[role as keyof typeof contributorTypeMap];

    console.log('🔄 Adding contributor:', {
      recipient: recipientAddress,
      role,
      contributorType,
      weeklyBudget,
    });

    // Step 1: Mint NFT (gives CONTRIBUTOR_ROLE on NFT contract)
    console.log('📝 Step 1: Minting NFT...');
    const mintResult = await mintContributorNFT(recipientAddress, role, adminAddress);
    console.log('✅ NFT minted:', mintResult);

    // Step 2: Add to rewards contract (sets weekly budget)
    console.log('📝 Step 2: Adding to rewards contract...');
    const rewardsResult = await addContributorToRewards(
      recipientAddress,
      contributorType,
      weeklyBudget
    );
    console.log('✅ Added to rewards contract:', rewardsResult);

    return NextResponse.json({
      success: true,
      tokenId: mintResult.tokenId,
      transactionHash: mintResult.transactionHash,
      rewardsTransactionHash: rewardsResult.transactionHash,
      message: `Contributor queued successfully! NFT mint (Token ID ${mintResult.tokenId}) and rewards setup with ${weeklyBudget} TOWNS/week submitted to ThirdWeb Engine. Transactions will confirm on-chain in ~30-60 seconds.`,
      weeklyBudget,
      contributorType: role,
    });

  } catch (error: any) {
    console.error('❌ Mint contributor error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to add contributor' 
    }, { status: 500 });
  }
}
