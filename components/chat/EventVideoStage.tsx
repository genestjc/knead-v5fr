'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDaily, useDailyEvent, useParticipantIds, useLocalSessionId } from '@daily-co/daily-react';

interface DailyVideoTileProps {
  sessionId: string;
  label: string;
  isLocal: boolean;
}

function DailyVideoTile({ sessionId, label, isLocal }: DailyVideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const daily = useDaily();

  useEffect(() => {
    if (!daily || !videoRef.current) return;

    const participant = daily.participants()[sessionId];
    if (!participant) return;

    const track = participant.tracks?.video;
    if (track?.state === 'playable' && track.persistentTrack) {
      const stream = new MediaStream([track.persistentTrack]);
      videoRef.current.srcObject = stream;
    }
  }, [daily, sessionId]);

  useDailyEvent('track-started', (event) => {
    if (!event || !videoRef.current) return;
    if (event.participant?.session_id !== sessionId) return;
    if (event.track?.kind !== 'video') return;

    const stream = new MediaStream([event.track]);
    videoRef.current.srcObject = stream;
  });

  return (
    <div className="relative h-full bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-georgia-pro">
        {label}
      </div>
    </div>
  );
}

interface EventVideoStageProps {
  event: any;
  currentUserAddress: string;
  roomUrl: string;
  token: string;
}

export function EventVideoStage({ event, currentUserAddress, roomUrl, token }: EventVideoStageProps) {
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localSessionId = useLocalSessionId();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAttemptedJoinRef = useRef(false);
  const currentRoomRef = useRef<string | null>(null);

  const isHost = event.host?.address?.toLowerCase() === currentUserAddress.toLowerCase();
  const isGuest = event.guestAddresses?.some(
    (addr: string) => addr.toLowerCase() === currentUserAddress.toLowerCase()
  );
  const isViewer = !isHost && !isGuest;

  useEffect(() => {
    if (!daily || !roomUrl || !token) return;

    if (hasAttemptedJoinRef.current && currentRoomRef.current === roomUrl) {
      console.log('⚠️ [EventVideoStage] Already attempted join for this room, skipping');
      return;
    }

    if (daily.meetingState() === 'joined-meeting') {
      console.log('⚠️ [EventVideoStage] Already in a meeting, skipping join');
      return;
    }

    let isMounted = true;

    const joinCall = async () => {
      if (!isMounted) return;
      
      try {
        setJoining(true);
        setError(null);

        console.log('🎥 [EventVideoStage] Joining call...');
        console.log('   Room URL:', roomUrl);
        console.log('   Is Host:', isHost);
        console.log('   Is Guest:', isGuest);
        console.log('   Is Viewer:', isViewer);
        console.log('   Meeting State:', daily.meetingState());

        hasAttemptedJoinRef.current = true;
        currentRoomRef.current = roomUrl;

        await daily.join({
          url: roomUrl,
          token: token,
          userName: isHost ? 'Host' : isGuest ? 'Guest' : 'Viewer',
          userData: {
            role: isHost ? 'host' : isGuest ? 'guest' : 'viewer',
            address: currentUserAddress,
          },
        });

        if (!isMounted) {
          console.log('⚠️ [EventVideoStage] Component unmounted during join, leaving...');
          await daily.leave();
          return;
        }

        console.log('✅ [EventVideoStage] Joined call successfully');
      } catch (err: any) {
        console.error('❌ [EventVideoStage] Join error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to join call');
          hasAttemptedJoinRef.current = false;
          currentRoomRef.current = null;
        }
      } finally {
        if (isMounted) {
          setJoining(false);
        }
      }
    };

    joinCall();

    return () => {
      isMounted = false;
    };
  }, [daily, roomUrl, token, isHost, isGuest, isViewer, currentUserAddress]);

  useEffect(() => {
    return () => {
      if (daily && daily.meetingState() === 'joined-meeting') {
        console.log('🧹 [EventVideoStage] Cleanup: leaving call');
        daily.leave().catch(console.error);
      }
    };
  }, [daily]);

  const handleLeaveCall = async () => {
    if (daily) {
      console.log('🚪 [EventVideoStage] User manually leaving call');
      hasAttemptedJoinRef.current = false;
      currentRoomRef.current = null;
      await daily.leave();
    }
  };

  const handleEndEvent = async () => {
    if (!isHost) return;
    
    if (confirm('Are you sure you want to end this event for everyone?')) {
      try {
        const response = await fetch(`/api/admin/events/${event.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminAddress: currentUserAddress,
            status: 'ended',
          }),
        });

        if (response.ok) {
          if (daily) {
            await daily.leave();
          }
          window.location.reload();
        } else {
          alert('Failed to end event. Please try again.');
        }
      } catch (error) {
        console.error('Error ending event:', error);
        alert('Failed to end event.');
      }
    }
  };

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="font-georgia-pro text-red-500 mb-4">❌ {error}</p>
          <button
            onClick={() => {
              setError(null);
              hasAttemptedJoinRef.current = false;
              currentRoomRef.current = null;
            }}
            className="px-4 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-600">Joining video call...</p>
        </div>
      </div>
    );
  }

  const hostSessionId = participantIds.find(id => {
    if (id === localSessionId && isHost) return true;
    
    const participant = daily?.participants()[id];
    if (!participant) return false;
    
    const participantAddress = (
      participant.userData?.address || 
      participant.user_name || 
      ''
    ).toLowerCase();
    
    const hostAddress = event.host?.address?.toLowerCase() || '';
    
    return participantAddress.includes(hostAddress.slice(2, 10));
  });

  const guestSessionIds = participantIds.filter(id => id !== hostSessionId);

  console.log('🎬 [EventVideoStage] Identified participants:', {
    total: participantIds.length,
    hostSessionId,
    guestCount: guestSessionIds.length,
    localSessionId,
    isHost,
  });

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="flex-1 p-4">
        {/* DESKTOP: Host left, Guest right */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-4 h-full">
          <div>
            {hostSessionId ? (
              <DailyVideoTile
                sessionId={hostSessionId}
                label={hostSessionId === localSessionId ? "You (Host)" : "Host"}
                isLocal={hostSessionId === localSessionId}
              />
            ) : (
              <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
              </div>
            )}
          </div>

          <div className="space-y-2 overflow-y-auto">
            {guestSessionIds.length > 0 ? (
              guestSessionIds.map((guestId, index) => {
                const participant = daily?.participants()[guestId];
                // Default to 'viewer' role if userData not available yet (most conservative assumption)
                const participantRole = participant?.userData?.role || 'viewer';
                
                // Calculate guest number by counting actual guests before this one, then add 1 for current
                const guestsBeforeThis = guestSessionIds
                  .slice(0, index)
                  .filter(id => daily?.participants()[id]?.userData?.role === 'guest')
                  .length;
                const guestNumber = guestsBeforeThis + 1;
                
                return (
                  <DailyVideoTile
                    key={guestId}
                    sessionId={guestId}
                    label={
                      guestId === localSessionId
                        ? "You"
                        : participantRole === 'guest'
                          ? `Guest ${guestNumber}`
                          : "Viewer"
                    }
                    isLocal={guestId === localSessionId}
                  />
                );
              })
            ) : (
              <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
                <p className="font-georgia-pro text-gray-400">Waiting for guests...</p>
              </div>
            )}
          </div>
        </div>

        {/* MOBILE: Host top, Guest bottom */}
        <div className="lg:hidden space-y-4 h-full overflow-y-auto">
          {hostSessionId ? (
            <DailyVideoTile
              sessionId={hostSessionId}
              label={hostSessionId === localSessionId ? "You (Host)" : "Host"}
              isLocal={hostSessionId === localSessionId}
            />
          ) : (
            <div className="h-64 bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
            </div>
          )}
          
          {guestSessionIds.length > 0 ? (
            guestSessionIds.map((guestId, index) => {
              const participant = daily?.participants()[guestId];
              // Default to 'viewer' role if userData not available yet (most conservative assumption)
              const participantRole = participant?.userData?.role || 'viewer';
              
              // Calculate guest number by counting actual guests before this one, then add 1 for current
              const guestsBeforeThis = guestSessionIds
                .slice(0, index)
                .filter(id => daily?.participants()[id]?.userData?.role === 'guest')
                .length;
              const guestNumber = guestsBeforeThis + 1;
              
              return (
                <DailyVideoTile
                  key={guestId}
                  sessionId={guestId}
                  label={
                    guestId === localSessionId
                      ? "You"
                      : participantRole === 'guest'
                        ? `Guest ${guestNumber}`
                        : "Viewer"
                  }
                  isLocal={guestId === localSessionId}
                />
              );
            })
          ) : (
            <div className="h-64 bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="font-georgia-pro text-gray-400">Waiting for guests...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls bar */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-georgia-pro text-sm font-semibold text-red-600">LIVE</span>
            </div>
            <span className="font-georgia-pro text-sm text-gray-600">
              {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isHost ? (
              <button
                onClick={handleEndEvent}
                className="px-6 py-2 bg-red-600 text-white rounded-full font-georgia-pro hover:bg-red-700 transition"
              >
                End Event
              </button>
            ) : (
              <button
                onClick={handleLeaveCall}
                className="px-6 py-2 bg-gray-600 text-white rounded-full font-georgia-pro hover:bg-gray-700 transition"
              >
                Leave Call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
