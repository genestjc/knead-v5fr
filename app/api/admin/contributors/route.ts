import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import type { ApiResponse } from '@/types/chat';
import { createThirdwebClient, getContract } from "thirdweb";
import { getAllOwners } from "thirdweb/extensions/erc1155"; // CORRECTED: The function is getAllOwners
import { base } from "thirdweb/chains";

export const dynamic = 'force-dynamic';

const THIRDWEB_SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;
const CONTRIBUTOR_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS;

export async function GET(req: NextRequest) {
  try {
    if (!THIRDWEB_SECRET_KEY || !CONTRIBUTOR_CONTRACT_ADDRESS) {
      throw new Error("Missing Thirdweb environment variables for fetching contributors.");
    }
    
    const client = createThirdwebClient({ secretKey: THIRDWEB_SECRET_KEY });
    const contract = getContract({ client, address: CONTRIBUTOR_CONTRACT_ADDRESS, chain: base });

    // Correctly fetch all owners for each token ID
    const [appointed, invited, earned] = await Promise.all([
        getAllOwners({ contract, tokenId: 10n }),
        getAllOwners({ contract, tokenId: 11n }),
        getAllOwners({ contract, tokenId: 12n }),
    ]);

    const allOwnerAddresses = [...appointed, ...invited, ...earned];
    const uniqueOwnerAddresses = [...new Set(allOwnerAddresses.map(owner => owner.toLowerCase()))];
    
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
      displayName: c.alias || c.display_name,
      avatar: c.avatar,
      role: c.role,
      contributorType: c.contributor_type, 
      createdAt: new Date(c.created_at),
    }));

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: formattedContributors,
    });
  } catch (error) {
    console.error('Error in GET /api/admin/contributors:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ success: false, error: errorMessage }, { status: 500 });
  }
}
