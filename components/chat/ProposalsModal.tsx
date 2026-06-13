'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, ThumbsUp, ThumbsDown, Clock, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveAccount } from 'thirdweb/react';
import { useMembership } from '@/components/membership-provider';
import { walletFetch } from '@/lib/auth/wallet-fetch';
import { subDays, isAfter, format } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  description: string;
  items: any[];
  vote_threshold: number;
  vote_count: number;
  status: 'open' | 'triggered' | 'executing' | 'executed';
  created_by: string;
  created_at: string;
  user_has_voted: boolean;
}

interface ProposalsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isContributor?: boolean;
}

export function ProposalsModal({ isOpen, onClose, isContributor = false }: ProposalsModalProps) {
  const account = useActiveAccount();
  const { membershipType, isLoading: membershipLoading } = useMembership();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState('');
  const [items, setItems] = useState([{ name: '', url: '' }]);
  const [shippingAddress, setShippingAddress] = useState('');
  const [laborUsdc, setLaborUsdc] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [weeklyLimitHit, setWeeklyLimitHit] = useState(false);

  const isPremium = membershipType === 'premium';
  const address = account?.address;
  const isReady = !membershipLoading && !loading;

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const url = address
        ? `/api/proposals?viewer=${encodeURIComponent(address)}`
        : '/api/proposals';
      const res = await fetch(url);
      const data = await res.json();
      if (data.proposals) {
        setProposals(data.proposals);
      }
    } catch {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setWeeklyLimitHit(false);
      setTitle('');
      setDescription('');
      setAttachment('');
      setItems([{ name: '', url: '' }]);
      setShippingAddress('');
      setLaborUsdc('');
      setTotalBudget('');
      setEmail('');
      fetchProposals();
    }
  }, [isOpen, fetchProposals]);

  // This week: open proposals from the last 7 days — eligible for voting
  const thisWeekProposals = proposals.filter(
    (p) => p.status === 'open' && isAfter(new Date(p.created_at), subDays(new Date(), 7)),
  );

  // Previous: proposals that have passed the voting stage
  const previousProposals = proposals.filter(
    (p) => p.status !== 'open',
  );

  const handleVote = async (proposal: Proposal) => {
    if (!account?.address) { toast.error('Connect your wallet to vote'); return; }

    setVotingId(proposal.id);
    try {
      const method = proposal.user_has_voted ? 'DELETE' : 'POST';
      // Voter identity is proven by the signed headers (walletFetch) and
      // verified server-side; address is no longer sent in the body.
      const res = await walletFetch(`/api/proposals/${proposal.id}/vote`, account, {
        method,
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to vote');
      } else {
        toast.success(proposal.user_has_voted ? 'Vote removed' : 'Vote cast');
        await fetchProposals();
      }
    } catch {
      toast.error('Failed to vote');
    } finally {
      setVotingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) { toast.error('Connect your wallet'); return; }
    if (!title.trim() || !description.trim()) { toast.error('Title and description are required'); return; }

    const laborNum = parseFloat(laborUsdc);
    if (laborUsdc && (isNaN(laborNum) || laborNum > 1000)) {
      toast.error('Labor USDC request cannot exceed $1,000'); return;
    }
    const budgetNum = parseFloat(totalBudget);
    if (totalBudget && (isNaN(budgetNum) || budgetNum > 5000)) {
      toast.error('Total budget cannot exceed $5,000'); return;
    }

    const filteredItems = items.filter(i => i.name.trim());

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          address,
          email: email || undefined,
          attachment: attachment || undefined,
          itemizedItems: filteredItems.length ? filteredItems : undefined,
          shippingAddress: shippingAddress || undefined,
          laborUsdc: laborUsdc || undefined,
          totalBudget: totalBudget || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setWeeklyLimitHit(true);
        } else {
          toast.error(data.error || 'Failed to submit proposal');
        }
      } else {
        setSubmitted(true);
        await fetchProposals();
      }
    } catch {
      toast.error('Failed to submit proposal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-50 text-blue-700',
      triggered: 'bg-amber-50 text-amber-700',
      executing: 'bg-purple-50 text-purple-700',
      executed: 'bg-green-50 text-green-700',
    };
    const labels: Record<string, string> = {
      open: 'Open',
      triggered: 'Approved',
      executing: 'Executing',
      executed: 'Executed',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-adonis">Proposals</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {!isReady ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
                </div>
              ) : !address ? (
                <NoWalletView />
              ) : isPremium || isContributor ? (
                <>
                  {/* Premium member only (not contributors) — submit form */}
                  {isPremium && !isContributor && (
                    <SubmitSection
                      submitted={submitted}
                      weeklyLimitHit={weeklyLimitHit}
                      title={title}
                      description={description}
                      attachment={attachment}
                      items={items}
                      shippingAddress={shippingAddress}
                      laborUsdc={laborUsdc}
                      totalBudget={totalBudget}
                      email={email}
                      isSubmitting={isSubmitting}
                      onTitleChange={setTitle}
                      onDescriptionChange={setDescription}
                      onAttachmentChange={setAttachment}
                      onItemsChange={setItems}
                      onShippingAddressChange={setShippingAddress}
                      onLaborUsdcChange={setLaborUsdc}
                      onTotalBudgetChange={setTotalBudget}
                      onEmailChange={setEmail}
                      onSubmit={handleSubmit}
                      onReset={() => {
                        setSubmitted(false);
                        setWeeklyLimitHit(false);
                        setTitle('');
                        setDescription('');
                        setAttachment('');
                        setItems([{ name: '', url: '' }]);
                        setShippingAddress('');
                        setLaborUsdc('');
                        setTotalBudget('');
                        setEmail('');
                      }}
                    />
                  )}

                  {/* Contributor — this week's proposals + previous */}
                  {isContributor && (
                    <>
                      <VoteSection
                        proposals={thisWeekProposals}
                        votingId={votingId}
                        onVote={handleVote}
                        onRefresh={fetchProposals}
                        getStatusBadge={getStatusBadge}
                      />
                      {previousProposals.length > 0 && (
                        <PreviousSection
                          proposals={previousProposals}
                          getStatusBadge={getStatusBadge}
                        />
                      )}
                    </>
                  )}
                </>
              ) : (
                <NoRoleView />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-sections ──────────────────────────────────────────────────────────────

function SubmitSection({
  submitted,
  weeklyLimitHit,
  title,
  description,
  attachment,
  items,
  shippingAddress,
  laborUsdc,
  totalBudget,
  email,
  isSubmitting,
  onTitleChange,
  onDescriptionChange,
  onAttachmentChange,
  onItemsChange,
  onShippingAddressChange,
  onLaborUsdcChange,
  onTotalBudgetChange,
  onEmailChange,
  onSubmit,
  onReset,
}: {
  submitted: boolean;
  weeklyLimitHit: boolean;
  title: string;
  description: string;
  attachment: string;
  items: { name: string; url: string }[];
  shippingAddress: string;
  laborUsdc: string;
  totalBudget: string;
  email: string;
  isSubmitting: boolean;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onAttachmentChange: (v: string) => void;
  onItemsChange: (v: { name: string; url: string }[]) => void;
  onShippingAddressChange: (v: string) => void;
  onLaborUsdcChange: (v: string) => void;
  onTotalBudgetChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
}) {
  const addItem = () => onItemsChange([...items, { name: '', url: '' }]);
  const removeItem = (i: number) => onItemsChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: 'name' | 'url', val: string) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: val } : item);
    onItemsChange(next);
  };

  const label = "block font-georgia-pro text-xs text-gray-400 mb-1.5 uppercase tracking-widest";
  const input = "w-full px-4 py-3 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-300";

  return (
    <div className="mb-8">
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-gray-200 rounded-2xl p-8 text-center"
          >
            <p className="font-adonis text-2xl text-gray-900 mb-2">Proposal submitted.</p>
            <p className="font-georgia-pro text-gray-500 text-sm">
              {email ? `A confirmation has been sent to ${email}.` : 'The community will now vote on it.'}
            </p>
          </motion.div>
        ) : weeklyLimitHit ? (
          <motion.div
            key="limit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border border-amber-200 bg-amber-50 rounded-2xl p-8 text-center"
          >
            <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <p className="font-adonis text-xl text-gray-900 mb-2">One proposal per week</p>
            <p className="font-georgia-pro text-gray-500 text-sm mb-6 max-w-sm mx-auto">
              You've already submitted a proposal this week. Check back once your current one has been reviewed.
            </p>
            <button onClick={onReset} className="font-georgia-pro text-sm text-gray-500 underline underline-offset-2 hover:text-gray-900 transition-colors">
              Go back
            </button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h3 className="font-adonis text-2xl text-gray-900 mb-4 text-center">Want to submit a Demeter proposal?</h3>
            <div className="font-georgia-pro text-gray-700 text-base leading-relaxed space-y-4 mb-6">
              <p>Demeter is our agent aimed to help get your creative ideas off the ground.</p>
              <p>As a Knead Monthly member, you get to submit a proposal once per week for an idea around any creative discipline.</p>
              <p>We highly encourage people to itemize the materials they'd like for a higher chance of approval, so Demeter can directly make orders.</p>
              <p>Upon admin approval, the proposal will be sent to the Contributor's panel for voting.</p>
              <p>If the proposal passes the voting threshold, Demeter will begin ordering your requested items and send the corresponding USDC to your address.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              {/* Title */}
              <div>
                <label className={label}>Title</label>
                <input type="text" value={title} onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Give your proposal a clear title" maxLength={120}
                  className={input} disabled={isSubmitting} />
              </div>

              {/* Description */}
              <div>
                <label className={label}>Description & Request</label>
                <p className="font-georgia-pro text-xs text-gray-400 mb-1.5">
                  Describe the scope of your project. Include any useful links in your pitch.
                </p>
                <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none placeholder-gray-300"
                  disabled={isSubmitting} />
              </div>

              {/* Supplementary attachment */}
              <div>
                <label className={label}>
                  Supplementary Items{' '}
                  <span className="normal-case text-gray-300">(optional — link or description)</span>
                </label>
                <input type="text" value={attachment} onChange={(e) => onAttachmentChange(e.target.value)}
                  placeholder="Link, file URL, or description of any supporting material"
                  className={input} disabled={isSubmitting} />
              </div>

              {/* Itemized Items */}
              <div>
                <label className={label}>Itemized Items</label>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input type="text" value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)}
                        placeholder="Item name"
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-300"
                        disabled={isSubmitting} />
                      <input type="text" value={item.url} onChange={(e) => updateItem(i, 'url', e.target.value)}
                        placeholder="Item URL (optional)"
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-300"
                        disabled={isSubmitting} />
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} disabled={isSubmitting}
                          className="p-2.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addItem} disabled={isSubmitting}
                    className="flex items-center gap-1.5 font-georgia-pro text-sm text-gray-500 hover:text-black transition-colors disabled:opacity-40 mt-1">
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </button>
                </div>
              </div>

              {/* Shipping */}
              <div>
                <label className={label}>
                  Shipping Address{' '}
                  <span className="normal-case text-gray-300">(optional)</span>
                </label>
                <input type="text" value={shippingAddress} onChange={(e) => onShippingAddressChange(e.target.value)}
                  placeholder="Best address for shipping"
                  className={input} disabled={isSubmitting} />
              </div>

              {/* Labor USDC */}
              <div>
                <label className={label}>
                  USDC Request for Labor{' '}
                  <span className="normal-case text-gray-300">Max: $1,000 USDC</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-georgia-pro text-sm text-gray-400">$</span>
                  <input type="number" min="0" max="1000" step="1" value={laborUsdc}
                    onChange={(e) => onLaborUsdcChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-300"
                    disabled={isSubmitting} />
                </div>
              </div>

              {/* Total Budget */}
              <div>
                <label className={label}>
                  Total Budget{' '}
                  <span className="normal-case text-gray-300">Max: $5,000</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-georgia-pro text-sm text-gray-400">$</span>
                  <input type="number" min="0" max="5000" step="1" value={totalBudget}
                    onChange={(e) => onTotalBudgetChange(e.target.value)}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-black placeholder-gray-300"
                    disabled={isSubmitting} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={label}>
                  Email{' '}
                  <span className="normal-case text-gray-300">(optional — for confirmation)</span>
                </label>
                <input type="email" value={email} onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="your@email.com"
                  className={input} disabled={isSubmitting} />
              </div>

              <div className="flex justify-center pt-2">
                <button type="submit" disabled={isSubmitting}
                  className="px-8 py-3 bg-black text-white rounded-xl font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Submitting…' : 'Submit Proposal'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VoteSection({
  proposals,
  votingId,
  onVote,
  onRefresh,
  getStatusBadge,
}: {
  proposals: Proposal[];
  votingId: string | null;
  onVote: (p: Proposal) => void;
  onRefresh: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-adonis text-2xl text-gray-900">This Week's Proposals</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          title="Refresh proposals"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="font-georgia-pro text-gray-500 text-sm mb-5">
        Here's a list of all the proposals submitted this week. Vote on your favorite below:
      </p>

      {proposals.length === 0 ? (
        <div className="text-center py-10 border border-gray-100 rounded-2xl">
          <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-georgia-pro text-gray-500 text-sm">There's no proposals to vote on right now.</p>
          <p className="font-georgia-pro text-gray-400 text-sm mt-1">Check back again soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const progress = Math.min((proposal.vote_count / proposal.vote_threshold) * 100, 100);
            const isVotingThis = votingId === proposal.id;
            const canVote = proposal.status === 'open';

            return (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-adonis text-xl text-gray-900">{proposal.title}</h4>
                      {getStatusBadge(proposal.status)}
                    </div>
                    <p className="font-georgia-pro text-gray-600 text-sm leading-relaxed">
                      {proposal.description}
                    </p>
                  </div>
                  {canVote && (
                    <button
                      onClick={() => onVote(proposal)}
                      disabled={isVotingThis}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-georgia-pro transition-all disabled:opacity-50 ${
                        proposal.user_has_voted
                          ? 'bg-black text-white hover:bg-gray-800'
                          : 'border border-gray-300 text-gray-700 hover:border-black hover:text-black'
                      }`}
                    >
                      {isVotingThis ? (
                        <span className="inline-block w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : proposal.user_has_voted ? (
                        <ThumbsDown className="w-3.5 h-3.5" />
                      ) : (
                        <ThumbsUp className="w-3.5 h-3.5" />
                      )}
                      {proposal.user_has_voted ? 'Remove vote' : 'Vote'}
                    </button>
                  )}
                </div>

                {/* Vote progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-georgia-pro text-xs text-gray-400">Votes toward threshold</span>
                    <span className="font-georgia-pro text-xs text-gray-600">
                      {proposal.vote_count} / {proposal.vote_threshold}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-black'}`}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviousSection({
  proposals,
  getStatusBadge,
}: {
  proposals: Proposal[];
  getStatusBadge: (status: string) => React.ReactNode;
}) {
  return (
    <div className="mt-10 pt-8 border-t border-gray-100">
      <h3 className="font-adonis text-xl text-gray-700 mb-1">Previous Proposals</h3>
      <p className="font-georgia-pro text-gray-400 text-sm mb-5">
        A record of proposals the community has actioned.
      </p>
      <div className="space-y-3">
        {proposals.map((proposal) => {
          const progress = Math.min((proposal.vote_count / proposal.vote_threshold) * 100, 100);
          return (
            <div
              key={proposal.id}
              className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50"
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-adonis text-base text-gray-800">{proposal.title}</h4>
                    {getStatusBadge(proposal.status)}
                  </div>
                  <p className="font-georgia-pro text-gray-500 text-xs leading-relaxed line-clamp-2">
                    {proposal.description}
                  </p>
                </div>
                <span className="font-georgia-pro text-xs text-gray-400 shrink-0 whitespace-nowrap">
                  {format(new Date(proposal.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              {/* Compact vote bar */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex-1 h-0.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${progress >= 100 ? 'bg-green-400' : 'bg-gray-400'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="font-georgia-pro text-xs text-gray-400 shrink-0">
                  {proposal.vote_count} / {proposal.vote_threshold} votes
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NoWalletView() {
  return (
    <div className="text-center py-16">
      <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <p className="font-adonis text-xl text-gray-700 mb-2">Connect your wallet</p>
      <p className="font-georgia-pro text-sm text-gray-400">
        Connect to see proposals and participate in governance.
      </p>
    </div>
  );
}

function NoRoleView() {
  return (
    <div className="text-center py-16">
      <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
      <p className="font-adonis text-xl text-gray-700 mb-2">Community governance</p>
      <p className="font-georgia-pro text-sm text-gray-400 max-w-sm mx-auto">
        Knead Monthly members can submit proposals. Contributors vote on which ones the agent executes.
      </p>
    </div>
  );
}
