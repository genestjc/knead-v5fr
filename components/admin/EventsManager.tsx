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

interface User {
  id: string;
  address: string;
  displayName: string;
  alias: string | null;
  role: string;
}

export function EventsManager({ adminAddress }: EventsManagerProps) {
  // ✅ Get connected wallet account for signing transactions
  const account = useActiveAccount();
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [isProcessingNFTs, setIsProcessingNFTs] = useState(false);

  // Guest management
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [guestSearchResults, setGuestSearchResults] = useState<User[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<User[]>([]);
  const [searchingGuests, setSearchingGuests] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    channelId: 'live-interviews',
    eventType: 'interview' as 'interview' | 'discussion' | 'ama' | 'announcement',
    scheduledStart: '',
    scheduledEnd: '',
    videoEnabled: true,
    audioOnly: false,
  });

  useEffect(() => {
    fetchAdminUser();
    fetchEvents();

    // ✅ REAL-TIME SUBSCRIPTION
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
        console.log('✅ [EventsManager] Event titles:', data.data.map((e: any) => e.title));
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

  const searchUsers = async (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setGuestSearchResults([]);
      return;
    }

    setSearchingGuests(true);
    try {
      const response = await fetch(`/api/admin/users?adminAddress=${adminAddress}`);
      const data = await response.json();

      if (data.success) {
        const filtered = data.data.filter((user: User) => {
          const term = searchTerm.toLowerCase();
          return (
            user.address.toLowerCase().includes(term) ||
            user.displayName?.toLowerCase().includes(term) ||
            user.alias?.toLowerCase().includes(term)
          );
        });
        setGuestSearchResults(filtered.slice(0, 5));
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingGuests(false);
    }
  };

  // ✅ UPDATED: Add guest with debug logging
  const addGuest = (user: User) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('➕ ADDING GUEST:');
    console.log('   User:', user);
    console.log('   User ID:', user.id);
    console.log('   User Address:', user.address);
    console.log('   User Name:', user.alias || user.displayName);
    console.log('');
    console.log('   Current selectedGuests:', selectedGuests);
    console.log('   Current count:', selectedGuests.length);
    
    if (!selectedGuests.find(g => g.id === user.id)) {
      const newGuests = [...selectedGuests, user];
      setSelectedGuests(newGuests);
      console.log('   ✅ Guest added!');
      console.log('   New selectedGuests:', newGuests);
      console.log('   New count:', newGuests.length);
    } else {
      console.log('   ⚠️ Guest already in list, skipping');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    setGuestSearchTerm('');
    setGuestSearchResults([]);
  };

  const removeGuest = (userId: string) => {
    setSelectedGuests(selectedGuests.filter(g => g.id !== userId));
  };

  // ✅ UPDATED: Create event with comprehensive debug logging
  const handleCreateEvent = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!adminUserId) {
    setError('Admin user ID not loaded');
    return;
  }

  // ✅ CRITICAL: Capture selectedGuests at submission time
  const guestsAtSubmission = [...selectedGuests];

  // ✅ COMPREHENSIVE DEBUG LOGGING
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CREATING EVENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📝 FORM DATA:');
  console.log('   Title:', formData.title);
  console.log('   Description:', formData.description);
  console.log('   Event Type:', formData.eventType);
  console.log('   Video Enabled:', formData.videoEnabled);
  console.log('   Channel ID:', formData.channelId);
  console.log('   Scheduled Start:', formData.scheduledStart);
  console.log('   Scheduled End:', formData.scheduledEnd);
  console.log('');
  console.log('👤 HOST INFO:');
  console.log('   Admin User ID:', adminUserId);
  console.log('');
  console.log('👥 SELECTED GUESTS (from state):');
  console.log('   selectedGuests state:', selectedGuests);
  console.log('   selectedGuests count:', selectedGuests.length);
  console.log('');
  console.log('👥 GUESTS AT SUBMISSION (captured):');
  console.log('   guestsAtSubmission:', guestsAtSubmission);
  console.log('   guestsAtSubmission count:', guestsAtSubmission.length);
  
  if (guestsAtSubmission.length > 0) {
    console.log('   Guest details:');
    guestsAtSubmission.forEach((guest, i) => {
      console.log(`     Guest ${i + 1}:`, {
        id: guest.id,
        address: guest.address,
        name: guest.alias || guest.displayName
      });
    });
  } else {
    console.log('   ⚠️ NO GUESTS AT SUBMISSION!');
    console.log('   ⚠️ Check if selectedGuests state was cleared before form submit');
  }
  
  const guestIds = guestsAtSubmission.map(g => g.id);
  console.log('');
  console.log('📤 PAYLOAD TO API:');
  console.log('   Guest IDs:', guestIds);
  console.log('   Guest IDs length:', guestIds.length);
  console.log('   Guest IDs type:', Array.isArray(guestIds) ? 'Array' : typeof guestIds);
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
      guestIds: guestIds,
    };
    
    console.log('');
    console.log('📨 SENDING REQUEST:');
    console.log('   URL: /api/events');
    console.log('   Method: POST');
    console.log('   Body:', JSON.stringify(requestBody, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SERVER RESPONSE:');
    console.log('   Status:', response.status);
    console.log('   Success:', data.success);
    console.log('   Response data:', data);
    
    if (data.success && data.data) {
      console.log('');
      console.log('📊 CREATED EVENT:');
      console.log('   Event ID:', data.data.id);
      console.log('   Title:', data.data.title);
      console.log('   Host ID:', data.data.host_id);
      console.log('   Guest IDs (saved):', data.data.guest_ids);
      console.log('   Guest IDs length:', data.data.guest_ids?.length || 0);
      console.log('   Video Enabled:', data.data.video_enabled);
      console.log('   Daily Room:', data.data.daily_room_url);
      console.log('');
      console.log('🔍 VERIFICATION:');
      console.log(`   Run in Supabase SQL:`);
      console.log(`   SELECT id, title, host_id, guest_ids FROM chat_events WHERE id = '${data.data.id}';`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (data.success) {
      setShowCreateModal(false);
      resetForm();
      alert('Event created successfully! Check console for details.');
      
      // Force refetch to show new event
      fetchEvents();
    } else {
      console.error('❌ Error:', data.error);
      setError(data.error || 'Failed to create event');
    }
  } catch (err: any) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ EXCEPTION:', err);
    console.error('   Message:', err.message);
    console.error('   Stack:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
    });
    setSelectedGuests([]);
    setGuestSearchTerm('');
    setGuestSearchResults([]);
  };

  // ✅ UPDATED: Handle Event Pass NFTs when starting/ending events
  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      // Step 1: Update database
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
        
        // Step 2: Mint or burn Event Passes on-chain
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

  // ✅ NEW: Handle Event Pass NFT minting/burning for students/participants
  const handleEventPassNFTs = async (eventId: string, status: string) => {
    if (isProcessingNFTs) {
      alert('Already processing NFTs. Please wait...');
      return;
    }

    try {
      setIsProcessingNFTs(true);
      
      console.log('🎫 Managing Event Pass NFTs for status:', status);
      
      // Check if admin wallet is connected
      if (!account) {
        alert('❌ Please connect your admin wallet first!\n\nYou need to sign the transaction to mint/burn Event Passes.');
        return;
      }
      
      // Prompt for student/participant addresses
      const instruction = status === 'live' 
        ? '🎓 Enter STUDENT wallet addresses (who will participate in TEXT CHAT):\n\nThese should be users with Knead Monthly Pass.\nThey will receive Event Pass NFTs to send messages during the event.'
        : '🔥 Enter the SAME student addresses to BURN their Event Passes:\n\nThis will revoke their ability to send messages.';
      
      const participantAddressesInput = prompt(
        `${instruction}\n\nFormat (comma-separated):\n0x123...,0x456...,0x789...`
      );
      
      if (!participantAddressesInput) {
        alert('❌ No addresses entered.\n\nEvent status was updated, but no NFTs were minted/burned.\n\nYou can manually mint/burn later if needed.');
        setIsProcessingNFTs(false);
        return;
      }
      
      const participantAddresses = participantAddressesInput
        .split(',')
        .map(addr => addr.trim())
        .filter(addr => addr.startsWith('0x'));
      
      if (participantAddresses.length === 0) {
        alert('❌ No valid Ethereum addresses found.\n\nPlease use format: 0x123...,0x456...');
        setIsProcessingNFTs(false);
        return;
      }

      console.log(`📋 Processing ${participantAddresses.length} student addresses...`);

      // Get Event Pass contract
      const eventPassContract = getContract({
        client: thirdwebClient,
        chain: base,
        address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
      });

      if (status === 'live') {
        // ✅ Mint Event Passes to students
        console.log(`🎫 Minting Event Passes to ${participantAddresses.length} students...`);
        
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchMintPasses(address[] memory recipients, string memory eventId)",
          params: [participantAddresses, eventId],
        });

        const confirmation = confirm(
          `⏳ Ready to mint ${participantAddresses.length} Event Passes?\n\n` +
          `Students will be able to:\n` +
          `✅ Send messages in chat\n` +
          `✅ React to messages\n` +
          `✅ Participate in discussion\n\n` +
          `You (host) and guests will join via video.\n\n` +
          `Click OK to sign the transaction.`
        );
        
        if (!confirmation) {
          setIsProcessingNFTs(false);
          return;
        }
        
        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        console.log(`✅ Event Passes minted! Tx: ${txResult.transactionHash}`);
        alert(
          `✅ Event Started!\n\n` +
          `🎫 ${participantAddresses.length} Event Passes minted!\n\n` +
          `Students can now send messages in chat.\n\n` +
          `📹 You and your guests can join the video room.\n\n` +
          `Tx: ${txResult.transactionHash.slice(0, 10)}...`
        );
        
      } else if (status === 'ended') {
        // ✅ Burn Event Passes from students
        console.log(`🔥 Burning Event Passes from ${participantAddresses.length} students...`);
        
        const transaction = prepareContractCall({
          contract: eventPassContract,
          method: "function batchBurnPasses(address[] memory holders)",
          params: [participantAddresses],
        });

        const confirmation = confirm(
          `⏳ Ready to burn ${participantAddresses.length} Event Passes?\n\n` +
          `Students will lose:\n` +
          `❌ Ability to send messages\n` +
          `✅ They can still view chat history\n\n` +
          `Click OK to sign the transaction.`
        );
        
        if (!confirmation) {
          setIsProcessingNFTs(false);
          return;
        }
        
        const txResult = await sendTransaction({
          transaction,
          account,
        });
        
        console.log(`✅ Event Passes burned! Tx: ${txResult.transactionHash}`);
        alert(
          `✅ Event Ended!\n\n` +
          `🔥 ${participantAddresses.length} Event Passes burned!\n\n` +
          `Students can no longer send messages.\n` +
          `They can still view the chat history.\n\n` +
          `Tx: ${txResult.transactionHash.slice(0, 10)}...`
        );
      }
      
    } catch (err: any) {
      console.error('❌ Error managing Event Pass NFTs:', err);
      alert(`❌ Failed to manage Event Passes:\n\n${err.message || 'Unknown error'}\n\nPlease check console for details.`);
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
      {/* Header */}
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

      {/* Events list */}
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

              {event.guests && event.guests.length > 0 && (
                <div className="mb-4">
                  <span className="font-georgia-pro text-sm text-gray-500">Video Guests (join Daily.co room):</span>
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
                    className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessingNFTs ? '⏳ Processing...' : '🔴 Start Event & Mint Passes'}
                  </button>
                )}
                {event.status === 'live' && (
                  <button
                    onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                    disabled={isProcessingNFTs}
                    className="px-4 py-2 bg-gray-600 text-white rounded font-georgia-pro text-sm hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Create Event Modal */}
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
                  <span className="text-xs text-gray-500 ml-2">- These people will join you in the Daily.co video room</span>
                </label>
                
                {selectedGuests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedGuests.map(guest => (
                      <div key={guest.id} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <span className="font-georgia-pro">📹 {guest.alias || guest.displayName || guest.address.slice(0, 8)}</span>
                        <button
                          type="button"
                          onClick={() => removeGuest(guest.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="relative">
                  <input
                    type="text"
                    value={guestSearchTerm}
                    onChange={(e) => {
                      setGuestSearchTerm(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                    placeholder="Search by name or address... (e.g., Bill Norris)"
                  />
                  
                  {guestSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      {guestSearchResults.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addGuest(user)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 font-georgia-pro text-sm"
                        >
                          <div className="font-medium">{user.alias || user.displayName || 'Anonymous'}</div>
                          <div className="text-xs text-gray-500">{user.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                      💡 Daily.co room will be created for you and your video guests. Students will participate via text chat with Event Pass NFTs.
                    </p>
                  </div>
                )}
                
                {formData.audioOnly && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="font-georgia-pro text-xs text-blue-800">
                      🎙️ Audio-only mode: participants can only use microphone, no cameras.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  disabled={!adminUserId}
                  className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
