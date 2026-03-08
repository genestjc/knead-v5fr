'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  useDaily,
  useParticipantIds,
  useLocalSessionId,
  useParticipantProperty,
  DailyAudio,
} from '@daily-co/daily-react';
import { DailyVideoTile } from './DailyVideoTile';

function ParticipantTile({
  sessionId,
  localSessionId,
  hostAddress,
  invitedGuestAddresses,
  guestIndex,
  isViewer,
}: {
  sessionId: string;
  localSessionId: string;
  hostAddress: string;
  invitedGuestAddresses: string[];
  guestIndex: number;
  isViewer: boolean;
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

  const isHostTile = participantAddress && hostAddress && (
    participantAddress === hostAddress ||
    (hostAddress.length > 10 && participantAddress.includes(hostAddress.slice(2, 10))) ||
    (participantAddress.length > 10 && hostAddress.includes(participantAddress.slice(2, 10)))
  );

  const isGuestTile = !isHostTile && participantAddress && invitedGuestAddresses.some((guestAddr) => {
    if (participantAddress === guestAddr) return true;
    if (guestAddr.length > 10 && participantAddress.includes(guestAddr.slice(2, 10))) return true;
    if (participantAddress.length > 10 && guestAddr.includes(participantAddress.slice(2, 10))) return true;
    return false;
  });

  let label = 'Viewer';
  if (isHostTile) {
    label = isLocal ? 'You (Host)' : 'Host';
  } else if (isGuestTile) {
    const displayName = userName 
      ? (userName.startsWith('0x') ? `${userName.slice(0, 6)}...${userName.slice(-4)}` : userName)
      : `Guest ${guestIndex + 1}`;
    label = isLocal ? `You (${displayName})` : displayName;
  }

  return (
    <DailyVideoTile
      sessionId={sessionId}
      label={label}
      isLocal={isLocal}
      isViewer={isViewer}
    />
  );
}

interface EventVideoStageProps {
  event: any;
  currentUserAddress: string;
  roomUrl: string;
  token: string;
}

const JOIN_TIMEOUT_MS = 15000;

export function EventVideoStage({ event, currentUserAddress, roomUrl, token }: EventVideoStageProps) {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement>(null);

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
      
      if (hostAddress && (
        addr === hostAddress ||
        (hostAddress.length > 10 && addr.includes(hostAddress.slice(2, 10))) ||
        (addr.length > 10 && hostAddress.includes(addr.slice(2, 10)))
      )) return false;
      
      return invitedGuestAddresses.some((guestAddr: string) => {
        if (addr === guestAddr) return true;
        if (guestAddr.length > 10 && addr.includes(guestAddr.slice(2, 10))) return true;
        if (addr.length > 10 && guestAddr.includes(addr.slice(2, 10))) return true;
        return false;
      });
    },
    [hostAddress, invitedGuestAddresses]
  );

  const hostSessionIds = useParticipantIds({ filter: hostFilter });
  const guestSessionIds = useParticipantIds({ filter: guestFilter });

  const effectiveHostId = hostSessionIds[0] || (isHost && localSessionId ? localSessionId : undefined);
  const effectiveGuestIds = guestSessionIds.length > 0
    ? guestSessionIds
    : (isGuest && localSessionId ? [localSessionId] : []);

  const hasGuests = effectiveGuestIds.length > 0;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!daily || !roomUrl || !token) return;
    if (hasJoinedRef.current && joinedRoomRef.current === roomUrl) return;

    const meetingState = daily.meetingState();
    if (meetingState === 'joined-meeting') {
      const participants = daily.participants();
      const localParticipant = participants?.local;
      if (localParticipant?.session_id) return;
    }

    let isMounted = true;

    const joinCall = async () => {
      if (!isMounted) return;

      try {
        setJoining(true);
        setError(null);

        const role = isHost ? 'host' : isGuest ? 'guest' : 'viewer';

        if (!isViewer) {
          try {
            await daily.startCamera({
              url: roomUrl,
              token: token,
              userName: currentUserAddress,
            });
          } catch (camError: any) {
            console.warn('⚠️ Camera/mic request failed:', camError.message);
          }
        }

        let timeoutId: NodeJS.Timeout | undefined;
        const joinPromise = daily.join({
          url: roomUrl,
          token: token,
          userName: currentUserAddress,
          startVideoOff: isViewer,
          startAudioOff: isViewer,
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
          await daily.leave();
          return;
        }

        hasJoinedRef.current = true;
        joinedRoomRef.current = roomUrl;

        try {
          await daily.setUserData({
            address: currentUserAddress.toLowerCase(),
            role,
          });
        } catch (userDataError: any) {
          console.warn('⚠️ Failed to set user data:', userDataError.message);
        }

        if (!isViewer) {
          try {
            await daily.setLocalAudio(true);
            await daily.setLocalVideo(true);
          } catch (mediaError: any) {
            console.warn('⚠️ Could not enable media:', mediaError.message);
          }
        }
      } catch (err: any) {
        console.error('❌ Join error:', err);
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
        daily.leave().catch(console.error);
      }
    };
  }, [daily]);

  const handleLeaveCall = async () => {
    if (daily) {
      hasJoinedRef.current = false;
      joinedRoomRef.current = null;
      await daily.leave();
    }
  };

  const handleFullscreen = () => {
    if (!videoContainerRef.current) return;

    const element = videoContainerRef.current;

    try {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if ((element as any).webkitRequestFullscreen) {
        (element as any).webkitRequestFullscreen();
      } else if ((element as any).mozRequestFullScreen) {
        (element as any).mozRequestFullScreen();
      } else if ((element as any).msRequestFullscreen) {
        (element as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('❌ Fullscreen error:', error);
    }
  };

  const handleExitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).mozCancelFullScreen) {
      (document as any).mozCancelFullScreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
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

  const totalTiles = event.guestOnlyEvent 
    ? effectiveGuestIds.length 
    : 1 + effectiveGuestIds.length;

  let gridClass = 'flex';
  if (totalTiles === 2) {
    gridClass = 'grid grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1';
  } else if (totalTiles > 2) {
    gridClass = 'grid grid-cols-1 md:grid-cols-2 auto-rows-fr';
  }

  return (
    <div ref={videoContainerRef} className="relative h-full bg-gray-900">
      <DailyAudio />

      {isFullscreen && (
        <button
          onClick={handleExitFullscreen}
          className="absolute top-4 right-4 z-30 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition"
          title="Exit fullscreen"
        >
          <svg className="w-6 h-6 text-white opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="h-full p-2">
        <div className={`h-full gap-2 ${gridClass} ${totalTiles === 1 ? 'items-center justify-center' : ''}`}>
          {!event.guestOnlyEvent && (
            effectiveHostId ? (
              <div className="min-h-0 h-full overflow-hidden">
                <ParticipantTile
                  sessionId={effectiveHostId}
                  localSessionId={localSessionId || ''}
                  hostAddress={hostAddress}
                  invitedGuestAddresses={invitedGuestAddresses}
                  guestIndex={0}
                  isViewer={isViewer}
                />
              </div>
            ) : (
              <div className="min-h-0 h-full bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                <p className="font-georgia-pro text-gray-400">Waiting for host...</p>
              </div>
            )
          )}

          {hasGuests && effectiveGuestIds.map((guestId, index) => (
            <div key={guestId} className="min-h-0 h-full overflow-hidden">
              <ParticipantTile
                sessionId={guestId}
                localSessionId={localSessionId || ''}
                hostAddress={hostAddress}
                invitedGuestAddresses={invitedGuestAddresses}
                guestIndex={index}
                isViewer={isViewer}
              />
            </div>
          ))}

          {event.guestOnlyEvent && !hasGuests && (
            <div className="min-h-0 h-full bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
              <p className="font-georgia-pro text-gray-400">Waiting for guests to join...</p>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 z-20">
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
            <button
              onClick={isFullscreen ? handleExitFullscreen : handleFullscreen}
              className="px-4 py-1.5 bg-white/20 text-white rounded-full text-sm font-georgia-pro hover:bg-white/30 transition"
              title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? '✕ Exit Fullscreen' : '⛶ Fullscreen'}
            </button>
            
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
