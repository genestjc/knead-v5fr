'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useActiveAccount } from 'thirdweb/react';
import { useContributorPermissions } from '@/hooks/use-contributor-permissions';

interface Announcement {
  id: string;
  title: string;
  content: string;
  contributors_only: boolean;
  posted_by: string;
  posted_at: string;
}

interface AnnouncementsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AnnouncementsModal({ isOpen, onClose }: AnnouncementsModalProps) {
  const activeAccount = useActiveAccount();
  const { isContributor } = useContributorPermissions(activeAccount?.address);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/announcements?isContributor=${isContributor}`);
      const data = await response.json();

      if (data.success) {
        setAnnouncements(data.data || []);
      } else {
        toast.error('Failed to load announcements');
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [isContributor]);

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
    }
  }, [isOpen, fetchAnnouncements]);

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
            className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <Megaphone className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-adonis">Announcements</h2>
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
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-12">
                  <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="font-georgia-pro text-gray-500">No announcements yet</p>
                  <p className="font-georgia-pro text-sm text-gray-400 mt-2">Check back soon.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement) => (
                    <motion.div
                      key={announcement.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-xl font-adonis text-gray-900">
                              {announcement.title}
                            </h3>
                            {announcement.contributors_only && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-georgia-pro font-medium">
                              Contributors Only
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-georgia-pro text-gray-500">
                            {format(new Date(announcement.posted_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      </div>

                      <p className="font-georgia-pro text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
