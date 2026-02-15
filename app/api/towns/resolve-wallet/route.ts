import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * Fallback wallet resolver
 * Queries Supabase for wallet addresses when Towns SDK can't resolve userId
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Validate userId is a string
    if (typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId type - must be a string' },
        { status: 400 }
      );
    }

    console.log('🔍 Resolving userId via Supabase:', userId);

    const supabase = getSupabaseAdmin();

    // Try to find user by user_id first
    let { data: user, error } = await supabase
      .from('chat_users')
      .select('address')
      .eq('user_id', userId)
      .single();

    // If not found by user_id, try exact match by address (userId might be the address)
    if (error || !user) {
      const addressToMatch = userId.toLowerCase();
      
      const result = await supabase
        .from('chat_users')
        .select('address')
        .eq('address', addressToMatch)
        .single();
      
      user = result.data;
      error = result.error;
    }

    if (error || !user) {
      console.warn('⚠️ No wallet found in Supabase for userId:', userId);
      return NextResponse.json({
        success: true,
        userId,
        walletAddress: null,
      });
    }

    console.log('✅ Resolved via Supabase:', { userId, walletAddress: user.address });

    return NextResponse.json({
      success: true,
      userId,
      walletAddress: user.address,
    });

  } catch (error: any) {
    console.error('❌ Failed to resolve wallet:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resolve wallet' },
      { status: 500 }
    );
  }
}
