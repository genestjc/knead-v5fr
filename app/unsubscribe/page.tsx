'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email');
  const type = searchParams.get('type'); // 'events' or 'contributors'

  const [email, setEmail] = useState(emailParam || '');
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!type || !['events', 'contributors'].includes(type)) {
      setError('Invalid unsubscribe link. Please contact support.');
    }
  }, [type]);

  const handleUnsubscribe = async () => {
    if (!email || !type) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsUnsubscribing(true);
    setError('');

    try {
      const endpoint =
        type === 'events'
          ? '/api/mailing/unsubscribe-events-public'
          : '/api/mailing/unsubscribe-contributor-public';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to unsubscribe');
      }

      setIsUnsubscribed(true);
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsUnsubscribing(false);
    }
  };

  const listName = type === 'events' ? 'Events' : 'Contributors';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full">
        {isUnsubscribed ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-adonis text-2xl text-gray-900">{"You've been unsubscribed"}</h1>
            <p className="font-georgia-pro text-gray-600">
              {email} has been removed from the Knead {listName} mailing list.
            </p>
            <p className="font-georgia-pro text-sm text-gray-500">
              {"You won't receive any more emails from us. If this was a mistake, you can re-subscribe on our website."}
            </p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition"
            >
              Return to Knead
            </a>
          </div>
        ) : error && !['events', 'contributors'].includes(type || '') ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="font-adonis text-2xl text-gray-900">Something went wrong</h1>
            <p className="font-georgia-pro text-gray-600">{error}</p>
            <a
              href="/"
              className="inline-block mt-4 px-6 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition"
            >
              Return to Knead
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="font-adonis text-2xl text-gray-900">Unsubscribe from {listName}</h1>
              <p className="font-georgia-pro text-gray-600 mt-2">
                Are you sure you want to unsubscribe from Knead {listName} emails?
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
              {!emailParam && (
                <div>
                  <label className="font-georgia-pro text-sm font-semibold text-gray-700 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-georgia-pro text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              )}
              {emailParam && (
                <p className="font-georgia-pro text-sm text-gray-700">
                  <span className="font-semibold">Email:</span> {email}
                </p>
              )}
              <p className="font-georgia-pro text-sm text-gray-700">
                <span className="font-semibold">List:</span> {listName}
              </p>
            </div>

            {error && (
              <p className="font-georgia-pro text-sm text-red-600 text-center">{error}</p>
            )}

            <div className="space-y-3">
              <button
                onClick={handleUnsubscribe}
                disabled={isUnsubscribing}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-georgia-pro text-sm hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnsubscribing ? 'Unsubscribing...' : 'Yes, unsubscribe me'}
              </button>
              <a
                href="/"
                className="block w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-georgia-pro text-sm hover:bg-gray-50 transition text-center"
              >
                Cancel, keep me subscribed
              </a>
            </div>

            <p className="font-georgia-pro text-xs text-gray-500 text-center">
              You will no longer receive {listName.toLowerCase()} emails from Knead Magazine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
