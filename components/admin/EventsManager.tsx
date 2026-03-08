'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
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

export function EventsManager({ adminAddress }: EventsManagerProps) {
  const account = useActiveAccount();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [isProcessingNFTs, setIsProcessingNFTs] = useState(false);

  const [guestAddressesInput, setGuestAddressesInput] = useState('');

  // ✅ ADDED: guestOnlyEvent field
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    channelId: 'live-interviews',
    eventType: 'interview' as 'interview' | 'discussion' | 'ama' | 'announcement',
    scheduledStart: '',
    scheduledEnd: '',
    videoEnabled: true,
    audioOnly: false,
    guestOnlyEvent: false,
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
        guestOnlyEvent: formData.guestOnlyEvent, // ✅ ADDED
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
      guestOnlyEvent: false, // ✅ ADDED
    });
    setGuestAddressesInput('');
  };

  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ Event status updated to: ${newStatus}`);
        
        if (newStatus === 'live' || newStatus === 'ended') {
          await handleEventPassNFTs(eventId, newStatus);
        }
      } else {
        setError(data.error || 'Failed to update event');
      }
    } catch (err) {
      setError('Error updating event');
      console.error(err);
    }
  };

  const handleEventPassNFTs = async (eventId: string, status: string) => {
    if (isProcessingNFTs) {
      alert('Already processing NFTs. Please wait...');
      return;
    }

    try {
      setIsProcessingNFTs(true);
      
      console.log('🎫 Managing Event Pass NFTs for status:', status);
      
      if (!account) {
        alert('❌ Please connect your admin wallet first!');
        return;
      }
      
      const instruction = status === 'live' 
        ? '🎓 Enter STUDENT wallet addresses (text chat participants):\n\nComma-separated:\n0x123...,0x456...'
        : '🔥 Enter the SAME student addresses to BURN their passes:';
      
      const participantAddressesInput = prompt(instruction);
      
      if (!participantAddressesInput) {
        alert('❌ No addresses entered.');
        setIsProcessingNFTs(false);
        return;
      }
      
      const participantAddresses = participantAddressesInput
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.startsWith('0x'));
      
      if (participantAddresses.length === 0) {
        alert('❌ No valid addresses found.');
        setIsProcessingNFTs(false);
        return;
      }

      const eventPassContract = getContract({
        client: thirdwebClient,
        chain: base,
        address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
      });

      if (status === 'live') {
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchMintPasses(address[] memory recipients, string memory eventId)",
          params: [participantAddresses, eventId],
        });

        const confirmation = confirm(
          `Ready to mint ${participantAddresses.length} Event Passes?\n\n` +
          `Students will be able to send messages in chat.\n` +
          `Click OK to sign.`
        );
        
        if (!confirmation) {
          setIsProcessingNFTs(false);
          return;
        }
        
        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        alert(
          `✅ Event Started!\n\n` +
          `🎫 ${participantAddresses.length} Event Passes minted!\n\n` +
          `Tx: ${txResult.transactionHash.slice(0, 10)}...`
        );
        
      } else if (status === 'ended') {
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchBurnPasses(address[] memory holders)",
          params: [participantAddresses],
        });

        const confirmation = confirm(
          `Ready to burn ${participantAddresses.length} Event Passes?`
        );
        
        if (!confirmation) {
          setIsProcessingNFTs(false);
          return;
        }
        
        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        alert(
          `✅ Event Ended!\n\n` +
          `🔥 ${participantAddresses.length} Event Passes burned!\n\n` +
          `Tx: ${txResult.transactionHash.slice(0, 10)}...`
        );
      }
      
    } catch (err: any) {
      console.error('❌ Error managing Event Pass NFTs:', err);
      alert(`❌ Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingNFTs(false);
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

              <div className="flex items-center gap-2">
                {event.status === 'scheduled' && (
                  <button
                    onClick={() => handleUpdateEventStatus(event.id, 'live')}
                    disabled={isProcessingNFTs}
                    className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isProcessingNFTs ? '⏳ Processing...' : '🔴 Start Event & Mint Passes'}
                  </button>
                )}
                {event.status === 'live' && (
                  <button
                    onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                    disabled={isProcessingNFTs}
                    className="px-4 py-2 bg-gray-600 text-white rounded font-georgia-pro text-sm hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    {isProcessingNFTs ? '⏳ Processing...' : '⏹️ End Event & Burn Passes'}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  disabled={isProcessingNFTs}
                  className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition disabled:opacity-50"
                >
                  Delete
                </button>
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

              {/* ✅ GUEST-ONLY EVENT CHECKBOX */}
              <div className="border-t pt-4">
                <label className="block font-georgia-pro text-sm font-medium mb-3">Event Settings</label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.guestOnlyEvent}
                    onChange={(e) => setFormData({ ...formData, guestOnlyEvent: e.target.checked })}
                    className="rounded"
                  />
                  <span className="font-georgia-pro text-sm">🎙️ Guest-only event (no host required)</span>
                </label>
                
                {formData.guestOnlyEvent && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="font-georgia-pro text-xs text-blue-800">
                      💡 Guests can start streaming immediately without waiting for you to join.
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
