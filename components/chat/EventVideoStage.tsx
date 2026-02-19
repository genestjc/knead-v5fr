'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  useDaily,
  useParticipantIds,
  useLocalSessionId,
  useParticipantProperty,
  DailyVideo,
  DailyAudio,
} from '@daily-co/daily-react';

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

// ✅ Helper component that uses Daily's reactive hook to read participant data
// This re-renders automatically when the participant's data changes
function ParticipantTile({
  sessionId,
  localSessionId,
  hostAddress,
  invitedGuestAddresses,
  guestIndex,
}: {
  sessionId: string;
  localSessionId: string;
  hostAddress: string;
  invitedGuestAddresses: string[];
  guestIndex: number;
}) {
  const [userName, userData] = useParticipantProperty(sessionId, [
    'user_name',
    'userData',
  ]);

  const participantAddress = (
    (userData as any)?.address ||
    userName ||
    ''
  ).toLowerCase();

  const isLocal = sessionId === localSessionId;

  // Determine if this is the host
  const isHostTile = participantAddress && hostAddress && (
    participantAddress === hostAddress ||
    (hostAddress.length > 10 && participantAddress.includes(hostAddress.slice(2, 10))) ||
    (participantAddress.length > 10 && hostAddress.includes(participantAddress.slice(2, 10)))
  );

  // Determine if this is an invited guest
  const isGuestTile = !isHostTile && participantAddress && invitedGuestAddresses.some((guestAddr) => {
    if (participantAddress === guestAddr) return true;
    if (guestAddr.length > 10 && participantAddress.includes(guestAddr.slice(2, 10))) return true;
    if (participantAddress.length > 10 && guestAddr.includes(participantAddress.slice(2, 10))) return true;
    return false;
  });

  // Build label
  let label = 'Viewer';
  if (isHostTile) {
    label = isLocal ? 'You (Host)' : 'Host';
  } else if (isGuestTile) {
    label = isLocal ? 'You (Guest)' : `Guest ${guestIndex + 1}`;
  }

  return (
    <DailyVideoTile
      sessionId={sessionId}
      label={label}
      isLocal={isLocal}
    />
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

  const hostAddress = event.host?.address?.toLowerCase() || '';
  const invitedGuestAddresses = useMemo(
    () => (event.guestAddresses || []).map((addr: string) => addr.toLowerCase()),
    [event.guestAddresses]
  );

  // ✅ Use Daily's built-in filtering: only get IDs whose user_name (wallet) matches
  // host or invited guests. This is reactive and updates automatically.
  const allParticipantIds = useParticipantIds();

  const hostFilter = useCallback(
    (p: any) => {
      const addr = (p.userData?.address || p.user_name || '').toLowerCase();
      if (!addr || !hostAddress) return false;
      if (addr === hostAddress) return true;
      if (hostAddress.length > 10 && addr.includes(hostAddress.slice(2, 10))) return true;
      if (addr.length > 10 && hostAddress.includes(addr.slice(2, 10))) return true;
      return false;
    },
    [hostAddress]
  );

  const guestFilter = useCallback(
    (p: any) => {
      const addr = (p.userData?.address || p.user_name || '').toLowerCase();
      if (!addr) return false;
      // Exclude the host
      if (hostAddress && (
        addr === hostAddress ||
        (hostAddress.length > 10 && addr.includes(hostAddress.slice(2, 10))) ||
        (addr.length > 10 && hostAddress.includes(addr.slice(2, 10)))
      )) return false;
      // Check invited list
      return invitedGuestAddresses.some((guestAddr: string) => {
        if (addr === guestAddr) return true;
        if (guestAddr.length > 10 && addr.includes(guestAddr.slice(2, 10))) return true;
        if (addr.length > 10 && guestAddr.includes(addr.slice(2, 10))) return true;
        return false;
      });
    },
    [hostAddress, invitedGuestAddresses]
  );

  // ✅ Also match local user by role (handles case where userData isn't populated yet)
  const hostSessionIds = useParticipantIds({ filter: hostFilter });
  const guestSessionIds = useParticipantIds({ filter: guestFilter });

  // Fallback: if local user is host but address matching hasn't caught them yet
  const effectiveHostId = hostSessionIds[0] || (isHost && localSessionId ? localSessionId : undefined);
  const effectiveGuestIds = guestSessionIds.length > 0
    ? guestSessionIds
    : (isGuest && localSessionId && !effectiveHostId ? [localSessionId] : []);

  const hasGuests = effectiveGuestIds.length > 0;

  useEffect(() => {
    console.log('🎬 [EventVideoStage] Tile state:', {
      totalInRoom: allParticipantIds.length,
      hostId: effectiveHostId,
      guestIds: effectiveGuestIds,
      hostAddress,
      invitedGuestAddresses,
      localSessionId,
      isHost,
      isGuest,
    });
  }, [allParticipantIds, effectiveHostId, effectiveGuestIds, hostAddress, invitedGuestAddresses, localSessionId, isHost, isGuest]);

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
      const localParticipant = participants?.local;

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
          userName: currentUserAddress,
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

  return (
    <div className="relative h-full bg-gray-900">
      {/* ✅ DailyAudio: renders hidden <audio> elements for all remote participants */}
      {/* Without this, you see video but hear NOTHING */}
      <DailyAudio />

      {/* Video tiles — only host + invited guests */}
      <div className="h-full p-2">
        <div className={`h-full gap-2 ${
          !hasGuests
            ? 'flex'
            : hasGuests && effectiveGuestIds.length === 1
              ? 'grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'
              : 'grid grid-cols-1 md:grid-cols-2 auto-rows-fr'
        }`}>
          {/* Host tile */}
          {effectiveHostId ? (
            <div className="min-h-0 h-full overflow-hidden">
              <ParticipantTile
                sessionId={effectiveHostId}
                localSessionId={localSessionId}
                hostAddress={hostAddress}
                invitedGuestAddresses={invitedGuestAddresses}
                guestIndex={0}
              />
            </div>
          ) : (
            <div className="min-h-0 h-full bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
              <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
            </div>
          )}

          {/* Invited guest tiles — only wallets from event.guestAddresses */}
          {hasGuests && effectiveGuestIds.map((guestId, index) => (
            <div key={guestId} className="min-h-0 h-full overflow-hidden">
              <ParticipantTile
                sessionId={guestId}
                localSessionId={localSessionId}
                hostAddress={hostAddress}
                invitedGuestAddresses={invitedGuestAddresses}
                guestIndex={index}
              />
            </div>
          ))}
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
              {allParticipantIds.length} watching
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
