import { useState, useEffect, useCallback } from 'react';
import { DataService } from '../services/DataService';
import type { IPollData } from '../services/ProtobufSchemas';

/**
 * Custom hook for managing polls
 * Handles loading historical polls and subscribing to new polls
 *
 * @param {DataService | null} dataService - DataService instance
 * @returns {Object} Polls state and actions
 * @returns {IPollData[]} polls - Array of all polls
 * @returns {boolean} loading - Loading state
 * @returns {string | null} error - Error message if any
 * @returns {Function} createPoll - Function to create a new poll
 * @returns {Function} refreshPolls - Function to manually refresh polls
 *
 * @example
 * ```tsx
 * const { polls, loading, error, createPoll } = usePolls(dataService);
 *
 * if (loading) return <div>Loading polls...</div>;
 * if (error) return <div>Error: {error}</div>;
 * ```
 */
export const usePolls = (dataService: DataService | null) => {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPolls = useCallback(async () => {
    if (!dataService?.isReady()) {
      setError('Waiting for Waku network...');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load historical polls
      const historicalPolls = await dataService.loadHistoricalPolls();
      setPolls(historicalPolls.sort((a, b) => b.timestamp - a.timestamp));

      // Subscribe to new polls
      await dataService.subscribeToPolls(
        (newPoll) => {
          setPolls((prev) => {
            if (prev.some((p) => p.id === newPoll.id)) {
              return prev;
            }
            return [newPoll, ...prev].sort((a, b) => b.timestamp - a.timestamp);
          });
        },
        (err) => {
          console.error('Poll subscription error:', err);
          setError('Failed to subscribe to polls');
        }
      );

      setLoading(false);
    } catch (err) {
      console.error('Failed to load polls:', err);

      // Separate Store protocol errors from critical errors
      const errorMessage = err instanceof Error ? err.message : 'Failed to load polls';
      if (errorMessage.includes('No peers available to query')) {
        console.warn('⚠️ Store protocol not available - historical data unavailable, but new polls will work');
        setError(null); // Don't show critical error
        setPolls([]); // Start with empty polls array
      } else {
        // This is a real error that should be shown
        setError(errorMessage);
      }
      setLoading(false);
    }
  }, [dataService]);

  useEffect(() => {
    if (dataService) {
      loadPolls();
    }

    return () => {
      // Don't cleanup dataService here - it's managed by useWaku hook
      // Cleanup in hooks causes issues with React StrictMode
    };
  }, [dataService, loadPolls]);

  const createPoll = useCallback(async (pollData: IPollData) => {
    if (!dataService?.isReady()) {
      throw new Error('Waku network not ready');
    }

    return await dataService.publishPoll(pollData);
  }, [dataService]);

  const refreshPolls = useCallback(() => {
    loadPolls();
  }, [loadPolls]);

  return {
    polls,
    loading,
    error,
    createPoll,
    refreshPolls
  };
};

export default usePolls;