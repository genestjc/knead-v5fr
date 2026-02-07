import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/chat-client";
import type { ApiResponse } from '@/types/chat';

const isAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);

export async function POST(req: NextRequest) {
  try {
    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;

    const { ownerAddress, adminAddress } = await req.json();

    if (!ownerAddress || !adminAddress) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: "Missing required fields." 
      }, { status: 400 });
    }

    if (!isAddress(ownerAddress) || !isAddress(adminAddress)) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: "Invalid address format." 
      }, { status: 400 });
    }

    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: "Unauthorized" 
      }, { status: 401 });
    }

    // Just update database (no on-chain burn for now)
    const supabase = createSupabaseAdmin();
    const { error: updateError } = await supabase
      .from('chat_users')
      .update({ 
        role: 'viewer', 
        contributor_type: null 
      })
      .eq('address', ownerAddress.toLowerCase());

    if (updateError) {
      console.error('Error revoking contributor:', updateError);
      return NextResponse.json<ApiResponse<null>>({ 
        success: false, 
        error: 'Failed to revoke contributor status' 
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<null>>({ 
      success: true, 
      message: 'Contributor status revoked successfully (database only)'
    });

  } catch (error) {
    console.error("Revocation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
