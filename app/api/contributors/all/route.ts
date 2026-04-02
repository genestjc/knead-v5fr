import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { client } from '@/thirdweb-client';
import { getContract } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { balanceOf } from 'thirdweb/extensions/erc1155';
import { getAddress } from 'viem'; // ✅ ADD THIS

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NFT_CONTRACT = process.env.NEXT_PUBLIC_CONTRIBUTOR_NFT_CONTRACT_ADDRESS!;
const CONTRIBUTOR_TOKEN_IDS = [1, 2, 3];

export async function GET() {
  try {
    console.log('🔍 Fetching all contributors from blockchain...');

    const { data: allUsers, error: dbError } = await supabase
      .from('chat_users')
      .select('address, alias, avatar, role')
      .not('address', 'is', null);

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    const contract = getContract({
      client,
      chain: base,
      address: NFT_CONTRACT,
    });

    console.log('✅ Checking', allUsers?.length || 0, 'users for contributor NFTs...');

    const contributors = [];

    for (const user of allUsers || []) {
      try {
        // ✅ Checksum the address early
        const checksummedAddress = getAddress(user.address);
        
        for (const tokenId of CONTRIBUTOR_TOKEN_IDS) {
          const balance = await balanceOf({
            contract,
            owner: checksummedAddress,
            tokenId: BigInt(tokenId),
          });

          if (balance > 0n) {
            contributors.push({
              id: checksummedAddress,
              address: checksummedAddress, // ✅ Always checksummed
              displayName: user.alias || checksummedAddress.slice(0, 8) + '...' + checksummedAddress.slice(-6),
              avatar: user.avatar,
              role: user.role,
            });
            break;
          }
        }
      } catch (error) {
        console.error(`Failed to check ${user.address}:`, error);
      }
    }

    console.log('✅ Found', contributors.length, 'contributors');

    return NextResponse.json({
      success: true,
      contributors,
    });

  } catch (error) {
    console.error('❌ Error fetching contributors:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
