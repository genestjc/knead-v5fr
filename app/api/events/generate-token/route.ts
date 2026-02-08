import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { roomName, walletAddress, isHost } = await req.json();

    console.log('🎫 [generate-token] Request:', { roomName, walletAddress: walletAddress?.substring(0, 8), isHost });

    if (!roomName || !walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!process.env.DAILY_API_KEY) {
      console.error('❌ DAILY_API_KEY not set in environment variables');
      return NextResponse.json(
        { success: false, error: 'Daily.co API key not configured' },
        { status: 500 }
      );
    }

    // ✅ STEP 1: Get event from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    console.log('🔍 [generate-token] Fetching event for room:', roomName);

    const { data: event, error: eventError } = await supabase
      .from('chat_events')
      .select(`
        id,
        title,
        host_id,
        guest_ids,
        status
      `)
      .eq('daily_room_name', roomName)
      .single();

    if (eventError || !event) {
      console.error('❌ [generate-token] Event not found:', eventError);
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    console.log('📋 [generate-token] Event found:', {
      id: event.id,
      title: event.title,
      host_id: event.host_id,
      guest_count: event.guest_ids?.length || 0,
    });

    // ✅ STEP 2: Get host wallet address
    const { data: hostUser, error: hostError } = await supabase
      .from('chat_users')
      .select('address')
      .eq('id', event.host_id)
      .single();

    if (hostError) {
      console.error('❌ [generate-token] Host not found:', hostError);
      return NextResponse.json(
        { success: false, error: 'Host not found' },
        { status: 404 }
      );
    }

    console.log('👤 [generate-token] Host address:', hostUser.address.substring(0, 8) + '...');

    // ✅ STEP 3: Check if user is host
    const isUserHost = hostUser.address.toLowerCase() === walletAddress.toLowerCase();
    console.log('🔐 [generate-token] Is user host?', isUserHost);

    // ✅ STEP 4: Check if user is in guest list
    let isUserGuest = false;
    if (!isUserHost && event.guest_ids && event.guest_ids.length > 0) {
      const { data: guestUsers, error: guestError } = await supabase
        .from('chat_users')
        .select('id, address')
        .in('id', event.guest_ids);

      if (guestError) {
        console.error('❌ [generate-token] Error fetching guests:', guestError);
      } else {
        console.log('👥 [generate-token] Guest addresses:', guestUsers?.map(g => g.address.substring(0, 8) + '...'));
        
        isUserGuest = guestUsers?.some(
          (guest) => guest.address.toLowerCase() === walletAddress.toLowerCase()
        ) || false;
      }
    }

    console.log('🔐 [generate-token] Is user guest?', isUserGuest);

    // ✅ STEP 5: Reject unauthorized users
    if (!isUserHost && !isUserGuest) {
      console.log('🚫 [generate-token] UNAUTHORIZED - User not host or guest');
      return NextResponse.json(
        { 
          success: false, 
          error: 'You are not authorized to join this event. Only the host and invited guests can join.' 
        },
        { status: 403 }
      );
    }

    // ✅ STEP 6: Generate token for authorized user
    const tokenPayload = {
      properties: {
        room_name: roomName,
        user_name: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
        is_owner: isUserHost, // ✅ Use actual host check
        enable_screenshare: isUserHost,
        start_video_off: false,
        start_audio_off: false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
      },
    };

    console.log('🎫 [generate-token] Generating token with payload:', {
      ...tokenPayload,
      user: walletAddress.substring(0, 8) + '...',
      role: isUserHost ? 'HOST' : 'GUEST',
    });

    const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify(tokenPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [generate-token] Daily.co error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate token' },
        { status: 500 }
      );
    }

    const data = await response.json();
    console.log('✅ [generate-token] Token generated successfully for', isUserHost ? 'HOST' : 'GUEST');

    return NextResponse.json({
      success: true,
      data: {
        token: data.token,
      },
    });
  } catch (error) {
    console.error('❌ [generate-token] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
