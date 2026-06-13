'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { useToast } from '@/hooks/use-toast';
import { adminFetch } from '@/lib/admin/admin-fetch';

interface Subscriber {
  id: string;
  email: string;
  subscribed_at: string;
  user_address?: string;
}

interface MailingListManagerProps {
  adminAddress: string;
  listType: 'events' | 'contributors';
}

export function MailingListManager({ adminAddress, listType }: MailingListManagerProps) {
  const account = useActiveAccount();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  // Add subscriber form state
  const [newEmail, setNewEmail] = useState('');
  const [newWallet, setNewWallet] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const { toast } = useToast();

  const fromEmail =
    listType === 'events' ? 'events@kneadmag.com' : 'contributors@kneadmag.com';

  const listLabel = listType === 'events' ? 'Events' : 'Contributors';

  // Unsubscribe footer snippet (for reference — the system adds this automatically per recipient)
  const unsubscribeFooter = `<hr style="margin: 40px 0; border: none; border-top: 1px solid #e5e7eb;">
<p style="font-size: 12px; color: #6b7280; text-align: center; margin: 20px 0;">
  You're receiving this email because you subscribed to Knead Magazine ${listLabel} updates.<br>
  <a href="https://kneadmag.com/unsubscribe?email=SUBSCRIBER_EMAIL&type=${listType}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
</p>`;

  const handleCopyFooter = () => {
    navigator.clipboard.writeText(unsubscribeFooter);
    toast({
      title: 'Copied!',
      description: 'Unsubscribe footer copied to clipboard.',
    });
  };

  const fetchSubscribers = useCallback(async () => {
    if (!account) return;
    setIsLoading(true);
    try {
      const res = await adminFetch(`/api/mailing/list?type=${listType}`, account);
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load subscribers',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Fetch subscribers error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load subscribers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [account, listType, toast]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleAddSubscriber = async () => {
    if (!newEmail) {
      toast({
        title: 'Email required',
        description: 'Please enter an email address',
        variant: 'destructive',
      });
      return;
    }

    if (listType === 'contributors' && !newWallet) {
      toast({
        title: 'Wallet required',
        description: 'Please enter a wallet address for contributors',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);
    try {
      const endpoint = listType === 'events' 
        ? '/api/mailing/subscribe-events'
        : '/api/mailing/subscribe-contributor';

      const body = listType === 'events'
        ? { email: newEmail }
        : { email: newEmail, userAddress: newWallet };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to add subscriber');
      }

      toast({
        title: 'Subscriber added!',
        description: `${newEmail} has been added to the ${listLabel} list.`,
      });

      setNewEmail('');
      setNewWallet('');
      setShowAddForm(false);
      fetchSubscribers();
    } catch (err) {
      console.error('Add subscriber error:', err);
      toast({
        title: 'Failed to add subscriber',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSubscriber = async (subscriberId: string, email: string) => {
    const confirmed = window.confirm(
      `Remove ${email} from the ${listLabel} mailing list?`
    );
    if (!confirmed) return;
    if (!account) {
      toast({ title: 'Error', description: 'Connect your admin wallet first', variant: 'destructive' });
      return;
    }

    try {
      const endpoint = listType === 'events'
        ? '/api/mailing/unsubscribe-events'
        : '/api/mailing/unsubscribe-contributor';

      const res = await adminFetch(endpoint, account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove subscriber');
      }

      toast({
        title: 'Subscriber removed',
        description: `${email} has been removed from the list.`,
      });

      fetchSubscribers();
    } catch (err) {
      console.error('Remove subscriber error:', err);
      toast({
        title: 'Failed to remove subscriber',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleExportCSV = () => {
    const headers =
      listType === 'contributors' ? 'Email,Wallet,Subscribed At' : 'Email,Subscribed At';
    const rows = [headers];
    subscribers.forEach((s) => {
      if (listType === 'contributors') {
        rows.push(
          `"${s.email}","${s.user_address || ''}","${new Date(s.subscribed_at).toLocaleString()}"`
        );
      } else {
        rows.push(`"${s.email}","${new Date(s.subscribed_at).toLocaleString()}"`);
      }
    });
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${listType}-subscribers.csv`;
    link.click();
  };

  const handleSendCampaign = async () => {
    if (!campaignName || !subject || !htmlContent) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in Campaign Name, Subject, and HTML Content.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = window.confirm(
      `Send "${subject}" to ${subscribers.length} ${listLabel} subscribers?`
    );
    if (!confirmed) return;

    if (!account) {
      toast({ title: 'Error', description: 'Connect your admin wallet first', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      const res = await adminFetch('/api/mailing/send-campaign', account, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listType,
          subject,
          htmlContent,
          fromEmail,
          campaignName,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to send campaign');
      }

      toast({
        title: 'Campaign sent!',
        description: `Sent to ${data.sentCount} subscribers.${
          data.errors?.length ? ` ${data.errors.length} error(s).` : ''
        }`,
      });

      setShowComposer(false);
      setSubject('');
      setHtmlContent('');
      setCampaignName('');
    } catch (err) {
      console.error('Send campaign error:', err);
      toast({
        title: 'Send failed',
        description: err instanceof Error ? err.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-adonis text-2xl">{listLabel} Mailing List</h2>
          <p className="font-georgia-pro text-sm text-gray-600 mt-1">
            Sent from: <span className="font-medium">{fromEmail}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-georgia-pro text-sm hover:bg-gray-50 transition"
          >
            {showAddForm ? 'Cancel' : 'Add Subscriber'}
          </button>
          <button
            onClick={handleExportCSV}
            disabled={isLoading || subscribers.length === 0}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-georgia-pro text-sm hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowComposer(!showComposer)}
            className="px-4 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition"
          >
            {showComposer ? 'Hide Composer' : 'Send Campaign'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="font-georgia-pro text-sm text-gray-500">Active Subscribers</p>
        <p className="font-adonis text-4xl mt-1">
          {isLoading ? '...' : subscribers.length.toLocaleString()}
        </p>
      </div>

      {/* Add Subscriber Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-adonis text-xl">Add Subscriber</h3>

          <div>
            <label className="block font-adonis text-sm text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="subscriber@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
              disabled={isAdding}
            />
          </div>

          {listType === 'contributors' && (
            <div>
              <label className="block font-adonis text-sm text-gray-700 mb-1">
                Wallet Address
              </label>
              <input
                type="text"
                value={newWallet}
                onChange={(e) => setNewWallet(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm font-mono"
                disabled={isAdding}
              />
            </div>
          )}

          <button
            onClick={handleAddSubscriber}
            disabled={isAdding}
            className="w-full px-4 py-3 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? 'Adding...' : 'Add Subscriber'}
          </button>
        </div>
      )}

      {/* Email Composer */}
      {showComposer && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-adonis text-xl">Compose Campaign</h3>

          <div>
            <label className="block font-adonis text-sm text-gray-700 mb-1">From</label>
            <input
              type="text"
              value={fromEmail}
              readOnly
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 font-georgia-pro text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block font-adonis text-sm text-gray-700 mb-1">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. March Events Newsletter"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
              disabled={isSending}
            />
          </div>

          <div>
            <label className="block font-adonis text-sm text-gray-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
              disabled={isSending}
            />
          </div>

          <div>
            <label className="block font-adonis text-sm text-gray-700 mb-1">HTML Content</label>
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<p>Your email HTML content here...</p>"
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm resize-y"
              disabled={isSending}
            />
          </div>

          {/* Unsubscribe Footer Snippet */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-adonis text-sm text-yellow-900">
                ⚠️ Required: Unsubscribe Footer
              </label>
              <button
                onClick={handleCopyFooter}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-xs font-georgia-pro hover:bg-yellow-700 transition"
              >
                Copy Footer
              </button>
            </div>
            <p className="font-georgia-pro text-xs text-yellow-800 mb-2">
              This footer is automatically appended to every email with each subscriber&apos;s personalized unsubscribe link. Shown here for reference only.
            </p>
            <pre className="bg-white border border-yellow-300 rounded p-3 text-xs overflow-x-auto font-mono text-gray-800">
              {unsubscribeFooter}
            </pre>
          </div>

          <button
            onClick={handleSendCampaign}
            disabled={isSending || subscribers.length === 0}
            className="w-full px-4 py-3 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending
              ? 'Sending...'
              : `Send to ${subscribers.length.toLocaleString()} Subscriber${subscribers.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Subscribers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-adonis text-lg">Subscribers</h3>
        </div>

        {isLoading ? (
          <div className="px-6 py-8 text-center font-georgia-pro text-sm text-gray-500">
            Loading subscribers...
          </div>
        ) : subscribers.length === 0 ? (
          <div className="px-6 py-8 text-center font-georgia-pro text-sm text-gray-500">
            No active subscribers yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-adonis text-xs text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  {listType === 'contributors' && (
                    <th className="px-6 py-3 text-left font-adonis text-xs text-gray-500 uppercase tracking-wider">
                      Wallet
                    </th>
                  )}
                  <th className="px-6 py-3 text-left font-adonis text-xs text-gray-500 uppercase tracking-wider">
                    Subscribed At
                  </th>
                  <th className="px-6 py-3 text-right font-adonis text-xs text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-georgia-pro text-sm text-gray-800">
                      {sub.email}
                    </td>
                    {listType === 'contributors' && (
                      <td className="px-6 py-4 font-georgia-pro text-sm text-gray-500 font-mono">
                        {sub.user_address
                          ? `${sub.user_address.slice(0, 6)}...${sub.user_address.slice(-4)}`
                          : '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 font-georgia-pro text-sm text-gray-500">
                      {new Date(sub.subscribed_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveSubscriber(sub.id, sub.email)}
                        className="text-red-600 hover:text-red-800 font-georgia-pro text-sm font-medium transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
