'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabase/chat-client';

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
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

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

    // Real-time subscription
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

  const addGuest = (user: User) => {
    if (!selectedGuests.find(g => g.id === user.id)) {
      setSelectedGuests([...selectedGuests, user]);
    }
    setGuestSearchTerm('');
    setGuestSearchResults([]);
  };

  const removeGuest = (userId: string) => {
    setSelectedGuests(selectedGuests.filter(g => g.id !== userId));
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!adminUserId) {
      setError('Admin user ID not loaded');
      return;
    }

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          channelId: formData.channelId,
          eventType: formData.eventType,
          scheduledStart: new Date(formData.scheduledStart).toISOString(),
          scheduledEnd: new Date(formData.scheduledEnd).toISOString(),
          videoEnabled: formData.videoEnabled,
          hostId: adminUserId,
          guestIds: selectedGuests.map(g => g.id),
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Event created successfully!');
        setShowCreateModal(false);
        resetForm();
        alert('Event created successfully!');
      } else {
        setError(data.error || 'Failed to create event');
      }
    } catch (err) {
      setError('Error creating event');
      console.error(err);
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

  // ✅ UPDATED: Calls bot to update blockchain permissions
  const handleUpdateEventStatus = async (eventId: string, newStatus: string) => {
    if (isUpdating) {
      alert('Please wait for the current update to complete.');
      return;
    }

    try {
      setIsUpdating(true);
      
      // 1. Update event status in database
      const response = await fetch(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update event');
      }

      console.log('✅ Event status updated in database');

      // 2. Call bot to update role permissions on-chain
      if (newStatus === 'live' || newStatus === 'ended') {
        const permissions = newStatus === 'live' 
          ? ['Read', 'Write', 'React'] 
          : ['Read'];
        
        console.log('🤖 Calling bot to update blockchain permissions:', permissions);
        
        const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'https://your-bot.onrender.com';
        const botResponse = await fetch(`${botUrl}/update-role`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spaceAddress: process.env.NEXT_PUBLIC_KNEAD_CHAT_SPACE_ADDRESS,
            roleId: parseInt(process.env.NEXT_PUBLIC_TOWNS_PARTICIPANT_ROLE_ID || '0'),
            permissions,
            apiKey: process.env.NEXT_PUBLIC_BOT_API_KEY,
          }),
        });

        const botData = await botResponse.json();
        
        if (botData.success) {
          console.log('✅ Bot updated permissions on-chain!');
          console.log(`   Tx Hash: ${botData.txHash}`);
          console.log(`   Block: ${botData.blockNumber}`);
          alert(`Event ${newStatus}! ✅\n\nPermissions updated on-chain:\nTx: ${botData.txHash.slice(0, 10)}...`);
        } else {
          console.error('❌ Bot failed:', botData.error);
          alert(`Event status updated in database, but blockchain update failed:\n${botData.error}\n\nParticipants can still message (UI permissions work), but blockchain enforcement failed.`);
        }
      } else {
        alert(`Event ${newStatus}!`);
      }

      // Refresh events list
      await fetchEvents();
    } catch (err: any) {
      console.error('Error updating event:', err);
      alert(`Failed to update event: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
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
                  <span className="font-georgia-pro text-sm text-gray-500">Guests:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {event.guests.map((guest: any) => (
                      <span key={guest.id} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-georgia-pro">
                        {guest.alias || guest.displayName || guest.address.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {event.dailyRoomUrl && (
                <div className="mb-4 p-3 bg-purple-50 rounded">
                  <p className="font-georgia-pro text-xs text-gray-600 mb-1">Daily.co Room:</p>
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
                    disabled={isUpdating}
                    className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {isUpdating ? '⏳ Starting...' : '🔴 Start Event'}
                  </button>
                )}
                {event.status === 'live' && (
                  <button
                    onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-gray-600 text-white rounded font-georgia-pro text-sm hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    {isUpdating ? '⏳ Ending...' : 'End Event'}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteEvent(event.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Event Modal - keeping your existing modal code */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          {/* ... (keep all your existing modal JSX) ... */}
        </div>
      )}
    </div>
  );
}
