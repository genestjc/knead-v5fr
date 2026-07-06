import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { readMemberSession, verifyMemberRequest } from '@/lib/auth/member-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎫 [generate-token] REQUEST RECEIVED');

  try {
    let verifiedAddress: string | null = null;
    const session = readMemberSession(req);
    if (session.ok && session.address) {
      verifiedAddress = session.address;
    } else if (req.headers.get('x-wallet-address')) {
      const auth = await verifyMemberRequest(req);
      verifiedAddress = auth.ok ? auth.address! : null;
    }

    let body;
    try {
      body = await req.json();
      console.log('✅ [generate-token] Body parsed:', { roomName: body?.roomName });
    } catch (parseError) {
      console.error('❌ [generate-token] Failed to parse JSON:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { roomName, requireAuth } = body;

    if (!roomName) {
      console.error('❌ [generate-token] Missing required field: roomName');
      return NextResponse.json(
        { success: false, error: 'Missing required field: roomName' },
        { status: 400 }
      );
    }

    if (requireAuth === true && !verifiedAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing member authentication' },
        { status: 401 }
      );
    }

    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      console.error('❌ [generate-token] DAILY_API_KEY not set in environment');
      return NextResponse.json(
        { success: false, error: 'Daily.co API key not configured' },
        { status: 500 }
      );
    }
    console.log('✅ [generate-token] API key found:', apiKey.substring(0, 10) + '...');

    // Determine the caller's role from the event record — never from the client.
    // Host is resolved via chat_users.address; guests are stored as a lowercased
    // address array on the event.
    const supabase = getSupabaseAdmin();
    const { data: event } = await supabase
      .from('chat_events')
      .select('host_id, guest_addresses')
      .eq('daily_room_name', roomName)
      .maybeSingle();

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found for this room' },
        { status: 404 }
      );
    }

    let hostAddress: string | null = null;
    if (event.host_id) {
      const { data: hostUser } = await supabase
        .from('chat_users')
        .select('address')
        .eq('id', event.host_id)
        .maybeSingle();
      hostAddress = hostUser?.address?.toLowerCase() ?? null;
    }
    const guestAddresses: string[] = (event.guest_addresses ?? []).map((a: string) => a.toLowerCase());

    // Broadcast rights (is_owner) require an authenticated member whose address
    // is the event host or an admin-listed guest. Viewers do NOT need auth;
    // watching is the open free tier, so a missing/invalid session simply yields
    // a locked-down viewer token. A forged or unsigned request can never
    // escalate to broadcaster, because the role is decided solely from the
    // authenticated address.
    const isHost = !!hostAddress && verifiedAddress === hostAddress;
    const isGuest = !!verifiedAddress && guestAddresses.includes(verifiedAddress);
    const isActualViewer = !isHost && !isGuest;
    const role = isHost ? 'HOST' : isGuest ? 'GUEST' : 'VIEWER';

    // user_name: prefer the authenticated address; viewers may pass an
    // unverified, display-only walletAddress for a friendlier label in the call.
    const userName =
      verifiedAddress ||
      (typeof body.walletAddress === 'string' && body.walletAddress ? body.walletAddress : 'viewer');

    // ✅ FIXED: Removed user_data - only use Daily-supported fields
    const tokenPayload: any = {
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: isHost || isGuest,  // ✅ Both can broadcast
        enable_screenshare: isHost || false,
        start_video_off: isActualViewer ? true : false,
        start_audio_off: isActualViewer ? true : false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3,
      },
    };

    // ✅ Lock down viewers
    if (isActualViewer) {
      tokenPayload.properties.permissions = {
        canSend: false,
        hasPresence: true,
      };
    }

    console.log('🎫 [generate-token] Calling Daily.co with payload:', {
      ...tokenPayload,
      properties: {
        ...tokenPayload.properties,
        user_name: tokenPayload.properties.user_name.substring(0, 8) + '...',
      },
      role,
    });

    let dailyResponse;
    try {
      dailyResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(tokenPayload),
      });
      
      console.log('📋 [generate-token] Daily.co response status:', dailyResponse.status);
      
    } catch (fetchError) {
      console.error('❌ [generate-token] Fetch to Daily.co failed:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Daily.co' },
        { status: 500 }
      );
    }

    if (!dailyResponse.ok) {
      const errorText = await dailyResponse.text();
      console.error('❌ [generate-token] Daily.co error response:', errorText);
      return NextResponse.json(
        { success: false, error: `Daily.co API error: ${errorText}` },
        { status: dailyResponse.status }
      );
    }

    let dailyData;
    try {
      dailyData = await dailyResponse.json();
      console.log('✅ [generate-token] Daily.co response parsed successfully');
    } catch (jsonError) {
      console.error('❌ [generate-token] Failed to parse Daily.co response:', jsonError);
      return NextResponse.json(
        { success: false, error: 'Daily.co returned invalid JSON' },
        { status: 500 }
      );
    }

    console.log(`✅ [generate-token] Token generated successfully for ${role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return NextResponse.json({
      success: true,
      data: {
        token: dailyData.token,
      },
    });

  } catch (error: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [generate-token] UNEXPECTED ERROR:');
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return NextResponse.json(
      { success: false, error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
