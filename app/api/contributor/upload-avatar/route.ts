import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { verifyMemberRequest } from '@/lib/auth/member-session';
import { rateLimit } from '@/lib/rate-limit';
import type { ApiResponse } from '@/types/chat';

export const dynamic = 'force-dynamic';

// Configuration constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const FILE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * POST /api/contributor/upload-avatar
 * Upload avatar file to Supabase Storage using server-side admin client
 * Returns the public URL of the uploaded file
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyMemberRequest(req);
    if (!auth.ok || !auth.address) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: auth.error || 'Missing wallet authentication' },
        { status: auth.status || 401 }
      );
    }

    const limit = await rateLimit('contributor-avatar-upload', auth.address, {
      limit: 10,
      windowSeconds: 60 * 60,
    });
    if (!limit.success) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Too many avatar uploads. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const userAddress = formData.get('userAddress') as string | null;

    if (!file) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userAddress) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User address is required' },
        { status: 400 }
      );
    }

    const normalizedUserAddress = userAddress.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedUserAddress)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid user address' },
        { status: 400 }
      );
    }

    if (normalizedUserAddress !== auth.address) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Authenticated wallet does not match uploaded profile' },
        { status: 403 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid file type. Please upload JPG, PNG, GIF, or WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Create unique filename
    const fileExt = FILE_EXTENSIONS[file.type] ?? 'png';
    const fileName = `${normalizedUserAddress}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Convert File to ArrayBuffer then to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('chat-assets')
      .getPublicUrl(filePath);

    console.log('✅ Avatar uploaded successfully:', publicUrl);

    return NextResponse.json<ApiResponse<{ url: string }>>({
      success: true,
      data: { url: publicUrl },
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
