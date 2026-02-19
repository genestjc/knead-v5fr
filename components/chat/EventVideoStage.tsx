'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDaily, useParticipantIds, useLocalSessionId, DailyVideo } from '@daily-co/daily-react';

interface DailyVideoTileProps {
  sessionId: string;
  label: string;
  isLocal: boolean;
}

function DailyVideoTile({ sessionId, label, isLocal }: DailyVideoTileProps) {
  return (
    <div className="relative h-full bg-gray-900 rounded-lg overflow-hidden">
      <DailyVideo
        sessionId={sessionId}
        automirror={isLocal}
        type="video"
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

const JOIN_TIMEOUT_MS = 10000;

export function EventVideoStage({ event, currentUserAddress, roomUrl, token }: EventVideoStageProps) {
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localSessionId = useLocalSessionId();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasJoinedRef = useRef(false);
  const joinedRoomRef = useRef<string | null>(null);

  const isHost = event.host?.address?.toLowerCase() === currentUserAddress.toLowerCase();
  const isGuest = event.guestAddresses?.some(
    (addr: string) => addr.toLowerCase() === currentUserAddress.toLowerCase()
  );
  const isViewer = !isHost && !isGuest;

  useEffect(() => {
    if (!daily || !roomUrl || !token) {
      console.log('⚠️ [EventVideoStage] Missing requirements:', {
        hasDaily: !!daily,
        hasRoomUrl: !!roomUrl,
        hasToken: !!token,
      });
      return;
    }

    if (hasJoinedRef.current && joinedRoomRef.current === roomUrl) {
      console.log('⚠️ [EventVideoStage] This user already joined this room');
      return;
    }

    const meetingState = daily.meetingState();
    if (meetingState === 'joined-meeting') {
      const participants = daily.participants();
      const localParticipant = participants.local;

      if (localParticipant && localParticipant.session_id) {
        console.log('⚠️ [EventVideoStage] Already connected to this call');
        return;
      }
    }

    let isMounted = true;

    const joinCall = async () => {
      if (!isMounted) return;

      try {
        setJoining(true);
        setError(null);

        if (process.env.NODE_ENV === 'development') {
          console.log('🎥 [EventVideoStage] Joining call...', {
            roomUrl,
            role: isHost ? 'host' : isGuest ? 'guest' : 'viewer',
            address: currentUserAddress.slice(0, 10),
          });
        } else {
          console.log('🎥 [EventVideoStage] Joining call...', {
            roomUrl,
            role: isHost ? 'host' : isGuest ? 'guest' : 'viewer',
          });
        }

        let timeoutId: NodeJS.Timeout | undefined;
        const joinPromise = daily.join({
          url: roomUrl,
          token: token,
          userName: isHost ? 'Host' : isGuest ? 'Guest' : 'Viewer',
          userData: {
            role: isHost ? 'host' : isGuest ? 'guest' : 'viewer',
            address: currentUserAddress,
          },
        });

        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`Join timeout after ${JOIN_TIMEOUT_MS / 1000} seconds`)), JOIN_TIMEOUT_MS);
        });

        try {
          await Promise.race([joinPromise, timeoutPromise]);
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }

        if (!isMounted) {
          console.log('⚠️ [EventVideoStage] Component unmounted during join, leaving...');
          await daily.leave();
          return;
        }

        hasJoinedRef.current = true;
        joinedRoomRef.current = roomUrl;

        console.log('✅ [EventVideoStage] Joined call successfully');
      } catch (err: any) {
        console.error('❌ [EventVideoStage] Join error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to join call');
          hasJoinedRef.current = false;
          joinedRoomRef.current = null;
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
      hasJoinedRef.current = false;
      joinedRoomRef.current = null;
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
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <p className="font-georgia-pro text-red-400 mb-4">❌ {error}</p>
          <button
            onClick={() => {
              setError(null);
              hasJoinedRef.current = false;
              joinedRoomRef.current = null;
            }}
            className="px-4 py-2 bg-white text-black rounded-full font-georgia-pro hover:bg-gray-200 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (joining) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="font-georgia-pro text-gray-300">Joining video call...</p>
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
  const hasGuests = guestSessionIds.length > 0;

  console.log('🎬 [EventVideoStage] Identified participants:', {
    total: participantIds.length,
    hostSessionId,
    guestCount: guestSessionIds.length,
    localSessionId,
    isHost,
  });

  return (
    <div className="relative h-full bg-gray-900">
      {/* Video tiles fill the entire stage area */}
      <div className="h-full p-2">
        {/*
          Layout logic:
          - 1 participant (solo): flex → single tile fills 100%
          - 2 participants: 1 col mobile, 2 col desktop → 50/50 split
          - 3+: wrapping 2-col grid
        */}
        <div className={`h-full gap-2 ${
          !hasGuests
            ? 'flex'
            : 'grid grid-cols-1 md:grid-cols-2'
        }`}>
          {/* Host tile */}
          {hostSessionId ? (
            <div className={hasGuests ? 'min-h-[120px]' : 'h-full'}>
              <DailyVideoTile
                sessionId={hostSessionId}
                label={hostSessionId === localSessionId ? "You (Host)" : "Host"}
                isLocal={hostSessionId === localSessionId}
              />
            </div>
          ) : (
            <div className={`${hasGuests ? 'min-h-[120px]' : 'h-full'} bg-gray-800 rounded-lg flex items-center justify-center`}>
              <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
            </div>
          )}

          {/* Guest / viewer tiles — only render when guests actually exist */}
          {hasGuests && guestSessionIds.map((guestId, index) => {
            const participant = daily?.participants()[guestId];
            const participantRole = participant?.userData?.role || 'viewer';

            const guestsBeforeThis = guestSessionIds
              .slice(0, index)
              .filter(id => daily?.participants()[id]?.userData?.role === 'guest')
              .length;
            const guestNumber = guestsBeforeThis + 1;

            return (
              <div key={guestId} className="min-h-[120px]">
                <DailyVideoTile
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
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ OVERLAY: Controls bar pinned to bottom of video section */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-georgia-pro text-sm font-semibold text-red-400">LIVE</span>
            </div>
            <span className="font-georgia-pro text-sm text-gray-300">
              {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isHost && (
              <button
                onClick={handleEndEvent}
                className="px-5 py-1.5 bg-red-600 text-white rounded-full text-sm font-georgia-pro hover:bg-red-700 transition"
              >
                End Event
              </button>
            )}
            {isGuest && (
              <button
                onClick={handleLeaveCall}
                className="px-5 py-1.5 bg-gray-600 text-white rounded-full text-sm font-georgia-pro hover:bg-gray-700 transition"
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
