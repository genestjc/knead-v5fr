'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function EventsEmailSignup() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/mailing/subscribe-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'welcome_modal' }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Subscription failed');
      }

      setIsSubscribed(true);
      toast({
        title: 'Subscribed!',
        description: "You've been added to our events mailing list.",
      });
    } catch (err) {
      console.error('Events signup error:', err);
      toast({
        title: 'Subscription failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubscribed) {
    return (
      <p className="font-georgia-pro text-sm text-green-700">
        ✓ You're on the list! We'll keep you updated on upcoming events.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black font-georgia-pro text-sm"
        disabled={isSubmitting}
        required
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-5 py-2 bg-black text-white rounded-lg font-georgia-pro text-sm hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {isSubmitting ? 'Signing up...' : 'Sign Up'}
      </button>
    </form>
  );
}
