'use client';

import { useState, useEffect } from 'react';

/**
 * Contributor Pool Widget
 * 
 * Displays the current contributor pool balance in the admin panel.
 * Shows next distribution date and auto-refreshes every 30 seconds.
 */
export function ContributorPoolWidget() {
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPoolBalance = async () => {
    try {
      const response = await fetch('/api/contributor/pool-balance');
      const data = await response.json();

      if (data.success) {
        setPoolBalance(data.balance);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch pool balance');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolBalance();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPoolBalance, 30000);

    return () => clearInterval(interval);
  }, []);

  // Calculate next distribution date (Sunday midnight UTC)
  const getNextDistribution = () => {
    const now = new Date();
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const nextSunday = new Date(now);
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(0, 0, 0, 0);
    
    return nextSunday.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            💰 Contributor Pool
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Weekly distribution to all contributors
          </p>
        </div>
        <button
          onClick={fetchPoolBalance}
          disabled={isLoading}
          className="text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50"
        >
          {isLoading ? '⟳' : '↻'} Refresh
        </button>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-4 border border-purple-100">
            <div className="text-sm text-gray-600 mb-1">Current Balance</div>
            <div className="text-3xl font-bold text-purple-900">
              {isLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                <>
                  {poolBalance?.toFixed(2)} <span className="text-xl text-gray-500">$TOWNS</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              <span className="font-medium">Next Distribution:</span>{' '}
              {getNextDistribution()}
            </div>
            <div className="text-gray-500">
              ⏰ Sunday, 12:00 AM UTC
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-md p-3">
            <p className="text-xs text-gray-600 leading-relaxed">
              💡 <strong>Weighted Distribution:</strong> Earned (3x) &gt; Invited (2x) &gt; Appointed (1x)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
