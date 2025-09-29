import { useState, useEffect, useCallback } from 'react';
import { DataService, createVoteDataWithDefaults } from '../services/DataService';
import type { IVoteData } from '../services/ProtobufSchemas';

interface VoteResults {
  [pollId: string]: {
    [optionIndex: number]: number;
  };
}

/**
 * Custom hook for managing votes
 * Handles vote submission, deduplication, and vote results calculation
 *
 * @param {DataService | null} dataService - DataService instance
 * @param {string} userPublicKey - Current user's public key
 * @returns {Object} Votes state and actions
 * @returns {IVoteData[]} votes - Array of all votes
 * @returns {Function} submitVote - Function to submit a vote
 * @returns {Function} getUserVoteForPoll - Get user's vote for a specific poll
 * @returns {Function} getVoteResults - Get vote results for a poll
 * @returns {VoteResults} voteResults - Aggregated vote results by poll
 *
 * @example
 * ```tsx
 * const { submitVote, getUserVoteForPoll, getVoteResults } = useVotes(dataService, publicKey);
 *
 * const handleVote = async (pollId: string, optionIndex: number) => {
 *   await submitVote(pollId, optionIndex);
 * };
 * ```
 */
export const useVotes = (dataService: DataService | null, userPublicKey: string) => {
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [voteResults, setVoteResults] = useState<VoteResults>({});

  // Load and subscribe to votes
  useEffect(() => {
    if (!dataService?.isReady()) {
      return;
    }

    const loadVotes = async () => {
      try {
        // Load historical votes
        const historicalVotes = await dataService.loadHistoricalVotes();
        setVotes(historicalVotes);

        // Subscribe to new votes
        console.log('🗳️ Setting up vote subscription...');
        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            console.log('🗳️ Received new vote via subscription:', newVote.pollId, 'option:', newVote.optionIndex);
            setVotes((prev) => {
              // Deduplicate votes
              if (
                prev.some(
                  (v) =>
                    v.pollId === newVote.pollId &&
                    v.voterPublicKey === newVote.voterPublicKey
                )
              ) {
                console.log('🗳️ Duplicate vote ignored for poll:', newVote.pollId);
                return prev;
              }
              console.log('🗳️ Adding new vote to state for poll:', newVote.pollId);
              return [...prev, newVote];
            });
          },
          (err: Error) => {
            console.error('Vote subscription error:', err);
          }
        );
        console.log('🗳️ Vote subscription setup complete');
      } catch (err) {
        console.error('Failed to load votes:', err);

        // Handle Store protocol errors gracefully
        const errorMessage = err instanceof Error ? err.message : 'Failed to load votes';
        if (errorMessage.includes('No peers available to query')) {
          console.warn('⚠️ Store protocol not available - historical votes unavailable, but voting will work');
          // Don't throw error, just start with empty votes array
          setVotes([]);
        }
        // For other errors, continue silently but log them
      }
    };

    loadVotes();
  }, [dataService]);

  // Calculate vote results whenever votes change
  useEffect(() => {
    const results: VoteResults = {};

    // Group votes by poll
    const votesByPoll = new Map<string, IVoteData[]>();
    votes.forEach(vote => {
      const pollVotes = votesByPoll.get(vote.pollId) || [];
      pollVotes.push(vote);
      votesByPoll.set(vote.pollId, pollVotes);
    });

    // Calculate results for each poll
    votesByPoll.forEach((pollVotes, pollId) => {
      const deduplicatedVotes = new Map<string, IVoteData>();

      // Deduplicate by voter
      pollVotes.forEach((vote) => {
        const key = `${vote.pollId}_${vote.voterPublicKey}`;
        if (!deduplicatedVotes.has(key)) {
          deduplicatedVotes.set(key, vote);
        }
      });

      // Count votes per option
      const optionCounts: { [optionIndex: number]: number } = {};
      Array.from(deduplicatedVotes.values()).forEach((vote) => {
        optionCounts[vote.optionIndex] = (optionCounts[vote.optionIndex] || 0) + 1;
      });

      results[pollId] = optionCounts;
    });

    setVoteResults(results);
  }, [votes]);

  const submitVote = useCallback(async (pollId: string, optionIndex: number) => {
    if (!dataService?.isReady()) {
      throw new Error('Waku network not ready');
    }

    if (!userPublicKey) {
      throw new Error('User identity not available');
    }

    // Check if already voted
    const existingVote = votes.find(
      v => v.pollId === pollId && v.voterPublicKey === userPublicKey
    );

    if (existingVote) {
      console.warn('User has already voted on this poll');
      return;
    }

    const voteData = createVoteDataWithDefaults(
      pollId,
      optionIndex,
      userPublicKey,
      '' // Signature placeholder
    );

    console.log(`🗳️ Publishing vote for poll ${pollId}, option ${optionIndex}:`, voteData);
    await dataService.publishVote(voteData);
    console.log(`✅ Vote submitted for poll ${pollId}, option ${optionIndex}`);
  }, [dataService, userPublicKey, votes]);

  const getUserVoteForPoll = useCallback((pollId: string): number | null => {
    const userVote = votes.find(
      v => v.pollId === pollId && v.voterPublicKey === userPublicKey
    );
    return userVote ? userVote.optionIndex : null;
  }, [votes, userPublicKey]);

  const getVoteResults = useCallback((pollId: string) => {
    return voteResults[pollId] || {};
  }, [voteResults]);

  return {
    votes,
    voteResults,
    submitVote,
    getUserVoteForPoll,
    getVoteResults
  };
};

export default useVotes;