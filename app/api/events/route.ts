import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/chat-client';
import { createOnChainEvent, EventType } from '@/lib/blockchain/event-management';
import type { ApiResponse } from '@/types/chat';

// Constants
const DEFAULT_RSVP_CAP = 999999; // Default max participants for events

export const dynamic = 'force-dynamic';

// ============================================
// GET - Fetch events (for chat to check live events)
// ============================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    console.log('[GET /api/events] Fetching events with status:', status);

    const supabase = createSupabaseAdmin();

    let query = supabase
      .from('chat_events')
      .select('*')
      .order('scheduled_start', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('[GET /api/events] Error:', error);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    console.log('[GET /api/events] Found events:', events?.length || 0);

    if (!events || events.length === 0) {
      return NextResponse.json<ApiResponse<any>>({
        success: true,
        data: [],
      });
    }

    // Fetch host and guest data
    const eventsWithUsers = await Promise.all(
      events.map(async (event) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[GET /api/events] Processing event:', event.title);
        console.log('   Event ID:', event.id);
        console.log('   guest_ids from DB:', event.guest_ids);
        console.log('   guest_ids type:', typeof event.guest_ids);
        console.log('   guest_ids is array?', Array.isArray(event.guest_ids));
        console.log('   guest_ids length:', event.guest_ids?.length || 0);
        
        // Fetch host
        let host = null;
        if (event.host_id) {
          const { data: hostData } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias, avatar')
            .eq('id', event.host_id)
            .single();
          host = hostData;
          console.log('   Host:', host?.address || 'not found');
        }

        // Fetch guests
        let guests = [];
        if (event.guest_ids && Array.isArray(event.guest_ids) && event.guest_ids.length > 0) {
          console.log('   Fetching guests for IDs:', event.guest_ids);
          
          const { data: guestData, error: guestError } = await supabase
            .from('chat_users')
            .select('id, address, display_name, alias, avatar')
            .in('id', event.guest_ids);
          
          console.log('   Guest query error:', guestError);
          console.log('   Guest data returned:', guestData);
          console.log('   Number of guests found:', guestData?.length || 0);
          
          if (guestData) {
            guestData.forEach((g, i) => {
              console.log(`   Guest ${i + 1}:`, {
                id: g.id,
                address: g.address,
                name: g.alias || g.display_name
              });
            });
          }
          
          guests = guestData || [];
        } else {
          console.log('   No guest_ids or empty array');
        }
        
        console.log('   Final guests count:', guests.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          channelId: event.channel_id,
          eventType: event.event_type,
          scheduledStart: event.scheduled_start,
          scheduledEnd: event.scheduled_end,
          status: event.status,
          videoEnabled: event.video_enabled,
          dailyRoomUrl: event.daily_room_url,
          dailyRoomName: event.daily_room_name,
          host: host
            ? {
                id: host.id,
                address: host.address,
                displayName: host.display_name,
                alias: host.alias,
                avatar: host.avatar,
              }
            : null,
          guests: guests.map((g) => ({
            id: g.id,
            address: g.address,
            displayName: g.display_name,
            alias: g.alias,
            avatar: g.avatar,
          })),
          createdAt: event.created_at,
          updatedAt: event.updated_at,
        };
      })
    );

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: eventsWithUsers,
    });
  } catch (error) {
    console.error('[GET /api/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create event
// ============================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      description,
      channelId,
      eventType,
      scheduledStart,
      scheduledEnd,
      videoEnabled,
      hostId,
      guestAddresses = [], // ✅ Receive addresses instead of IDs
    } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📥 [POST /api/events] Creating event');
    console.log('   Title:', title);
    console.log('   Guest addresses received:', guestAddresses);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Validate required fields
    if (!title || !channelId || !eventType || !hostId || !scheduledStart || !scheduledEnd) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `Missing required fields`,
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();

    // Verify host exists
    const { data: host, error: hostError } = await supabase
      .from('chat_users')
      .select('id')
      .eq('id', hostId)
      .single();

    if (hostError || !host) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Host user not found' },
        { status: 404 }
      );
    }

    // ✅ LOOK UP OR CREATE GUEST USER IDs FROM ADDRESSES
    let guestIds: string[] = [];

    if (guestAddresses.length > 0) {
      console.log('🔍 Looking up/creating guest user IDs...');
      
      for (const address of guestAddresses) {
        console.log(`   Processing address: ${address}`);
        
        // Check if user exists - use error handling
        const { data: existingUser, error: lookupError } = await supabase
          .from('chat_users')
          .select('id')
          .ilike('address', address)
          .maybeSingle(); // ✅ Use maybeSingle() instead of single()
        
        console.log(`   Lookup result for ${address}:`, { 
          found: !!existingUser, 
          error: lookupError?.message 
        });
        
        if (existingUser && !lookupError) {
          console.log(`   ✅ Found user for ${address}: ${existingUser.id}`);
          guestIds.push(existingUser.id);
        } else {
          // Create user entry for this address
          console.log(`   ⚠️ No user found for ${address}, creating...`);
          
          const { data: newUser, error: createError } = await supabase
            .from('chat_users')
            .insert({
              address: address.toLowerCase(), // ✅ Ensure lowercase
              display_name: `Guest ${address.slice(0, 8)}`,
              role: 'user',
            })
            .select('id')
            .single();
          
          if (newUser && !createError) {
            console.log(`   ✅ Created user: ${newUser.id}`);
            guestIds.push(newUser.id);
          } else {
            console.error(`   ❌ Failed to create user for ${address}:`, createError);
          }
        }
      }
      
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Final guest IDs:', guestIds);
      console.log('   Final guest count:', guestIds.length);
      console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Create Daily.co room if video is enabled
    let dailyRoomUrl = null;
    let dailyRoomName = null;

    if (videoEnabled && process.env.DAILY_API_KEY) {
      try {
        const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
          },
          body: JSON.stringify({
            name: `knead-event-${Date.now()}`,
            properties: {
              enable_screenshare: true,
              enable_chat: true,
              start_video_off: false,
              start_audio_off: false,
              max_participants: 50,
            },
          }),
        });

        if (dailyResponse.ok) {
          const dailyData = await dailyResponse.json();
          dailyRoomUrl = dailyData.url;
          dailyRoomName = dailyData.name;
          console.log('[POST /api/events] Created Daily.co room:', dailyRoomName);
        } else {
          console.error('[POST /api/events] Failed to create Daily.co room:', await dailyResponse.text());
        }
      } catch (dailyError) {
        console.error('[POST /api/events] Error creating Daily.co room:', dailyError);
      }
    }

    // Create on-chain event for Live/Discussion events
    if (eventType === 'live' || eventType === 'discussion') {
      try {
        const startTimestamp = Math.floor(new Date(scheduledStart).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(scheduledEnd).getTime() / 1000);
        const chainEventType = eventType === 'live' ? EventType.Live : EventType.Discussion;
        
        await createOnChainEvent(
          title,
          startTimestamp,
          endTimestamp,
          chainEventType,
          DEFAULT_RSVP_CAP
        );
        
        console.log('[POST /api/events] Created on-chain event for:', title);
      } catch (chainError) {
        console.error('[POST /api/events] Error creating on-chain event:', chainError);
      }
    }

    // ✅ INSERT EVENT WITH GUEST IDs
    console.log('💾 Inserting event with guest_ids:', guestIds);
    
    const { data: event, error: insertError } = await supabase
      .from('chat_events')
      .insert({
        title,
        description,
        channel_id: channelId,
        event_type: eventType,
        host_id: hostId,
        guest_ids: guestIds,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status: 'scheduled',
        video_enabled: videoEnabled,
        daily_room_url: dailyRoomUrl,
        daily_room_name: dailyRoomName,
      })
      .select()
      .single();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 INSERT RESULT');
    console.log('   Success:', !insertError);
    console.log('   Event created with guest_ids:', event?.guest_ids);
    console.log('   Guest count:', event?.guest_ids?.length || 0);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (insertError) {
      console.error('[POST /api/events] Error creating event:', insertError);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Failed to create event' },
        { status: 500 }
      );
    }

    console.log('[POST /api/events] Event created successfully:', event.id);

    return NextResponse.json<ApiResponse<any>>({
      success: true,
      data: event,
      message: 'Event created successfully',
    });
  } catch (error) {
    console.error('[POST /api/events] Exception:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
