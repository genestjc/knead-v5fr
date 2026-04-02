'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import MuxPlayer from '@mux/mux-player-react';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { getAddress } from 'viem';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import { client as thirdwebClient } from '@/thirdweb-client';

interface EventsManagerProps {
  adminAddress: string;
}

function GuestAddressCopyField({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        readOnly
        value={address}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded font-mono text-xs"
      />
      <button
        onClick={handleCopy}
        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition flex-shrink-0"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

function CopyAllButton({ addresses }: { addresses: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(addresses.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopyAll}
      className="text-xs text-blue-600 hover:underline mb-2"
    >
      {copied ? '✓ All Copied' : '📋 Copy All Addresses'}
    </button>
  );
}

function VideoUploadPanel({
  onComplete,
  onClose,
}: {
  onComplete: (playbackId: string, assetId: string) => void;
  onClose?: () => void;
}) {
  const [state, setState] = useState<'idle' | 'uploading' | 'processing' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playbackId, setPlaybackId] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('uploading');
    setError(null);
    setPlaybackId(null);

    try {
      const uploadRes = await fetch('/api/admin/mux/upload', { method: 'POST' });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error);

      const { uploadId, uploadUrl } = uploadData.data;

      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'video/*' },
      });
      if (!putRes.ok) throw new Error('Upload to Mux failed');

      setState('processing');

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(`/api/admin/mux/asset?uploadId=${uploadId}`);
        const pollData = await pollRes.json();
        if (!pollData.success) throw new Error(pollData.error);
        if (pollData.data.ready) {
          setPlaybackId(pollData.data.playbackId);
          setState('ready');
          onComplete(pollData.data.playbackId, pollData.data.assetId);
          return;
        }
      }
      throw new Error('Processing timed out. Upload succeeded — try refreshing.');
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setState('error');
    }
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-georgia-pro text-sm font-semibold text-blue-900">🎬 Upload Video (Mux)</h4>
        {onClose && (
          <button onClick={onClose} className="text-blue-700 hover:text-blue-900 font-georgia-pro text-xs">
            ✕ Close
          </button>
        )}
      </div>

      {state === 'idle' && (
        <div>
          <input
            type="file"
            accept="video/*"
            onChange={handleFile}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-xs file:font-georgia-pro file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
          />
          <p className="mt-1.5 font-georgia-pro text-xs text-blue-700">
            MP4, MOV, WebM — uploaded directly to Mux CDN. No file size limit.
          </p>
        </div>
      )}

      {(state === 'uploading' || state === 'processing') && (
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 flex-shrink-0" />
          <p className="font-georgia-pro text-sm text-blue-800">
            {state === 'uploading' ? 'Uploading to Mux...' : 'Processing video — this may take a minute...'}
          </p>
        </div>
      )}

      {state === 'ready' && playbackId && (
        <div>
          <p className="font-georgia-pro text-sm text-green-800 font-medium mb-1">✅ Video ready!</p>
          <p className="font-mono text-xs text-gray-500 mb-3">Playback ID: {playbackId}</p>
          <div className="aspect-video rounded overflow-hidden bg-black">
            <MuxPlayer
              playbackId={playbackId}
              streamType="on-demand"
              style={{ width: '100%', height: '100%' }}
            />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-3 px-4 py-1.5 bg-blue-600 text-white rounded font-georgia-pro text-xs hover:bg-blue-700 transition"
            >
              Done
            </button>
          )}
        </div>
      )}

      {state === 'error' && (
        <div>
          <p className="font-georgia-pro text-xs text-red-700 bg-red-50 px-2 py-1 rounded mb-2">❌ {error}</p>
          <button
            onClick={() => { setState('idle'); setError(null); }}
            className="px-3 py-1 text-xs font-georgia-pro bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function EventPassPanel({
  eventId,
  mode,
  account,
  onClose,
}: {
  eventId: string;
  mode: 'mint' | 'burn';
  account: ReturnType<typeof useActiveAccount>;
  onClose: () => void;
}) {
  const [addressInput, setAddressInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const parsedAddresses = useMemo(
    () =>
      addressInput
        .split(/[\n,\s]+/)
        .map((a) => a.trim().toLowerCase())
        .filter((a) => a.startsWith('0x') && a.length === 42),
    [addressInput]
  );

  const handleSubmit = async () => {
    if (!account) {
      setTxError('Connect your admin wallet first.');
      return;
    }
    if (parsedAddresses.length === 0) {
      setTxError('Enter at least one valid 0x address.');
      return;
    }

    setIsProcessing(true);
    setTxError(null);

    try {
      // Checksum addresses — Solidity address params require EIP-55 format
      const checksummedAddresses = parsedAddresses.map((a) => getAddress(a));

      const eventPassContract = getContract({
        client: thirdwebClient,
        chain: base,
        address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
      });

      let txResult;
      if (mode === 'mint') {
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: 'function batchMintPasses(address[] memory recipients, string memory eventId)',
          params: [checksummedAddresses, eventId],
        });
        txResult = await sendTransaction({ transaction, account });
      } else {
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: 'function batchBurnPasses(address[] memory holders)',
          params: [checksummedAddresses],
        });
        txResult = await sendTransaction({ transaction, account });
      }

      setTxHash(txResult.transactionHash);
    } catch (err: any) {
      setTxError(err.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-georgia-pro text-sm font-semibold text-amber-900">
          {mode === 'mint' ? '🎫 Mint Event Passes' : '🔥 Burn Event Passes'}
        </h4>
        <button
          onClick={onClose}
          className="text-amber-700 hover:text-amber-900 font-georgia-pro text-xs"
        >
          ✕ Close
        </button>
      </div>

      <label className="block font-georgia-pro text-xs text-amber-800 mb-1">
        {mode === 'mint'
          ? 'Paste participant wallet addresses (comma or newline separated):'
          : 'Paste the addresses to burn passes from:'}
      </label>

      <textarea
        value={addressInput}
        onChange={(e) => setAddressInput(e.target.value)}
        className="w-full px-3 py-2 border border-amber-300 rounded font-mono text-xs bg-white focus:outline-none focus:border-amber-500"
        placeholder={'0xAbc123...\n0xDef456...\nor comma-separated: 0xAbc123..., 0xDef456...'}
        rows={5}
      />

      {parsedAddresses.length > 0 && (
        <div className="mt-2 p-2 bg-white border border-amber-200 rounded">
          <p className="font-georgia-pro text-xs font-medium text-gray-700 mb-1">
            {parsedAddresses.length} valid address{parsedAddresses.length !== 1 ? 'es' : ''} detected:
          </p>
          <div className="max-h-28 overflow-y-auto space-y-0.5">
            {parsedAddresses.map((addr, i) => (
              <p key={i} className="font-mono text-xs text-gray-500">{addr}</p>
            ))}
          </div>
        </div>
      )}

      {txError && (
        <p className="mt-2 font-georgia-pro text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
          ❌ {txError}
        </p>
      )}

      {txHash && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
          <p className="font-georgia-pro text-xs text-green-800 font-medium">
            ✅ {mode === 'mint' ? `${parsedAddresses.length} passes minted!` : `${parsedAddresses.length} passes burned!`}
          </p>
          <p className="font-mono text-xs text-green-700 mt-0.5 break-all">Tx: {txHash}</p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={handleSubmit}
          disabled={isProcessing || parsedAddresses.length === 0}
          className={`px-4 py-1.5 text-white rounded font-georgia-pro text-xs transition disabled:opacity-50 ${
            mode === 'mint' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-800'
          }`}
        >
          {isProcessing
            ? '⏳ Signing...'
            : mode === 'mint'
            ? `Mint ${parsedAddresses.length} Pass${parsedAddresses.length !== 1 ? 'es' : ''}`
            : `Burn ${parsedAddresses.length} Pass${parsedAddresses.length !== 1 ? 'es' : ''}`}
        </button>
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded font-georgia-pro text-xs hover:bg-gray-300 transition disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function EventsManager({ adminAddress }: EventsManagerProps) {
  const account = useActiveAccount();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [nftPanel, setNftPanel] = useState<{ eventId: string; mode: 'mint' | 'burn' } | null>(null);
  const [videoPanel, setVideoPanel] = useState<string | null>(null);

  const [guestAddressesInput, setGuestAddressesInput] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    channelId: 'live-interviews',
    eventType: 'interview' as 'interview' | 'discussion' | 'ama' | 'announcement' | 'recorded',
    scheduledStart: '',
    scheduledEnd: '',
    videoEnabled: true,
    audioOnly: false,
    guestOnlyEvent: false,
    musicMode: false,
    muxPlaybackId: '',
    muxAssetId: '',
  });

  useEffect(() => {
    fetchAdminUser();
    fetchEvents();

    const supabase = createSupabaseClient();    
    console.log('🔄 [EventsManager] Setting up real-time subscription...');
    
    const channel = supabase
      .channel('admin_events_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_events',
        },
        (payload) => {
          console.log('🔄 [EventsManager] Real-time event change:', payload.eventType, payload);
          
          if (payload.eventType === 'INSERT') {
            console.log('➕ New event inserted, refetching...');
            fetchEvents();
          } else if (payload.eventType === 'UPDATE') {
            console.log('🔄 Event updated, refetching...');
            fetchEvents();
          } else if (payload.eventType === 'DELETE') {
            console.log('🗑️ Event deleted:', payload.old.id);
            setEvents((prev) => prev.filter((event) => event.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [EventsManager] Subscription status:', status);
      });

    return () => {
      console.log('🧹 [EventsManager] Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [adminAddress]);

  const fetchAdminUser = async () => {
    try {
      const response = await fetch(`/api/users/by-address?address=${adminAddress}`);
      const data = await response.json();
      
      if (data.success && data.user) {
        setAdminUserId(data.user.id);
      } else {
        setError('Admin user not found in database');
      }
    } catch (err) {
      console.error('Error fetching admin user:', err);
      setError('Failed to load admin user');
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const timestamp = Date.now();
      const response = await fetch(
        `/api/admin/events?adminAddress=${adminAddress}&_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        }
      );
      
      const data = await response.json();

      if (data.success) {
        console.log('✅ [EventsManager] Fetched events:', data.data.length);
        setEvents(data.data);
      } else {
        setError(data.error || 'Failed to fetch events');
      }
    } catch (err) {
      setError('Error fetching events');
      console.error('[EventsManager] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUserId) {
      setError('Admin user ID not loaded');
      return;
    }

    const rawAddresses = guestAddressesInput
      .split(/[\n,]+/)
      .map(addr => addr.trim().toLowerCase())
      .filter(addr => addr.startsWith('0x') && addr.length === 42);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 CREATING EVENT');
    console.log('   Title:', formData.title);
    console.log('   Guest-only:', formData.guestOnlyEvent);
    console.log('   Music mode:', formData.musicMode);
    console.log('   Parsed guest addresses:', rawAddresses);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const requestBody = {
        title: formData.title,
        description: formData.description,
        channelId: formData.channelId,
        eventType: formData.eventType,
        scheduledStart: new Date(formData.scheduledStart).toISOString(),
        scheduledEnd: new Date(formData.scheduledEnd).toISOString(),
        videoEnabled: formData.videoEnabled,
        hostId: adminUserId,
        guestAddresses: rawAddresses,
        guestOnlyEvent: formData.guestOnlyEvent,
        musicMode: formData.musicMode,
        muxPlaybackId: formData.muxPlaybackId || null,
        muxAssetId: formData.muxAssetId || null,
      };
      
      console.log('📨 Sending to API:', requestBody);

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      console.log('✅ Response:', data);

      if (data.success) {
        setShowCreateModal(false);
        resetForm();
        alert('✅ Event created successfully! Guests have been added.');
        fetchEvents();
      } else {
        setError(data.error || 'Failed to create event');
      }
    } catch (err: any) {
      console.error('❌ Error:', err);
      setError('Error creating event');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      channelId: 'live-interviews',
      eventType: 'interview',
      scheduledStart: '',
      scheduledEnd: '',
      videoEnabled: true,
      audioOnly: false,
      guestOnlyEvent: false,
      musicMode: false,
      muxPlaybackId: '',
      muxAssetId: '',
    });
    setGuestAddressesInput('');
  };

  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Event status updated to: ${newStatus}`);
      } else {
        setError(data.error || 'Failed to update event');
      }
    } catch (err) {
      setError('Error updating event');
      console.error(err);
    }
  };

  const handleUpdateMuxVideo = async (eventId: string, muxPlaybackId: string, muxAssetId: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, muxPlaybackId, muxAssetId }),
      });
      const data = await response.json();
      if (!data.success) setError(data.error || 'Failed to save video');
    } catch (err) {
      setError('Error saving video');
      console.error(err);
    }
  };

  const handleToggleEventPassOnly = async (eventId: string, value: boolean) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, eventPassOnly: value }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to update event');
      }
    } catch (err) {
      setError('Error updating event');
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const response = await fetch(`/api/admin/events/${eventId}?adminAddress=${adminAddress}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Event deleted');
      } else {
        setError(data.error || 'Failed to delete event');
      }
    } catch (err) {
      setError('Error deleting event');
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      live: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-adonis text-2xl">Events & Live Interviews</h2>
          <p className="font-georgia-pro text-sm text-gray-600">
            Manage live events and video streaming • <span className="text-green-600">● Real-time updates enabled</span>
          </p>
          {!account && (
            <p className="font-georgia-pro text-xs text-orange-600 mt-1">
              ⚠️ Connect your wallet to mint/burn Event Pass NFTs
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
        >
          + Create Event
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-georgia-pro text-sm text-red-800">{error}</p>
          <button 
            onClick={() => setError(null)} 
            className="text-red-600 text-xs mt-2 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="font-georgia-pro text-gray-500">No events yet. Create one to get started!</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-adonis text-xl">{event.title}</h3>
                    {getStatusBadge(event.status)}
                    {event.videoEnabled && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-semibold">
                        📹 VIDEO
                      </span>
                    )}
                    {event.guestOnlyEvent && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        🎙️ GUEST-ONLY
                      </span>
                    )}
                    {/* ✅ MUSIC MODE BADGE */}
                    {event.musicMode && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        🎵 MUSIC MODE
                      </span>
                    )}
                    {event.eventPassOnly && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                        🔒 PASS-ONLY CHAT
                      </span>
                    )}
                    {event.eventType === 'recorded' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        🎬 RECORDED
                      </span>
                    )}
                  </div>
                  <p className="font-georgia-pro text-sm text-gray-600">{event.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <span className="font-georgia-pro text-gray-500">Host:</span>
                  <span className="font-georgia-pro ml-2">{event.host?.alias || event.host?.displayName || event.host?.address || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-georgia-pro text-gray-500">Type:</span>
                  <span className="font-georgia-pro ml-2 capitalize">{event.eventType}</span>
                </div>
                <div>
                  <span className="font-georgia-pro text-gray-500">Start:</span>
                  <span className="font-georgia-pro ml-2">
                    {format(new Date(event.scheduledStart), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                <div>
                  <span className="font-georgia-pro text-gray-500">End:</span>
                  <span className="font-georgia-pro ml-2">
                    {format(new Date(event.scheduledEnd), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>

              {event.guestAddresses && event.guestAddresses.length > 0 && (
                <div className="mb-4">
                  <CopyAllButton addresses={event.guestAddresses} />
                  <span className="font-georgia-pro text-sm text-gray-500 mb-2 block">
                    Video Guest Addresses:
                  </span>
                  <div className="space-y-2">
                    {event.guestAddresses.map((address: string, index: number) => (
                      <GuestAddressCopyField key={index} address={address} />
                    ))}
                  </div>
                </div>
              )}

              {event.guests && event.guests.length > 0 && (
                <div className="mb-4">
                  <span className="font-georgia-pro text-sm text-gray-500">Video Guests:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {event.guests.map((guest: any) => (
                      <span key={guest.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-georgia-pro">
                        📹 {guest.alias || guest.displayName || guest.address.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Mux pre-recorded video */}
              {event.eventType === 'recorded' && (
                <div className="mb-4">
                  {event.muxPlaybackId ? (
                    <div>
                      <p className="font-georgia-pro text-xs text-gray-500 mb-2">🎬 Pre-recorded video:</p>
                      <div className="aspect-video rounded overflow-hidden bg-black">
                        <MuxPlayer
                          playbackId={event.muxPlaybackId}
                          streamType="on-demand"
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="font-georgia-pro text-xs text-orange-600">⚠️ No video uploaded yet — use the Upload Video button below.</p>
                  )}
                </div>
              )}

              {event.dailyRoomUrl && (
                <div className="mb-4 p-3 bg-purple-50 rounded">
                  <p className="font-georgia-pro text-xs text-gray-600 mb-1">📹 Video Room (Host + Guests only):</p>
                  <a
                    href={event.dailyRoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-georgia-pro text-sm text-purple-700 hover:underline break-all"
                  >
                    {event.dailyRoomUrl}
                  </a>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {event.status === 'scheduled' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'live')}
                      className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition"
                    >
                      🔴 Start Event
                    </button>
                  )}
                  {event.status === 'live' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                      className="px-4 py-2 bg-gray-600 text-white rounded font-georgia-pro text-sm hover:bg-gray-700 transition"
                    >
                      ⏹️ End Event
                    </button>
                  )}

                  {/* Mint passes — available for scheduled or live events */}
                  {(event.status === 'scheduled' || event.status === 'live') && (
                    <button
                      onClick={() =>
                        setNftPanel(
                          nftPanel?.eventId === event.id && nftPanel.mode === 'mint'
                            ? null
                            : { eventId: event.id, mode: 'mint' }
                        )
                      }
                      className={`px-4 py-2 rounded font-georgia-pro text-sm transition ${
                        nftPanel?.eventId === event.id && nftPanel.mode === 'mint'
                          ? 'bg-amber-700 text-white'
                          : 'bg-amber-500 text-white hover:bg-amber-600'
                      }`}
                    >
                      🎫 Mint Passes
                    </button>
                  )}

                  {/* Burn passes — available for live or ended events */}
                  {(event.status === 'live' || event.status === 'ended') && (
                    <button
                      onClick={() =>
                        setNftPanel(
                          nftPanel?.eventId === event.id && nftPanel.mode === 'burn'
                            ? null
                            : { eventId: event.id, mode: 'burn' }
                        )
                      }
                      className={`px-4 py-2 rounded font-georgia-pro text-sm transition ${
                        nftPanel?.eventId === event.id && nftPanel.mode === 'burn'
                          ? 'bg-orange-800 text-white'
                          : 'bg-orange-600 text-white hover:bg-orange-700'
                      }`}
                    >
                      🔥 Burn Passes
                    </button>
                  )}

                  {/* Upload/replace video for recorded events */}
                  {event.eventType === 'recorded' && (
                    <button
                      onClick={() => setVideoPanel(videoPanel === event.id ? null : event.id)}
                      className={`px-4 py-2 rounded font-georgia-pro text-sm transition ${
                        videoPanel === event.id
                          ? 'bg-blue-700 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      🎬 {event.muxPlaybackId ? 'Replace Video' : 'Upload Video'}
                    </button>
                  )}

                  {/* Event Pass Only chat toggle */}
                  <button
                    onClick={() => handleToggleEventPassOnly(event.id, !event.eventPassOnly)}
                    className={`px-4 py-2 rounded font-georgia-pro text-sm transition ${
                      event.eventPassOnly
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                    }`}
                    title={
                      event.eventPassOnly
                        ? 'Only Event Pass holders can chat. Click to open to all members.'
                        : 'Chat open to Contributors + Members + Pass holders. Click to restrict to Pass holders only.'
                    }
                  >
                    {event.eventPassOnly ? '🔒 Pass-Only Chat' : '🌐 Open Chat'}
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition"
                  >
                    Delete
                  </button>
                </div>

                {/* Inline Event Pass Panel */}
                {nftPanel?.eventId === event.id && (
                  <EventPassPanel
                    eventId={event.id}
                    mode={nftPanel.mode}
                    account={account}
                    onClose={() => setNftPanel(null)}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="font-adonis text-2xl mb-6">Create New Event</h3>
            
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block font-georgia-pro text-sm mb-2">Event Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  placeholder="e.g., Interview with Bill Norris"
                  required
                />
              </div>

              <div>
                <label className="block font-georgia-pro text-sm mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  placeholder="Optional details about the event..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-georgia-pro text-sm mb-2">Event Type</label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  >
                    <option value="interview">🎙️ Live Interview</option>
                    <option value="discussion">💬 Discussion</option>
                    <option value="ama">❓ AMA</option>
                    <option value="announcement">📢 Announcement</option>
                    <option value="recorded">🎬 Pre-recorded Video</option>
                  </select>
                </div>

                <div>
                  <label className="block font-georgia-pro text-sm mb-2">Channel</label>
                  <select
                    value={formData.channelId}
                    onChange={(e) => setFormData({ ...formData, channelId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  >
                    <option value="live-interviews">Live Interviews</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-georgia-pro text-sm mb-2">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledStart}
                    onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                    required
                  />
                </div>

                <div>
                  <label className="block font-georgia-pro text-sm mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledEnd}
                    onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-georgia-pro text-sm mb-2">
                  Video Guests (Optional)
                  <span className="text-xs text-gray-500 ml-2">- Paste wallet addresses</span>
                </label>
                
                <textarea
                  value={guestAddressesInput}
                  onChange={(e) => setGuestAddressesInput(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro font-mono text-sm"
                  placeholder="0x506B26c791D0d9A6aa159C3F0dfa686Dc16Af382, 0x123...&#10;or one per line:&#10;0x506B26c791D0d9A6aa159C3F0dfa686Dc16Af382&#10;0x123..."
                  rows={4}
                />
                
                <p className="text-xs text-gray-500 mt-2">
                  💡 Paste Ethereum addresses (comma or newline separated). We'll look them up or create entries automatically.
                </p>
              </div>

              {/* Video upload for recorded events */}
              {formData.eventType === 'recorded' && (
                <div>
                  <label className="block font-georgia-pro text-sm font-medium mb-2">Pre-recorded Video</label>
                  {formData.muxPlaybackId ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="font-georgia-pro text-xs text-green-800 font-medium mb-1">✅ Video ready</p>
                      <p className="font-mono text-xs text-green-700">Playback ID: {formData.muxPlaybackId}</p>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, muxPlaybackId: '', muxAssetId: '' })}
                        className="mt-2 text-xs text-red-600 hover:underline font-georgia-pro"
                      >
                        Remove & re-upload
                      </button>
                    </div>
                  ) : (
                    <VideoUploadPanel
                      onComplete={(playbackId, assetId) =>
                        setFormData({ ...formData, muxPlaybackId: playbackId, muxAssetId: assetId })
                      }
                    />
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <label className="block font-georgia-pro text-sm font-medium mb-3">Media Settings</label>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.videoEnabled}
                      onChange={(e) => setFormData({ ...formData, videoEnabled: e.target.checked, audioOnly: false })}
                      className="rounded"
                    />
                    <span className="font-georgia-pro text-sm">📹 Enable video streaming (Daily.co)</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.audioOnly}
                      onChange={(e) => setFormData({ ...formData, audioOnly: e.target.checked, videoEnabled: !e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-georgia-pro text-sm">🎙️ Audio only (no video)</span>
                  </label>
                </div>
                
                {formData.videoEnabled && (
                  <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                    <p className="font-georgia-pro text-xs text-purple-800">
                      💡 Daily.co room will be created for you and your video guests. Students participate via text chat.
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <label className="block font-georgia-pro text-sm font-medium mb-3">Event Settings</label>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.guestOnlyEvent}
                      onChange={(e) => setFormData({ ...formData, guestOnlyEvent: e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-georgia-pro text-sm">🎙️ Guest-only event (no host required)</span>
                  </label>
                  
                  {/* ✅ MUSIC MODE CHECKBOX */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.musicMode}
                      onChange={(e) => setFormData({ ...formData, musicMode: e.target.checked })}
                      className="rounded"
                    />
                    <span className="font-georgia-pro text-sm">🎵 Music Mode (high-quality audio for musicians)</span>
                  </label>
                </div>
                
                {formData.guestOnlyEvent && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="font-georgia-pro text-xs text-blue-800">
                      💡 Guests can start streaming immediately without waiting for you to join.
                    </p>
                  </div>
                )}
                
                {/* ✅ MUSIC MODE INFO */}
                {formData.musicMode && (
                  <div className="mt-3 p-3 bg-green-50 rounded-lg">
                    <p className="font-georgia-pro text-xs text-green-800">
                      💡 Optimizes audio for music with higher bitrate and less compression. Perfect for live performances!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={!adminUserId}
                  className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50"
                >
                  Create Event
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-6 py-2 bg-gray-200 text-black rounded-full font-georgia-pro hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
