'use client';

import React from 'react';
import Link from 'next/link';

interface FreemiumBannerProps {
  remainingMinutes: number | null;
}

export function FreemiumBanner({ remainingMinutes }: FreemiumBannerProps) {
  // Only show when 10 minutes or less remain
  if (remainingMinutes === null || remainingMinutes > 10) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-4 py-2 flex items-center justify-between text-sm z-50">
      <span className="font-georgia-pro">
        {remainingMinutes} minute{remainingMinutes !== 1 ? 's' : ''} remain this month
      </span>
      <Link 
        href="/join"
        className="font-georgia-pro underline hover:text-gray-300 transition"
      >
        upgrade today
      </Link>
    </div>
  );
}
