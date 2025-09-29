# Voting Logic and Implementation

## Overview

DecenVote implements a robust voting system that ensures **one vote per identity per poll** while maintaining real-time results and data integrity. The voting logic is built on top of the modular service architecture and integrates seamlessly with ReliableChannel for real-time updates.

## Core Voting Principles

### 1. One Vote Per Identity
- Each cryptographic identity can vote only once per poll
- Duplicate votes are rejected at both the service and UI level
- Vote replacement is not allowed (first vote wins)
- Deduplication key: `pollId + voterPublicKey`

### 2. Data Integrity
- All votes are validated using the centralized DataValidator
- Type safety enforced through TypeScript interfaces
- Invalid votes are rejected before processing
- Graceful error handling and user feedback

### 3. Real-time Synchronization
- Vote counts update immediately when new votes arrive via ReliableChannel
- Results are calculated from validated, deduplicated votes
- UI updates reflect live vote tallies automatically

## Vote Data Structure

### Vote Interface Definition

```typescript
// src/services/ProtobufSchemas.ts
export interface IVoteData {
  pollId: string;          // Reference to the poll
  optionIndex: number;     // Selected option (0-based index)
  voterPublicKey: string;  // Voter's public key (for deduplication)
  signature: string;       // Cryptographic signature (TODO: implement)
  timestamp: number;       // Vote timestamp
}

// Example vote
const vote: IVoteData = {
  pollId: "poll_1640995200000_abc123",
  optionIndex: 1,                    // Voting for option at index 1
  voterPublicKey: "04a1b2c3d4...",   // Voter's public key
  signature: "",                     // Placeholder for future implementation
  timestamp: 1640995200000           // Unix timestamp
};
```

### Vote Validation

```typescript
// src/services/validators/DataValidator.ts (excerpt)
export class DataValidator {
  static validateVote(vote: IVoteData): boolean {
    // Check required fields
    if (!vote?.pollId || !vote?.voterPublicKey) {
      return false;
    }

    // Validate option index
    if (typeof vote.optionIndex !== 'number' || vote.optionIndex < 0) {
      return false;
    }

    // Validate timestamp
    if (typeof vote.timestamp !== 'number' || vote.timestamp <= 0) {
      return false;
    }

    // Timestamp should not be too far in the future (clock skew)
    const maxClockSkew = 5 * 60 * 1000; // 5 minutes
    if (vote.timestamp > Date.now() + maxClockSkew) {
      return false;
    }

    return true;
  }

  // Validate vote against specific poll
  static validateVoteForPoll(vote: IVoteData, poll: IPollData): boolean {
    if (!this.validateVote(vote)) {
      return false;
    }

    // Check poll ID matches
    if (vote.pollId !== poll.id) {
      return false;
    }

    // Check option index is valid for this poll
    if (vote.optionIndex >= poll.options.length) {
      return false;
    }

    return true;
  }
}
```

## Vote Submission Flow

### Service Layer Vote Handling

```typescript
// src/services/DataService.ts (excerpt)
export class DataService {
  // ... other methods

  async publishVote(vote: IVoteData): Promise<void> {
    // Validate vote data
    if (!DataValidator.validateVote(vote)) {
      throw new Error('Invalid vote data');
    }

    // Check for duplicate vote (optional client-side check)
    const existingVotes = await this.loadHistoricalVotes();
    const hasDuplicateVote = existingVotes.some(existingVote =>
      existingVote.pollId === vote.pollId &&
      existingVote.voterPublicKey === vote.voterPublicKey
    );

    if (hasDuplicateVote) {
      throw new Error('You have already voted on this poll');
    }

    // Publish via ReliableChannelService
    return this.reliableChannelService.publishVote(vote);
  }

  // Additional method to check if user has voted
  async hasUserVoted(pollId: string): Promise<boolean> {
    const identity = this.getOrCreateIdentity();
    const votes = await this.loadHistoricalVotes();

    return votes.some(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === identity.publicKeyHex
    );
  }
}
```

### React Hook Implementation

```typescript
// src/hooks/useVotes.ts (enhanced version)
import { useState, useEffect } from 'react';
import { IVoteData, IPollData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { DataValidator } from '../services/validators/DataValidator';

export const useVotes = (dataService: DataService | null) => {
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataService) return;

    const initializeVotes = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load historical votes
        const historicalVotes = await dataService.loadHistoricalVotes();
        console.log(`Loaded ${historicalVotes.length} historical votes`);

        // Set initial state with deduplication
        setVotes(deduplicateVotes(historicalVotes));

        // Subscribe to real-time vote updates
        await dataService.subscribeToVotes(
          (newVote: IVoteData) => {
            console.log('New vote received for poll:', newVote.pollId);
            setVotes(prevVotes => {
              // Validate incoming vote
              if (!DataValidator.validateVote(newVote)) {
                console.warn('Invalid vote received, ignoring');
                return prevVotes;
              }

              // Check for duplicate votes
              const isDuplicate = prevVotes.some(vote =>
                vote.pollId === newVote.pollId &&
                vote.voterPublicKey === newVote.voterPublicKey
              );

              if (isDuplicate) {
                console.log('Duplicate vote detected, ignoring');
                return prevVotes;
              }

              return [...prevVotes, newVote];
            });
          },
          (error: Error) => {
            console.error('Vote subscription error:', error);
            setError(`Real-time updates failed: ${error.message}`);
          }
        );

        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize votes:', err);
        setError(err instanceof Error ? err.message : 'Failed to load votes');
        setLoading(false);
      }
    };

    initializeVotes();
  }, [dataService]);

  // Cast a vote with comprehensive validation
  const castVote = async (pollId: string, optionIndex: number, poll: IPollData): Promise<void> => {
    if (!dataService) throw new Error('DataService not available');

    // Validate inputs
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      throw new Error(`Invalid option index: ${optionIndex}`);
    }

    // Check if user already voted
    if (hasVoted(pollId)) {
      throw new Error('You have already voted on this poll');
    }

    const identity = dataService.getOrCreateIdentity();
    const vote: IVoteData = {
      pollId,
      optionIndex,
      voterPublicKey: identity.publicKeyHex,
      signature: '', // TODO: Implement proper signing
      timestamp: Date.now()
    };

    // Validate the complete vote
    if (!DataValidator.validateVoteForPoll(vote, poll)) {
      throw new Error('Vote validation failed');
    }

    // Publish vote through DataService
    await dataService.publishVote(vote);
  };

  // Check if user has voted on a specific poll
  const hasVoted = (pollId: string): boolean => {
    if (!dataService) return false;

    const identity = dataService.getCurrentIdentity();
    if (!identity) return false;

    return votes.some(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === identity.publicKeyHex
    );
  };

  // Get votes for a specific poll
  const getVotesForPoll = (pollId: string): IVoteData[] => {
    return votes.filter(vote => vote.pollId === pollId);
  };

  // Get user's vote for a specific poll
  const getUserVote = (pollId: string): IVoteData | undefined => {
    if (!dataService) return undefined;

    const identity = dataService.getCurrentIdentity();
    if (!identity) return undefined;

    return votes.find(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === identity.publicKeyHex
    );
  };

  return {
    votes,
    loading,
    error,
    castVote,
    hasVoted,
    getVotesForPoll,
    getUserVote
  };
};

// Utility function to remove duplicate votes
const deduplicateVotes = (votes: IVoteData[]): IVoteData[] => {
  const voteMap = new Map<string, IVoteData>();

  // Sort by timestamp to keep earliest vote
  votes
    .sort((a, b) => a.timestamp - b.timestamp)
    .forEach(vote => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;
      if (!voteMap.has(key)) {
        voteMap.set(key, vote);
      }
    });

  return Array.from(voteMap.values());
};
```

## Vote Results Calculation

### Results Processing Utilities

```typescript
// src/utils/voteUtils.ts
import { IPollData, IVoteData } from '../services/ProtobufSchemas';

export interface VoteResult {
  option: string;
  count: number;
  percentage: number;
  isWinner: boolean;
}

export interface PollResults {
  poll: IPollData;
  results: VoteResult[];
  totalVotes: number;
  uniqueVoters: number;
  lastUpdated: number;
}

// Calculate comprehensive results for a poll
export const calculatePollResults = (
  poll: IPollData,
  votes: IVoteData[]
): PollResults => {
  // Filter votes for this poll
  const pollVotes = votes.filter(vote => vote.pollId === poll.id);

  // Deduplicate votes (one vote per voter)
  const uniqueVotes = deduplicateVotesByVoter(pollVotes);

  // Filter out invalid votes (option index out of range)
  const validVotes = uniqueVotes.filter(vote =>
    vote.optionIndex >= 0 && vote.optionIndex < poll.options.length
  );

  const totalVotes = validVotes.length;

  // Count votes per option
  const optionCounts = new Array(poll.options.length).fill(0);
  validVotes.forEach(vote => {
    optionCounts[vote.optionIndex]++;
  });

  // Find max count for winner determination
  const maxCount = Math.max(...optionCounts, 0);

  // Calculate results with percentages
  const results: VoteResult[] = poll.options.map((option, index) => {
    const count = optionCounts[index];
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const isWinner = count > 0 && count === maxCount;

    return {
      option,
      count,
      percentage,
      isWinner
    };
  });

  return {
    poll,
    results,
    totalVotes,
    uniqueVoters: validVotes.length,
    lastUpdated: Date.now()
  };
};

// Remove duplicate votes by voter (keep earliest)
const deduplicateVotesByVoter = (votes: IVoteData[]): IVoteData[] => {
  const voterMap = new Map<string, IVoteData>();

  votes
    .sort((a, b) => a.timestamp - b.timestamp) // Keep earliest vote
    .forEach(vote => {
      if (!voterMap.has(vote.voterPublicKey)) {
        voterMap.set(vote.voterPublicKey, vote);
      }
    });

  return Array.from(voterMap.values());
};

// Calculate aggregate statistics
export const calculateVotingStatistics = (
  polls: IPollData[],
  votes: IVoteData[]
): VotingStatistics => {
  const uniqueVoters = new Set(votes.map(vote => vote.voterPublicKey)).size;
  const totalVotes = votes.length;

  const pollsWithVotes = polls.map(poll => {
    const pollVotes = votes.filter(vote => vote.pollId === poll.id);
    return {
      poll,
      voteCount: pollVotes.length,
      uniqueVoters: new Set(pollVotes.map(vote => vote.voterPublicKey)).size
    };
  });

  const averageVotesPerPoll = polls.length > 0 ? totalVotes / polls.length : 0;
  const mostVotedPoll = pollsWithVotes.reduce((max, current) =>
    current.voteCount > max.voteCount ? current : max,
    pollsWithVotes[0]
  );

  return {
    totalPolls: polls.length,
    totalVotes,
    uniqueVoters,
    averageVotesPerPoll: Math.round(averageVotesPerPoll * 100) / 100,
    mostVotedPoll: mostVotedPoll?.poll || null,
    pollsWithVotes
  };
};

interface VotingStatistics {
  totalPolls: number;
  totalVotes: number;
  uniqueVoters: number;
  averageVotesPerPoll: number;
  mostVotedPoll: IPollData | null;
  pollsWithVotes: Array<{
    poll: IPollData;
    voteCount: number;
    uniqueVoters: number;
  }>;
}
```

## Component Integration

### VoteInterface Component

```typescript
// src/components/VoteInterface.tsx
import React, { useState } from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { useVotes } from '../hooks/useVotes';
import { DataService } from '../services/DataService';

interface VoteInterfaceProps {
  poll: IPollData;
  dataService: DataService | null;
  disabled?: boolean;
}

export const VoteInterface: React.FC<VoteInterfaceProps> = ({
  poll,
  dataService,
  disabled = false
}) => {
  const { castVote, hasVoted, getUserVote } = useVotes(dataService);
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userHasVoted = hasVoted(poll.id);
  const userVote = getUserVote(poll.id);

  const handleVote = async (optionIndex: number) => {
    if (!dataService || disabled || isVoting || userHasVoted) return;

    setError(null);
    setIsVoting(true);

    try {
      await castVote(poll.id, optionIndex, poll);
      console.log(`Vote cast for poll ${poll.id}, option: ${poll.options[optionIndex]}`);
    } catch (err) {
      console.error('Failed to cast vote:', err);
      setError(err instanceof Error ? err.message : 'Failed to cast vote');
    } finally {
      setIsVoting(false);
    }
  };

  if (userHasVoted && userVote) {
    return (
      <div className="vote-complete">
        <div className="vote-confirmation">
          ✅ You voted for: <strong>{poll.options[userVote.optionIndex]}</strong>
        </div>
        <div className="vote-timestamp">
          Voted on {new Date(userVote.timestamp).toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div className="vote-interface">
      {error && (
        <div className="vote-error">
          ⚠️ {error}
        </div>
      )}

      <div className="vote-options">
        {poll.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleVote(index)}
            disabled={disabled || isVoting || userHasVoted}
            className="vote-option"
          >
            {option}
            {isVoting && (
              <span className="voting-indicator">⏳</span>
            )}
          </button>
        ))}
      </div>

      {isVoting && (
        <div className="voting-status">
          🗳️ Casting your vote...
        </div>
      )}
    </div>
  );
};

export default VoteInterface;
```

### VoteResults Component

```typescript
// src/components/VoteResults.tsx
import React from 'react';
import { IPollData, IVoteData } from '../services/ProtobufSchemas';
import { calculatePollResults, VoteResult } from '../utils/voteUtils';

interface VoteResultsProps {
  poll: IPollData;
  votes: IVoteData[];
  showDetails?: boolean;
}

export const VoteResults: React.FC<VoteResultsProps> = ({
  poll,
  votes,
  showDetails = false
}) => {
  const results = calculatePollResults(poll, votes);

  if (results.totalVotes === 0) {
    return (
      <div className="vote-results empty">
        <div className="no-votes-message">
          📊 No votes yet. Be the first to vote!
        </div>
      </div>
    );
  }

  return (
    <div className="vote-results">
      <div className="results-header">
        <h4>Results</h4>
        <div className="vote-summary">
          {results.totalVotes} votes from {results.uniqueVoters} voters
        </div>
      </div>

      <div className="results-list">
        {results.results.map((result: VoteResult, index: number) => (
          <div
            key={index}
            className={`result-item ${result.isWinner ? 'winner' : ''}`}
          >
            <div className="result-header">
              <span className="option-text">
                {result.option}
                {result.isWinner && <span className="winner-badge">👑</span>}
              </span>
              <span className="vote-stats">
                {result.count} votes ({result.percentage}%)
              </span>
            </div>

            <div className="result-bar">
              <div
                className="result-fill"
                style={{
                  width: `${result.percentage}%`,
                  backgroundColor: result.isWinner ? '#28a745' : '#007bff'
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {showDetails && (
        <div className="results-details">
          <div className="result-detail-item">
            <span>Total Votes:</span>
            <span>{results.totalVotes}</span>
          </div>
          <div className="result-detail-item">
            <span>Unique Voters:</span>
            <span>{results.uniqueVoters}</span>
          </div>
          <div className="result-detail-item">
            <span>Last Updated:</span>
            <span>{new Date(results.lastUpdated).toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoteResults;
```

## Error Handling and Edge Cases

### Vote Conflict Resolution

```typescript
// src/utils/voteConflictResolver.ts
import { IVoteData } from '../services/ProtobufSchemas';

export interface VoteConflict {
  voterPublicKey: string;
  pollId: string;
  votes: IVoteData[];
  resolution: 'keep_earliest' | 'keep_latest' | 'manual_review';
}

export class VoteConflictResolver {
  // Detect and resolve vote conflicts
  static resolveConflicts(votes: IVoteData[]): {
    resolvedVotes: IVoteData[];
    conflicts: VoteConflict[];
  } {
    const conflicts: VoteConflict[] = [];
    const voterPollMap = new Map<string, IVoteData[]>();

    // Group votes by voter and poll
    votes.forEach(vote => {
      const key = `${vote.voterPublicKey}_${vote.pollId}`;
      if (!voterPollMap.has(key)) {
        voterPollMap.set(key, []);
      }
      voterPollMap.get(key)!.push(vote);
    });

    const resolvedVotes: IVoteData[] = [];

    // Process each voter-poll combination
    voterPollMap.forEach((voterVotes, key) => {
      if (voterVotes.length === 1) {
        // No conflict
        resolvedVotes.push(voterVotes[0]);
      } else {
        // Conflict detected
        const [voterPublicKey, pollId] = key.split('_');

        // Sort by timestamp and keep earliest (first vote wins)
        const sortedVotes = voterVotes.sort((a, b) => a.timestamp - b.timestamp);
        resolvedVotes.push(sortedVotes[0]);

        conflicts.push({
          voterPublicKey,
          pollId,
          votes: voterVotes,
          resolution: 'keep_earliest'
        });
      }
    });

    return { resolvedVotes, conflicts };
  }

  // Log conflicts for monitoring
  static logConflicts(conflicts: VoteConflict[]): void {
    if (conflicts.length > 0) {
      console.warn(`Detected ${conflicts.length} vote conflicts:`);
      conflicts.forEach(conflict => {
        console.warn(`Voter ${conflict.voterPublicKey.slice(0, 8)}... has ${conflict.votes.length} votes for poll ${conflict.pollId}`);
      });
    }
  }
}
```

### Network Error Handling

```typescript
// src/hooks/useVoteErrorHandler.ts
import { useState, useCallback } from 'react';

export const useVoteErrorHandler = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleVoteError = useCallback((pollId: string, error: Error) => {
    let userMessage: string;

    // Categorize errors for user-friendly messages
    if (error.message.includes('already voted')) {
      userMessage = 'You have already voted on this poll';
    } else if (error.message.includes('invalid option')) {
      userMessage = 'Invalid voting option selected';
    } else if (error.message.includes('network')) {
      userMessage = 'Network error. Please check your connection and try again';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Vote submission timed out. Please try again';
    } else {
      userMessage = 'Failed to submit vote. Please try again';
    }

    setErrors(prev => ({ ...prev, [pollId]: userMessage }));

    // Auto-clear error after 5 seconds
    setTimeout(() => {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[pollId];
        return newErrors;
      });
    }, 5000);
  }, []);

  const clearError = useCallback((pollId: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[pollId];
      return newErrors;
    });
  }, []);

  return {
    errors,
    handleVoteError,
    clearError
  };
};
```

## Best Practices

### 1. Data Integrity
- Always validate votes at multiple layers (service, hook, component)
- Use TypeScript interfaces to ensure type safety
- Implement comprehensive error handling with user-friendly messages

### 2. Deduplication Strategy
- Use consistent deduplication keys (`pollId + voterPublicKey`)
- Keep earliest vote when conflicts are detected
- Handle deduplication at the data processing level

### 3. Real-time Updates
- Subscribe to ReliableChannel for instant vote updates
- Update UI reactively when new votes arrive
- Maintain loading states during vote submission

### 4. User Experience
- Provide immediate feedback on vote submission
- Show clear voting status (voted/not voted)
- Display comprehensive results with visual indicators
- Handle offline scenarios gracefully

### 5. Performance Optimization
- Memoize vote calculations to prevent unnecessary re-renders
- Use efficient data structures for vote lookup
- Implement proper cleanup for subscriptions

This voting logic ensures data integrity, provides excellent user experience, and integrates seamlessly with the modular Waku service architecture while maintaining real-time synchronization across all peers.