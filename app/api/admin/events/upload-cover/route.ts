import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const adminAddress = formData.get('adminAddress') as string;
    const file = formData.get('file') as File;

    if (!adminAddress || !file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing adminAddress or file' },
        { status: 400 }
      );
    }

    const MASTER_ADMIN_ADDRESS = process.env.NEXT_PUBLIC_MASTER_ADMIN_WALLET;
    if (adminAddress.toLowerCase() !== MASTER_ADMIN_ADDRESS?.toLowerCase()) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `event-covers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('chat-assets')
      .upload(filename, arrayBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload-cover] Storage upload error:', uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat-assets')
      .getPublicUrl(filename);

    return NextResponse.json<ApiResponse<{ url: string }>>({
      success: true,
      data: { url: publicUrlData.publicUrl },
    });
  } catch (error) {
    console.error('[upload-cover] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
