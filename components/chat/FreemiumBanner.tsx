/**
 * Freemium Banner Component
 * 
 * Displays timer banner for freemium users showing remaining viewing time.
 * Includes upgrade CTA when time is running low.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface FreemiumBannerProps {
  remainingMinutes: number | null;
}

export function FreemiumBanner({ remainingMinutes }: FreemiumBannerProps) {
  if (remainingMinutes === null) {
    return null;
  }

  // Determine banner style based on remaining time
  const isLowTime = remainingMinutes <= 10;
  const isVeryLowTime = remainingMinutes <= 5;
  const noTimeLeft = remainingMinutes <= 0;

  // Color scheme based on urgency
  const bgColor = noTimeLeft 
    ? 'bg-red-100 border-red-500' 
    : isVeryLowTime 
      ? 'bg-orange-100 border-orange-500' 
      : isLowTime 
        ? 'bg-yellow-100 border-yellow-500' 
        : 'bg-blue-100 border-blue-500';

  const textColor = noTimeLeft 
    ? 'text-red-800' 
    : isVeryLowTime 
      ? 'text-orange-800' 
      : isLowTime 
        ? 'text-yellow-800' 
        : 'text-blue-800';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${bgColor} border-l-4 p-4 mb-4 mx-4 rounded-r-lg`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {noTimeLeft ? '🚫' : '⏱️'}
          </span>
          <div>
            <p className={`font-georgia-pro font-semibold ${textColor}`}>
              {noTimeLeft 
                ? 'Free viewing time expired' 
                : `Free viewing time: ${remainingMinutes} min remaining this month`
              }
            </p>
            <p className={`text-sm ${textColor} opacity-80 mt-1`}>
              {noTimeLeft 
                ? 'Upgrade to Knead Monthly to continue chatting' 
                : 'Upgrade for unlimited access and participation'
              }
            </p>
          </div>
        </div>

        {/* Upgrade CTA */}
        <Link 
          href="/membership"
          className={`
            px-4 py-2 rounded-full font-georgia-pro text-sm font-semibold
            transition-all hover:scale-105
            ${noTimeLeft 
              ? 'bg-red-600 text-white hover:bg-red-700' 
              : isVeryLowTime 
                ? 'bg-orange-600 text-white hover:bg-orange-700' 
                : 'bg-black text-white hover:bg-gray-800'
            }
          `}
        >
          Upgrade Now
        </Link>
      </div>

      {/* Progress bar */}
      {!noTimeLeft && (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${(remainingMinutes / 60) * 100}%` }}
            transition={{ duration: 0.5 }}
            className={`h-2 rounded-full ${
              isVeryLowTime 
                ? 'bg-orange-500' 
                : isLowTime 
                  ? 'bg-yellow-500' 
                  : 'bg-blue-500'
            }`}
          />
        </div>
      )}
    </motion.div>
  );
}
