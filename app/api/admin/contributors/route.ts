import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { formatAddressForDisplay } from '@/lib/utils/transformers';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/contributors
 * 
 * Returns list of all contributors for DM search
 * - Fetches from chat_users table
 * - Returns users with contributor, admin, or master-admin roles
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    // ✅ Fetch all contributors directly from Supabase
    const { data: users, error } = await supabase
      .from('chat_users')
      .select('*')
      .in('role', ['contributor', 'admin', 'master-admin'])
      .order('alias', { ascending: true });

    if (error) {
      console.error('Supabase error fetching contributors:', error);
      throw new Error(`Failed to fetch contributor data from Supabase: ${error.message}`);
    }

    console.log('📊 Contributors fetched from Supabase:', users?.length || 0);

    // ✅ Format for frontend
    const formattedContributors = (users || []).map((c) => ({
      id: c.id,
      address: c.address,
      displayName: c.alias || formatAddressForDisplay(c.address),
      avatar: c.avatar,
      role: c.role,
      contributorType: c.contributor_type,
      createdAt: new Date(c.created_at),
    }));

    console.log('✅ Formatted contributors:', formattedContributors.length);

    return NextResponse.json<ApiResponse<any>>({ 
      success: true, 
      data: formattedContributors 
    });

  } catch (error) {
    console.error('Error in GET /api/admin/contributors:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json<ApiResponse<null>>({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
