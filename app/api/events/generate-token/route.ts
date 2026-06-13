import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyWalletRequest } from '@/lib/auth/verify-wallet-request';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎫 [generate-token] REQUEST RECEIVED');

  try {
    // The caller is the *recovered* signer — used as the Daily user_name and as
    // the identity we resolve the role against. Previously walletAddress and the
    // isHost/isGuest flags came straight from the client, so anyone who knew a
    // room name could mint themselves an owner/broadcaster token.
    const auth = await verifyWalletRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }
    const walletAddress = auth.address!;

    let body;
    try {
      body = await req.json();
      console.log('✅ [generate-token] Body parsed:', {
        roomName: body?.roomName,
        walletAddress: walletAddress.substring(0, 8),
      });
    } catch (parseError) {
      console.error('❌ [generate-token] Failed to parse JSON:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { roomName } = body;

    if (!roomName) {
      console.error('❌ [generate-token] Missing required field: roomName');
      return NextResponse.json(
        { success: false, error: 'Missing required field: roomName' },
        { status: 400 }
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

    const isHost = !!hostAddress && walletAddress === hostAddress;
    const isGuest = guestAddresses.includes(walletAddress);
    const isActualViewer = !isHost && !isGuest;
    const role = isHost ? 'HOST' : isGuest ? 'GUEST' : 'VIEWER';

    // ✅ FIXED: Removed user_data - only use Daily-supported fields
    const tokenPayload: any = {
      properties: {
        room_name: roomName,
        user_name: walletAddress,
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
