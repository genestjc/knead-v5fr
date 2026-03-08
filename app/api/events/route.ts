const {
  title,
  description,
  channelId,
  eventType,
  scheduledStart,
  scheduledEnd,
  videoEnabled,
  hostId,
  guestAddresses = [],
  guestOnlyEvent = false,
  musicMode = false, // ✅ ADDED
} = await req.json();

// ... validation code ...

// ✅ Create Daily.co room with music mode support
if (videoEnabled) {
  const roomConfig: any = {
    name: roomName,
    properties: {
      enable_chat: false,
      enable_screenshare: true,
      enable_knocking: false,
      enable_prejoin_ui: false,
      start_video_off: false,
      start_audio_off: false,
      owner_only_broadcast: true,
      // ✅ MUSIC MODE: High-quality audio settings
      ...(musicMode && {
        enable_advanced_audio: true,
        audio_codec: 'opus',
        opus_params: {
          maxaveragebitrate: 510000, // Studio quality
          stereo: true,
          useinbandfec: true,
          usedtx: false,
        },
      }),
    },
  };

  try {
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify(roomConfig),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Daily.co error:', errorText);
      throw new Error(`Daily.co error: ${response.status}`);
    }

    const room = await response.json();
    roomUrl = room.url;
    console.log('✅ Daily.co room created:', roomUrl);
  } catch (error: any) {
    console.error('Failed to create Daily.co room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create video room' },
      { status: 500 }
    );
  }
}

// ... then insert into database with music_mode field ...

const { data: event, error: eventError } = await supabase
  .from('chat_events')
  .insert({
    title,
    description,
    channel_id: channelId,
    event_type: eventType,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    status: 'scheduled',
    video_enabled: videoEnabled,
    host_id: hostId,
    daily_room_url: roomUrl,
    daily_room_name: roomName,
    guest_addresses: guestAddresses,
    guest_only_event: guestOnlyEvent,
    music_mode: musicMode, // ✅ ADDED
  })
  .select()
  .single();
