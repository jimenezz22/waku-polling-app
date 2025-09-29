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

    setLoading(true);
    setError(null);

    // Try to load historical polls (optional)
    try {
      console.log('📥 Attempting to load historical polls...');
      const historicalPolls = await dataService.loadHistoricalPolls();
      setPolls(historicalPolls.sort((a, b) => b.timestamp - a.timestamp));
      console.log(`✅ Loaded ${historicalPolls.length} historical polls`);
    } catch (err) {
      console.warn('⚠️ Failed to load historical polls (Store protocol unavailable):', err);
      setPolls([]); // Start with empty polls array
    }

    // Subscribe to new polls (ALWAYS do this, regardless of historical loading)
    try {
      console.log('🔄 Setting up poll subscription...');
      await dataService.subscribeToPolls(
        (newPoll) => {
          console.log('📥 Received new poll via subscription:', newPoll.id);
          setPolls((prev) => {
            if (prev.some((p) => p.id === newPoll.id)) {
              return prev; // Prevent duplicates
            }
            return [newPoll, ...prev].sort((a, b) => b.timestamp - a.timestamp);
          });
        },
        (err) => {
          console.error('Poll subscription error:', err);
          setError('Failed to subscribe to polls');
        }
      );
      console.log('✅ Poll subscription setup complete');
    } catch (err) {
      console.error('❌ Failed to setup poll subscription:', err);
      setError('Failed to subscribe to new polls');
    }

    setLoading(false);
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