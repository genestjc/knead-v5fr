'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

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

  // ✅ NEW: Guest management
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
    audioOnly: false, // ✅ NEW: Audio-only option
  });

  useEffect(() => {
    fetchAdminUser();
    fetchEvents();
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
      const response = await fetch(`/api/admin/events?adminAddress=${adminAddress}`);
      const data = await response.json();

      if (data.success) {
        setEvents(data.data);
      } else {
        setError(data.error || 'Failed to fetch events');
      }
    } catch (err) {
      setError('Error fetching events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NEW: Search for users to add as guests
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
        // Filter users by search term
        const filtered = data.data.filter((user: User) => {
          const term = searchTerm.toLowerCase();
          return (
            user.address.toLowerCase().includes(term) ||
            user.displayName?.toLowerCase().includes(term) ||
            user.alias?.toLowerCase().includes(term)
          );
        });
        setGuestSearchResults(filtered.slice(0, 5)); // Limit to 5 results
      }
    } catch (err) {
      console.error('Error searching users:', err);
    } finally {
      setSearchingGuests(false);
    }
  };

  // ✅ NEW: Add guest
  const addGuest = (user: User) => {
    if (!selectedGuests.find(g => g.id === user.id)) {
      setSelectedGuests([...selectedGuests, user]);
    }
    setGuestSearchTerm('');
    setGuestSearchResults([]);
  };

  // ✅ NEW: Remove guest
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
          guestIds: selectedGuests.map(g => g.id), // ✅ Include guest IDs
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowCreateModal(false);
        resetForm();
        fetchEvents();
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
        fetchEvents();
      } else {
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
        fetchEvents();
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
          <p className="font-georgia-pro text-sm text-gray-600">Manage live events and video streaming</p>
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

              {/* ✅ Show guests */}
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
                    className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition"
                  >
                    Start Event
                  </button>
                )}
                {event.status === 'live' && (
                  <button
                    onClick={() => handleUpdateEventStatus(event.id, 'ended')}
                    className="px-4 py-2 bg-gray-600 text-white rounded font-georgia-pro text-sm hover:bg-gray-700 transition"
                  >
                    End Event
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
                  placeholder="e.g., Interview with Jane Doe"
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

              {/* ✅ NEW: Guest Management */}
              <div>
                <label className="block font-georgia-pro text-sm mb-2">Guests (Optional)</label>
                
                {/* Selected guests */}
                {selectedGuests.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedGuests.map(guest => (
                      <div key={guest.id} className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        <span className="font-georgia-pro">{guest.alias || guest.displayName || guest.address.slice(0, 8)}</span>
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
                
                {/* Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={guestSearchTerm}
                    onChange={(e) => {
                      setGuestSearchTerm(e.target.value);
                      searchUsers(e.target.value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                    placeholder="Search by name or address..."
                  />
                  
                  {/* Search results dropdown */}
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

              {/* ✅ NEW: Media Settings */}
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
                      💡 Daily.co room will be created automatically for video/audio streaming.
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
