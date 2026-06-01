'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Proposal {
  id: string;
  title: string;
  description: string;
  created_by: string;
  created_at: string;
  status: string;
  vote_threshold: number;
}

interface ProposalsManagerProps {
  adminAddress: string;
}

export function ProposalsManager({ adminAddress }: ProposalsManagerProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  // Per-proposal threshold overrides (keyed by proposal id)
  const [thresholds, setThresholds] = useState<Record<string, number>>({});

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/proposals?adminAddress=${adminAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposals(data.proposals);
      // Seed threshold inputs with each proposal's current value
      const initial: Record<string, number> = {};
      (data.proposals as Proposal[]).forEach((p) => {
        initial[p.id] = p.vote_threshold ?? 3;
      });
      setThresholds(initial);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [adminAddress]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleAction = async (id: string, status: 'open' | 'rejected') => {
    setActingId(id);
    try {
      const res = await fetch('/api/admin/proposals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          adminAddress,
          // Only send threshold when approving
          ...(status === 'open' ? { vote_threshold: thresholds[id] ?? 3 } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        status === 'open'
          ? `Proposal approved — live for voting (threshold: ${thresholds[id] ?? 3} votes)`
          : 'Proposal rejected',
      );
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-adonis text-2xl mb-1">Proposal Review</h2>
        <p className="font-georgia-pro text-sm text-gray-500">
          Set a vote threshold, then approve to make a proposal live for Contributors to vote on. Reject to remove it from the queue.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="font-adonis text-xl text-gray-700 mb-1">No pending proposals</p>
          <p className="font-georgia-pro text-sm text-gray-400">
            New submissions from Knead Monthly members will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="bg-white border border-gray-200 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <h3 className="font-adonis text-xl text-gray-900 mb-1">{proposal.title}</h3>
                  <p className="font-georgia-pro text-gray-600 text-sm leading-relaxed mb-3">
                    {proposal.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-georgia-pro text-gray-400">
                    <span>
                      Submitted by{' '}
                      <span className="font-mono">
                        {proposal.created_by.slice(0, 6)}…{proposal.created_by.slice(-4)}
                      </span>
                    </span>
                    <span>{format(new Date(proposal.created_at), 'MMM d, yyyy · h:mm a')}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 shrink-0">
                  {/* Vote threshold control */}
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`threshold-${proposal.id}`}
                      className="font-georgia-pro text-xs text-gray-500 whitespace-nowrap"
                    >
                      Votes needed to trigger:
                    </label>
                    <input
                      id={`threshold-${proposal.id}`}
                      type="number"
                      min={1}
                      max={50}
                      value={thresholds[proposal.id] ?? 3}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1 && val <= 50) {
                          setThresholds((prev) => ({ ...prev, [proposal.id]: val }));
                        }
                      }}
                      disabled={actingId === proposal.id}
                      className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg font-georgia-pro text-sm text-center focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(proposal.id, 'rejected')}
                      disabled={actingId === proposal.id}
                      className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg font-georgia-pro text-sm hover:border-red-300 hover:text-red-600 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(proposal.id, 'open')}
                      disabled={actingId === proposal.id}
                      className="px-4 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50"
                    >
                      {actingId === proposal.id ? 'Saving…' : 'Approve'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
