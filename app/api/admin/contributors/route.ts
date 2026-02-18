import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;
const CHAIN_NAME = 'base';

/**
 * Fetches all owners of a specific ERC1155 token ID by calling the Thirdweb API directly.
 * @param tokenId - The ID of the token to get owners for.
 * @returns An array of wallet addresses.
 */
async function getOwnersFromApi(tokenId: bigint): Promise<string[]> {
  const url = `https://api.thirdweb.com/v1/contract/${CHAIN_NAME}/${CONTRIBUTOR_CONTRACT_ADDRESS}/erc1155/${tokenId}/owners?limit=50000`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${THIRDWEB_SECRET_KEY}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Thirdweb API failed for token ${tokenId}: ${response.status} ${errorBody}`);
      return [];
    }

    const data = await response.json();
    return data.result?.owners || [];
  } catch (error) {
    console.error(`Failed to fetch owners for token ${tokenId}:`, error);
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS) {
      throw new Error("Missing Thirdweb environment variables for fetching contributors.");
    }

    // ✅ FIXED: Changed from 10n/11n/12n to 1n/2n/3n
    const [appointed, invited, earned] = await Promise.all([
      getOwnersFromApi(1n),
      getOwnersFromApi(2n),
      getOwnersFromApi(3n),
    ]);

    const uniqueOwnerAddresses = [...new Set([...appointed, ...invited, ...earned].map(owner => owner.toLowerCase()))];
    
    if (uniqueOwnerAddresses.length === 0) {
      return NextResponse.json<ApiResponse<any[]>>({ success: true, data: [] });
    }

    const supabase = createSupabaseAdmin();
    const { data: users, error } = await supabase.from('chat_users').select('*').in('address', uniqueOwnerAddresses);

    if (error) {
      throw new Error(`Failed to enrich contributor data from Supabase: ${error.message}`);
    }

    const formattedContributors = users.map((c) => ({
      id: c.id, 
      address: c.address, 
      displayName: c.alias || `${c.address.slice(0, 6)}...${c.address.slice(-4)}`,
      avatar: c.avatar, 
      role: c.role, 
      contributorType: c.contributor_type, 
      createdAt: new Date(c.created_at),
    }));

    return NextResponse.json<ApiResponse<any>>({ success: true, data: formattedContributors });
  } catch (error) {
    console.error('Error in GET /api/admin/contributors:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ success: false, error: errorMessage }, { status: 500 });
  }
}
