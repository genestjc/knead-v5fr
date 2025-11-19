'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface ModerationPanelProps {
  adminId: string;
}

export function ModerationPanel({ adminId }: ModerationPanelProps) {
  const [flaggedMessages, setFlaggedMessages] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/moderation?adminId=${adminId}`);
      const data = await response.json();

      if (data.success) {
        setFlaggedMessages(data.data.flaggedMessages || []);
        setLogs(data.data.logs || []);
      } else {
        setError(data.error || 'Failed to fetch moderation data');
      }
    } catch (err) {
      setError('Error fetching moderation data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleModerateMessage = async (messageId: string, action: 'hide' | 'unhide', reason?: string) => {
    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          messageId,
          action,
          reason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchData();
      } else {
        alert(data.error || 'Failed to moderate message');
      }
    } catch (err) {
      console.error(err);
      alert('Error moderating message');
    }
  };

  const handleBanUser = async (userId: string) => {
    const reason = prompt('Enter ban reason:');
    if (!reason) return;

    try {
      const response = await fetch('/api/admin/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          userId,
          action: 'ban',
          reason,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('User banned successfully');
        fetchData();
      } else {
        alert(data.error || 'Failed to ban user');
      }
    } catch (err) {
      console.error(err);
      alert('Error banning user');
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
    <div className="space-y-8">
      <div>
        <h2 className="font-adonis text-2xl mb-1">Moderation Panel</h2>
        <p className="font-georgia-pro text-sm text-gray-600">Review flagged content and user reports</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-georgia-pro text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Flagged Messages */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Flagged Messages ({flaggedMessages.length})</h3>
        {flaggedMessages.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <p className="font-georgia-pro text-gray-500">No flagged messages</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flaggedMessages.map((message) => (
              <div key={message.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-georgia-pro font-semibold">{message.user.displayName}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {message.channelId}
                      </span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                        Score: {(message.moderationScore * 100).toFixed(0)}%
                      </span>
                      {message.isHidden && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                          HIDDEN
                        </span>
                      )}
                    </div>
                    <p className="font-georgia-pro text-sm mb-2">{message.content}</p>
                    {message.moderationCategories && (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(message.moderationCategories).map(([key, value]: [string, any]) =>
                          value > 0.5 ? (
                            <span key={key} className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                              {key}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!message.isHidden ? (
                    <button
                      onClick={() => handleModerateMessage(message.id, 'hide', 'Flagged by moderation system')}
                      className="px-4 py-2 bg-yellow-600 text-white rounded font-georgia-pro text-sm hover:bg-yellow-700 transition"
                    >
                      Hide Message
                    </button>
                  ) : (
                    <button
                      onClick={() => handleModerateMessage(message.id, 'unhide')}
                      className="px-4 py-2 bg-green-600 text-white rounded font-georgia-pro text-sm hover:bg-green-700 transition"
                    >
                      Unhide Message
                    </button>
                  )}
                  <button
                    onClick={() => handleBanUser(message.user.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded font-georgia-pro text-sm hover:bg-red-700 transition"
                  >
                    Ban User
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moderation Logs */}
      <div>
        <h3 className="font-adonis text-xl mb-4">Recent Actions ({logs.length})</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Admin</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-georgia-pro text-sm font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center">
                    <p className="font-georgia-pro text-gray-500">No moderation actions yet</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 font-georgia-pro text-sm">{log.adminName || 'Unknown'}</td>
                    <td className="px-4 py-3 font-georgia-pro text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        log.action === 'ban' ? 'bg-red-100 text-red-800' :
                        log.action === 'hide' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {log.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-georgia-pro text-sm text-gray-600">{log.reason || '-'}</td>
                    <td className="px-4 py-3 font-georgia-pro text-sm text-gray-500">
                      {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
