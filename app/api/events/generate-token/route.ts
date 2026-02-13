export async function POST(req: NextRequest) {
  const { roomName, walletAddress, isHost } = await req.json();
  
  // Just generate the token - no database checks needed!
  const tokenPayload = {
    properties: {
      room_name: roomName,
      user_name: walletAddress.slice(0, 8),
      is_owner: isHost, // Trust frontend - it's fine!
      enable_screenshare: isHost,
      start_video_off: false,
      start_audio_off: false,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 3,
    },
  };
  
  // Call Daily.co
  const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    },
    body: JSON.stringify(tokenPayload),
  });
  
  const data = await response.json();
  return NextResponse.json({ success: true, data: { token: data.token } });
}
