'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { createSupabaseClient } from '@/lib/supabase/chat-client';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  content: string;
  contributors_only: boolean;
  posted_by: string;
  posted_at: string;
  created_at: string;
  updated_at: string;
}

interface AnnouncementsManagerProps {
  adminAddress: string;
}

export function AnnouncementsManager({ adminAddress }: AnnouncementsManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    contributorsOnly: false,
  });

  useEffect(() => {
    fetchAnnouncements();

    // Real-time subscription
    const supabase = createSupabaseClient();
    const channel = supabase
      .channel('admin_announcements_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_announcements',
        },
        (payload) => {
          console.log('🔄 Announcement change payload:', payload);
          
          // Direct state updates instead of refetching
          if (payload.eventType === 'DELETE') {
            setAnnouncements((prev) => prev.filter((a) => a.id !== payload.old.id));
            console.log('🗑️ Removed announcement from state:', payload.old.id);
          } else if (payload.eventType === 'INSERT') {
            setAnnouncements((prev) => [payload.new as Announcement, ...prev]);
            console.log('➕ Added announcement to state:', payload.new.id);
          } else if (payload.eventType === 'UPDATE') {
            setAnnouncements((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Announcement) : p))
            );
            console.log('🔄 Updated announcement in state:', payload.new.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Announcements subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const timestamp = Date.now();
      const response = await fetch(`/api/announcements?isContributor=true&_t=${timestamp}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.success) {
        console.log('📢 Admin fetched announcements:', data.data.length);
        setAnnouncements(data.data || []);
        return data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching announcements:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAddress,
          title: formData.title,
          content: formData.content,
          contributorsOnly: formData.contributorsOnly,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Announcement posted!');
        setShowCreateModal(false);
        setFormData({ title: '', content: '', contributorsOnly: false });
        
        // Optimistic update
        setAnnouncements((prev) => [data.data, ...prev]);
        
        // Reconcile with server
        await fetchAnnouncements();
      } else {
        toast.error(data.error || 'Failed to post announcement');
      }
    } catch (error: any) {
      toast.error('Error posting announcement');
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;

    console.log('🗑️ Deleting announcement:', id);

    try {
      const url = `/api/admin/announcements/${id}?adminAddress=${adminAddress}`;
      console.log('🗑️ DELETE URL:', url);

      const response = await fetch(url, { method: 'DELETE' });
      const data = await response.json();

      console.log('🗑️ DELETE Response:', { status: response.status, data });

      if (data.success) {
        toast.success('Announcement deleted');
        
        // Optimistic update - remove immediately from UI
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        console.log('🗑️ Optimistically removed from state');
        
        // Reconcile with server
        const newList = await fetchAnnouncements();
        console.log('🗑️ After refetch, announcements count:', newList.length);
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Error deleting announcement');
      console.error('🗑️ DELETE Error:', error);
    }
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
          <h2 className="font-adonis text-2xl">Announcements</h2>
          <p className="font-georgia-pro text-sm text-gray-600">
            Post announcements to the community
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
        >
          + New Announcement
        </button>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="font-georgia-pro text-gray-500">No announcements yet</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-adonis text-xl">{announcement.title}</h3>
                    {announcement.contributors_only && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-georgia-pro font-medium">
                        Contributors Only
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-georgia-pro text-gray-500">
                    Posted {format(new Date(announcement.posted_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
              </div>

              <p className="font-georgia-pro text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                {announcement.content}
              </p>

              <button
                onClick={() => handleDelete(announcement.id)}
                className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h3 className="font-adonis text-2xl mb-6">New Announcement</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block font-georgia-pro text-sm mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  placeholder="e.g., New Feature Launch"
                  required
                />
              </div>

              <div>
                <label className="block font-georgia-pro text-sm mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded font-georgia-pro"
                  placeholder="Write your announcement..."
                  rows={6}
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.contributorsOnly}
                    onChange={(e) =>
                      setFormData({ ...formData, contributorsOnly: e.target.checked })
                    }
                    className="rounded"
                  />
                  <span className="font-georgia-pro text-sm">
                    Contributors Only (hide from free members)
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-black text-white rounded-full font-georgia-pro hover:bg-gray-800 transition"
                >
                  Post Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
