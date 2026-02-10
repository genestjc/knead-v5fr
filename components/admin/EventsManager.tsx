'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { getContract, prepareContractCall, sendTransaction } from 'thirdweb';
import { base } from 'thirdweb/chains';
import { useActiveAccount } from 'thirdweb/react';
import { client as thirdwebClient } from '@/thirdweb-client';

interface EventsManagerProps {
  adminAddress: string;
}

export function EventsManager({ adminAddress }: EventsManagerProps) {
  const account = useActiveAccount();
  
  const [events, setEvents] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
    eventType: 'live-interview',
    videoEnabled: false,
  });

  useEffect(() => {
    if (adminAddress) {
      fetchEvents();
    }
  }, [adminAddress]);

  // ✅ FIXED: Use /api/admin/events with adminAddress query param
  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      
      console.log('Fetching events with adminAddress:', adminAddress);
      
      const response = await fetch(`/api/admin/events?adminAddress=${encodeURIComponent(adminAddress)}`);
      const data = await response.json();
      
      console.log('Events response:', data);
      
      if (data.success) {
        setEvents(data.data || []);
      } else {
        console.error('Failed to fetch events:', data.error);
        alert(`Failed to load events: ${data.error}`);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      alert('Failed to load events. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Use /api/events POST (your existing route)
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!account) {
      alert('Please connect your wallet');
      return;
    }

    try {
      setIsUpdating(true);
      
      const channelId = process.env.NEXT_PUBLIC_KNEAD_CHAT_DEFAULT_CHANNEL_ID;
      
      if (!channelId) {
        throw new Error('Channel ID not configured');
      }

      // Find or create host user
      const hostResponse = await fetch('/api/chat/users/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: adminAddress }),
      });
      
      const hostData = await hostResponse.json();
      
      if (!hostData.success || !hostData.data) {
        throw new Error('Failed to get host user');
      }

      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        channelId,
        eventType: newEvent.eventType,
        scheduledStart: new Date(newEvent.scheduledStart).toISOString(),
        scheduledEnd: new Date(newEvent.scheduledEnd).toISOString(),
        videoEnabled: newEvent.videoEnabled,
        hostId: hostData.data.id,
        guestIds: [],
      };

      console.log('Creating event:', eventData);

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Event created successfully!');
        setNewEvent({
          title: '',
          description: '',
          scheduledStart: '',
          scheduledEnd: '',
          eventType: 'live-interview',
          videoEnabled: false,
        });
        setShowCreateForm(false);
        await fetchEvents();
      } else {
        throw new Error(data.error || 'Failed to create event');
      }
    } catch (err: any) {
      console.error('Error creating event:', err);
      alert(`Failed to create event: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // ✅ Use /api/events/[eventId] PATCH (your existing route)
  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    if (isUpdating) {
      alert('Please wait for the current update to complete.');
      return;
    }

    if (!account) {
      alert('No wallet connected. Please connect your wallet.');
      return;
    }

    try {
      setIsUpdating(true);
      
      console.log('Updating event status:', { eventId, newStatus });
      
      // 1. Update event status in database
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminAddress, status: newStatus }),
      });

      const data = await response.json();
      
      console.log('Update response:', data);
      
      if (!data.success) throw new Error(data.error);

      console.log('✅ Event status updated in database');

      // 2. Update Event Pass NFTs on-chain (only for live/ended)
      if (newStatus === 'live' || newStatus === 'ended') {
        console.log('🎫 Updating Event Pass NFTs...');
        
        const participantAddressesInput = prompt(
          `Enter Participant wallet addresses (comma-separated):\n\nExample:\n0x123...,0x456...,0x789...`
        );
        
        if (!participantAddressesInput) {
          alert('No addresses entered. Event status updated but no passes minted/burned.');
          await fetchEvents();
          setIsUpdating(false);
          return;
        }
        
        const participantAddresses = participantAddressesInput
          .split(',')
          .map(addr => addr.trim())
          .filter(addr => addr.startsWith('0x'));
        
        if (participantAddresses.length === 0) {
          alert('No valid addresses found.');
          await fetchEvents();
          setIsUpdating(false);
          return;
        }

        console.log(`📋 ${participantAddresses.length} addresses provided`);

        const eventPassContract = getContract({
          client: thirdwebClient,
          chain: base,
          address: process.env.NEXT_PUBLIC_EVENT_PASS_CONTRACT!,
        });

        if (newStatus === 'live') {
          const transaction = prepareContractCall({
            contract: eventPassContract,
            method: "function batchMintPasses(address[] memory recipients, string memory eventId)",
            params: [participantAddresses, eventId],
          });

          alert(`⏳ Minting ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
          
          const txResult = await sendTransaction({
            transaction,
            account,
          });
          
          console.log(`✅ Passes minted! Tx: ${txResult.transactionHash}`);
          alert(`✅ Event Started!\n\n${participantAddresses.length} Event Passes minted!\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
          
        } else if (newStatus === 'ended') {
          const transaction = prepareContractCall({
            contract: eventPassContract,
            method: "function batchBurnPasses(address[] memory holders)",
            params: [participantAddresses],
          });

          alert(`⏳ Burning ${participantAddresses.length} Event Passes...\n\nPlease confirm the transaction in your wallet.`);
          
          const txResult = await sendTransaction({
            transaction,
            account,
          });
          
          console.log(`✅ Passes burned! Tx: ${txResult.transactionHash}`);
          alert(`✅ Event Ended!\n\n${participantAddresses.length} Event Passes burned!\n\nTx: ${txResult.transactionHash.slice(0, 10)}...`);
        }
      } else {
        alert(`Event status updated to: ${newStatus}`);
      }

      await fetchEvents();
    } catch (err: any) {
      console.error('Error updating event:', err);
      alert(`Failed to update event: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // ✅ Use /api/events/[eventId] DELETE (your existing route)
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      setIsUpdating(true);
      
      const response = await fetch(`/api/events/${eventId}?adminAddress=${encodeURIComponent(adminAddress)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        alert('✅ Event deleted successfully');
        await fetchEvents();
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      console.error('Error deleting event:', err);
      alert(`Failed to delete event: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-adonis text-2xl">Events Manager</h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Event'}
          </button>
        </div>

        {/* Create Event Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateEvent} className="mb-6 p-6 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="font-adonis text-xl mb-4">New Event</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-georgia-pro text-sm font-medium mb-2">Event Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:ring-2 focus:ring-black focus:border-transparent"
                  placeholder="e.g., Live Interview with Jane Doe"
                  required
                />
              </div>

              <div>
                <label className="block font-georgia-pro text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:ring-2 focus:ring-black focus:border-transparent"
                  rows={3}
                  placeholder="What's this event about?"
                />
              </div>

              <div>
                <label className="block font-georgia-pro text-sm font-medium mb-2">Event Type</label>
                <select
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="live-interview">Live Interview</option>
                  <option value="ama">AMA</option>
                  <option value="workshop">Workshop</option>
                  <option value="discussion">Discussion</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-georgia-pro text-sm font-medium mb-2">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.scheduledStart}
                    onChange={(e) => setNewEvent({ ...newEvent, scheduledStart: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:ring-2 focus:ring-black focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block font-georgia-pro text-sm font-medium mb-2">End Time *</label>
                  <input
                    type="datetime-local"
                    value={newEvent.scheduledEnd}
                    onChange={(e) => setNewEvent({ ...newEvent, scheduledEnd: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg font-georgia-pro focus:ring-2 focus:ring-black focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="video_enabled"
                  checked={newEvent.videoEnabled}
                  onChange={(e) => setNewEvent({ ...newEvent, videoEnabled: e.target.checked })}
                  className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black"
                />
                <label htmlFor="video_enabled" className="ml-2 font-georgia-pro text-sm">
                  Enable video chat (creates Daily.co room)
                </label>
              </div>

              <button
                type="submit"
                disabled={isUpdating}
                className="w-full px-4 py-3 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isUpdating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        )}

        {/* Events List */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
            <p className="font-georgia-pro text-gray-600">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="font-georgia-pro text-gray-600 mb-4">No events found.</p>
            <p className="font-georgia-pro text-sm text-gray-500">Create your first event to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-adonis text-xl mb-1">{event.title}</h3>
                    {event.host && (
                      <p className="font-georgia-pro text-sm text-gray-600 mb-2">
                        🎙️ Host: {event.host.displayName || event.host.alias || `${event.host.address.slice(0, 6)}...${event.host.address.slice(-4)}`}
                      </p>
                    )}
                    <p className="font-georgia-pro text-sm text-gray-500">
                      📅 {format(new Date(event.scheduledStart), 'PPP p')}
                    </p>
                    {event.videoEnabled && event.dailyRoomUrl && (
                      <p className="font-georgia-pro text-xs text-blue-600 mt-1">
                        🎥 Video: {event.dailyRoomUrl}
                      </p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-georgia-pro font-medium ${
                    event.status === 'live' ? 'bg-green-100 text-green-800' :
                    event.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status}
                  </span>
                </div>

                {event.description && (
                  <p className="font-georgia-pro text-sm text-gray-600 mb-4 pl-4 border-l-2 border-gray-200">
                    {event.description}
                  </p>
                )}
                
                <div className="flex gap-2 mt-4">
                  {event.status === 'scheduled' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'live')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-georgia-pro hover:bg-green-700 disabled:opacity-50 transition"
                    >
                      🎙️ Start Event
                    </button>
                  )}
                  {event.status === 'live' && (
                    <button
                      onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-red-600 text-white rounded-full text-sm font-georgia-pro hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      ⏹️ End Event
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-full text-sm font-georgia-pro hover:bg-gray-300 disabled:opacity-50 transition"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
