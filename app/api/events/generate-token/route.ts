import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎫 [generate-token] REQUEST RECEIVED');
  
  try {
    // ✅ STEP 1: Parse request body
    let body;
    try {
      body = await req.json();
      console.log('✅ [generate-token] Body parsed:', {
        roomName: body?.roomName,
        walletAddress: body?.walletAddress?.substring(0, 8),
        isHost: body?.isHost,
        isGuest: body?.isGuest,
        isViewer: body?.isViewer,
      });
    } catch (parseError) {
      console.error('❌ [generate-token] Failed to parse JSON:', parseError);
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { roomName, walletAddress, isHost, isGuest, isViewer } = body;

    // ✅ STEP 2: Validate required fields
    if (!roomName || !walletAddress) {
      console.error('❌ [generate-token] Missing required fields:', {
        hasRoomName: !!roomName,
        hasWalletAddress: !!walletAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: roomName or walletAddress' },
        { status: 400 }
      );
    }

    // ✅ STEP 3: Check API key
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      console.error('❌ [generate-token] DAILY_API_KEY not set in environment');
      return NextResponse.json(
        { success: false, error: 'Daily.co API key not configured' },
        { status: 500 }
      );
    }
    console.log('✅ [generate-token] API key found:', apiKey.substring(0, 10) + '...');

    // ✅ STEP 4: Build token payload based on role
    const isActualViewer = !isHost && !isGuest;
    const role = isHost ? 'HOST' : isGuest ? 'GUEST' : 'VIEWER (receive-only)';

    const tokenPayload: any = {
      properties: {
        room_name: roomName,
        user_name: walletAddress,
        is_owner: isHost || isGuest,  // ✅ FIXED: Guests also need owner permissions for broadcast
        enable_screenshare: isHost || false,
        start_video_off: isActualViewer ? true : false,
        start_audio_off: isActualViewer ? true : false,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3, // 3 hours
        // ✅ ADDED: Set user_data for participant filtering
        user_data: JSON.stringify({
          address: walletAddress.toLowerCase(),
          role,
        }),
      },
    };

    // ✅ Lock down ONLY actual viewers — hosts and guests get full camera/mic
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

    // ✅ STEP 5: Call Daily.co API
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

    // ✅ STEP 6: Parse Daily.co response
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

    // ✅ STEP 7: Return token
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
