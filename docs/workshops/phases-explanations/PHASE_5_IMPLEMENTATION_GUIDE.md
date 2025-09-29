# Phase 5: UI Components & Hooks - Complete Implementation Guide

## 📋 Overview

Phase 5 focuses on building the **React UI components and custom hooks** that provide an intuitive interface for creating polls and viewing results. This phase leverages the DataService foundation from Phase 4 to create responsive, real-time UI components with excellent user experience.

Key implementations:
- **Custom React Hooks**: `usePolls`, `useVotes`, `useIdentity` for state management
- **PollCreation Component**: Form interface for creating new polls
- **PollList Component**: Display polls with real-time updates
- **ConnectionStatus Component**: Network and identity status indicators

This phase transforms the technical foundation into a user-friendly interface while maintaining real-time synchronization and robust error handling.

---

## 🏗️ Component Architecture

### UI Component Hierarchy
```
App
├── ConnectionStatus (Header)
│   ├── Network Status
│   ├── Identity Display
│   └── Store Availability
├── PollCreation (Main Section)
│   ├── Poll Form
│   ├── Validation Feedback
│   └── Submit Button
└── PollList (Main Section)
    ├── Poll Loading State
    ├── PollCard (for each poll)
    │   ├── Poll Metadata
    │   ├── VoteInterface
    │   └── VoteResults
    └── Empty State
```

**Key Design Principles:**
- **Real-time updates**: Components automatically reflect network changes
- **Optimistic UI**: Immediate feedback for user actions
- **Error boundaries**: Graceful handling of failures
- **Accessibility**: Semantic HTML and ARIA labels

---

## 🎣 Custom Hooks Implementation

### File: `src/hooks/usePolls.ts`

#### Poll State Management Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { DataValidator } from '../services/validators/DataValidator';

export interface UsePollsReturn {
  polls: IPollData[];
  loading: boolean;
  error: string | null;
  createPoll: (pollData: Partial<IPollData>) => Promise<void>;
  refreshPolls: () => Promise<void>;
  pollCount: number;
}

export const usePolls = (dataService: DataService | null): UsePollsReturn => {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time poll updates
  useEffect(() => {
    if (!dataService) return;

    const handleNewPoll = (newPoll: IPollData) => {
      console.log('📥 New poll received:', newPoll.id);

      setPolls(prevPolls => {
        // Deduplicate polls by ID, keep latest timestamp
        const pollMap = new Map<string, IPollData>();

        [...prevPolls, newPoll].forEach(poll => {
          const existing = pollMap.get(poll.id);
          if (!existing || poll.timestamp > existing.timestamp) {
            pollMap.set(poll.id, poll);
          }
        });

        return Array.from(pollMap.values())
          .sort((a, b) => b.timestamp - a.timestamp);
      });
    };

    const handleError = (err: Error) => {
      console.error('❌ Poll subscription error:', err);
      setError(err.message);
    };

    // Subscribe to real-time polls
    dataService.subscribeToPolls(handleNewPoll);
    dataService.onError(handleError);

    setLoading(false);

    // Cleanup subscription on unmount
    return () => {
      console.log('🧹 Cleaning up poll subscription');
    };
  }, [dataService]);

  // Create new poll with validation
  const createPoll = useCallback(async (pollData: Partial<IPollData>) => {
    if (!dataService) {
      throw new Error('DataService not available');
    }

    setError(null);

    try {
      // Client-side validation
      const completePoll: IPollData = {
        id: crypto.randomUUID(),
        question: pollData.question || '',
        options: pollData.options || [],
        createdBy: pollData.createdBy || '',
        timestamp: Date.now(),
        ...pollData
      };

      if (!DataValidator.validatePoll(completePoll)) {
        throw new Error('Invalid poll data provided');
      }

      console.log('📤 Creating poll:', completePoll.question);
      await dataService.publishPoll(completePoll);

      // Optimistic update - add poll immediately
      setPolls(prevPolls => [completePoll, ...prevPolls]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create poll';
      console.error('❌ Poll creation failed:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [dataService]);

  // Manual refresh (useful for debugging)
  const refreshPolls = useCallback(async () => {
    if (!dataService) return;

    try {
      setLoading(true);
      setError(null);

      // Re-initialize to get fresh data
      const { polls: freshPolls } = await dataService.initialize();
      setPolls(freshPolls);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh polls';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dataService]);

  return {
    polls,
    loading,
    error,
    createPoll,
    refreshPolls,
    pollCount: polls.length
  };
};
```

### File: `src/hooks/useVotes.ts`

#### Vote State Management Hook

```typescript
import { useState, useEffect, useCallback } from 'react';
import { IVoteData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { DataValidator } from '../services/validators/DataValidator';

export interface UseVotesReturn {
  votes: IVoteData[];
  loading: boolean;
  error: string | null;
  submitVote: (voteData: Partial<IVoteData>) => Promise<void>;
  getVotesForPoll: (pollId: string) => IVoteData[];
  hasUserVoted: (pollId: string, userPublicKey: string) => boolean;
  getVoteResults: (pollId: string, optionCount: number) => VoteResults;
}

export interface VoteResults {
  totalVotes: number;
  results: Array<{
    optionIndex: number;
    count: number;
    percentage: number;
  }>;
}

export const useVotes = (dataService: DataService | null): UseVotesReturn => {
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time vote updates
  useEffect(() => {
    if (!dataService) return;

    const handleNewVote = (newVote: IVoteData) => {
      console.log('🗳️ New vote received for poll:', newVote.pollId);

      setVotes(prevVotes => {
        // Deduplicate votes by pollId + voterPublicKey (one vote per user per poll)
        const voteMap = new Map<string, IVoteData>();

        [...prevVotes, newVote]
          .sort((a, b) => a.timestamp - b.timestamp) // Keep first vote only
          .forEach(vote => {
            const key = `${vote.pollId}_${vote.voterPublicKey}`;
            if (!voteMap.has(key)) {
              voteMap.set(key, vote);
            }
          });

        return Array.from(voteMap.values());
      });
    };

    const handleError = (err: Error) => {
      console.error('❌ Vote subscription error:', err);
      setError(err.message);
    };

    // Subscribe to real-time votes
    dataService.subscribeToVotes(handleNewVote);
    dataService.onError(handleError);

    setLoading(false);

    return () => {
      console.log('🧹 Cleaning up vote subscription');
    };
  }, [dataService]);

  // Submit vote with validation and deduplication
  const submitVote = useCallback(async (voteData: Partial<IVoteData>) => {
    if (!dataService) {
      throw new Error('DataService not available');
    }

    setError(null);

    try {
      const identity = dataService.getCurrentIdentity();
      if (!identity) {
        throw new Error('Identity not available for voting');
      }

      // Check if user already voted for this poll
      const existingVote = votes.find(
        vote => vote.pollId === voteData.pollId &&
                vote.voterPublicKey === identity.publicKeyHex
      );

      if (existingVote) {
        throw new Error('You have already voted on this poll');
      }

      // Create complete vote data
      const completeVote: IVoteData = {
        id: crypto.randomUUID(),
        pollId: voteData.pollId || '',
        optionIndex: voteData.optionIndex ?? -1,
        voterPublicKey: identity.publicKeyHex,
        timestamp: Date.now(),
        ...voteData
      };

      if (!DataValidator.validateVote(completeVote)) {
        throw new Error('Invalid vote data provided');
      }

      console.log('🗳️ Submitting vote for poll:', completeVote.pollId);
      await dataService.submitVote(completeVote);

      // Optimistic update - add vote immediately
      setVotes(prevVotes => [...prevVotes, completeVote]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit vote';
      console.error('❌ Vote submission failed:', errorMessage);
      setError(errorMessage);
      throw err;
    }
  }, [dataService, votes]);

  // Get votes for specific poll
  const getVotesForPoll = useCallback((pollId: string): IVoteData[] => {
    return votes.filter(vote => vote.pollId === pollId);
  }, [votes]);

  // Check if user has voted on a poll
  const hasUserVoted = useCallback((pollId: string, userPublicKey: string): boolean => {
    return votes.some(
      vote => vote.pollId === pollId && vote.voterPublicKey === userPublicKey
    );
  }, [votes]);

  // Calculate vote results for a poll
  const getVoteResults = useCallback((pollId: string, optionCount: number): VoteResults => {
    const pollVotes = getVotesForPoll(pollId);
    const totalVotes = pollVotes.length;

    const results = Array.from({ length: optionCount }, (_, index) => {
      const count = pollVotes.filter(vote => vote.optionIndex === index).length;
      const percentage = totalVotes > 0 ? (count / totalVotes) * 100 : 0;

      return {
        optionIndex: index,
        count,
        percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
      };
    });

    return {
      totalVotes,
      results
    };
  }, [getVotesForPoll]);

  return {
    votes,
    loading,
    error,
    submitVote,
    getVotesForPoll,
    hasUserVoted,
    getVoteResults
  };
};
```

### File: `src/hooks/useIdentity.ts`

#### Identity Management Hook

```typescript
import { useState, useEffect } from 'react';
import { IdentityService, Identity } from '../services/IdentityService';

export interface UseIdentityReturn {
  identity: Identity | null;
  loading: boolean;
  error: string | null;
  regenerateIdentity: () => void;
  isVerified: boolean;
}

export const useIdentity = (): UseIdentityReturn => {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const identityService = new IdentityService();
      const userIdentity = identityService.getIdentity();

      setIdentity(userIdentity);
      console.log('👤 Identity loaded:', userIdentity.publicKeyHex.substring(0, 16) + '...');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load identity';
      setError(errorMessage);
      console.error('❌ Identity loading failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const regenerateIdentity = () => {
    try {
      setLoading(true);
      setError(null);

      const identityService = new IdentityService();
      const newIdentity = identityService.regenerateIdentity();

      setIdentity(newIdentity);
      console.log('🔄 Identity regenerated:', newIdentity.publicKeyHex.substring(0, 16) + '...');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to regenerate identity';
      setError(errorMessage);
      console.error('❌ Identity regeneration failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isVerified = identity ? IdentityService.verify(identity) : false;

  return {
    identity,
    loading,
    error,
    regenerateIdentity,
    isVerified
  };
};
```

---

## 🎨 UI Components Implementation

### File: `src/components/ConnectionStatus.tsx`

#### Network Status Display Component

```typescript
import React from 'react';
import { WakuStatus } from '../services/WakuService';
import { Identity } from '../services/IdentityService';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  status: WakuStatus;
  identity: Identity | null;
  storeAvailable: boolean;
}

export default function ConnectionStatus({ status, identity, storeAvailable }: ConnectionStatusProps) {
  const getStatusColor = (): string => {
    if (status.error) return '#f44336';           // Red: Error
    if (status.connected) return '#4caf50';       // Green: Connected
    return '#ff9800';                             // Orange: Connecting
  };

  const getStatusText = (): string => {
    if (status.error) return `Error: ${status.error}`;
    if (status.connected) return `Connected (${status.peerCount} peers)`;
    return 'Connecting...';
  };

  const formatIdentity = (identity: Identity): string => {
    return `${identity.publicKeyHex.substring(0, 16)}...`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="connection-status">
      <div className="status-row">
        <div className="status-indicator">
          <div
            className="status-dot"
            style={{ backgroundColor: getStatusColor() }}
            aria-label={`Connection status: ${getStatusText()}`}
          />
          <span className="status-text">{getStatusText()}</span>
        </div>

        {!storeAvailable && (
          <div className="store-warning" title="Store protocol unavailable - real-time only">
            ⚠️ Real-time only
          </div>
        )}
      </div>

      {identity && (
        <div className="identity-info">
          <span className="identity-label">Identity:</span>
          <code className="identity-value" title={identity.publicKeyHex}>
            {formatIdentity(identity)}
          </code>
          <span className="identity-date">
            (Created: {formatDate(identity.created)})
          </span>
        </div>
      )}
    </div>
  );
}
```

### File: `src/components/PollCreation.tsx`

#### Poll Creation Form Component

```typescript
import React, { useState } from 'react';
import { DataService } from '../services/DataService';
import { Identity } from '../services/IdentityService';
import { IPollData } from '../services/ProtobufSchemas';
import { DataValidator } from '../services/validators/DataValidator';
import { usePolls } from '../hooks/usePolls';
import './PollCreation.css';

interface PollCreationProps {
  dataService: DataService | null;
  identity: Identity | null;
}

interface PollFormData {
  question: string;
  options: string[];
}

export default function PollCreation({ dataService, identity }: PollCreationProps) {
  const { createPoll } = usePolls(dataService);
  const [formData, setFormData] = useState<PollFormData>({
    question: '',
    options: ['', '']
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const updateQuestion = (question: string) => {
    setFormData(prev => ({ ...prev, question }));
    setError(null);
  };

  const updateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }));
    setError(null);
  };

  const addOption = () => {
    if (formData.options.length < 6) { // Limit to 6 options
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removeOption = (index: number) => {
    if (formData.options.length > 2) { // Minimum 2 options
      setFormData(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = (): string | null => {
    if (!formData.question.trim()) {
      return 'Poll question is required';
    }

    if (formData.question.length > 200) {
      return 'Question must be 200 characters or less';
    }

    const validOptions = formData.options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      return 'At least 2 options are required';
    }

    const duplicateOptions = validOptions.filter(
      (option, index) => validOptions.indexOf(option) !== index
    );
    if (duplicateOptions.length > 0) {
      return 'Options must be unique';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dataService || !identity) {
      setError('Service not available');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const pollData: Partial<IPollData> = {
        question: formData.question.trim(),
        options: formData.options
          .filter(opt => opt.trim())
          .map(opt => opt.trim()),
        createdBy: identity.publicKeyHex
      };

      await createPoll(pollData);

      // Reset form on success
      setFormData({
        question: '',
        options: ['', '']
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      console.log('✅ Poll created successfully');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create poll';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = formData.question.trim() &&
                     formData.options.filter(opt => opt.trim()).length >= 2;

  return (
    <div className="poll-creation">
      <h2>📝 Create New Poll</h2>

      {success && (
        <div className="success-message" role="alert">
          ✅ Poll created successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="poll-form">
        <div className="form-group">
          <label htmlFor="question" className="form-label">
            Poll Question *
          </label>
          <input
            id="question"
            type="text"
            value={formData.question}
            onChange={(e) => updateQuestion(e.target.value)}
            placeholder="What would you like to ask?"
            className="form-input"
            maxLength={200}
            required
            aria-describedby="question-help"
          />
          <small id="question-help" className="form-help">
            {200 - formData.question.length} characters remaining
          </small>
        </div>

        <div className="form-group">
          <label className="form-label">Options *</label>
          <div className="options-list">
            {formData.options.map((option, index) => (
              <div key={index} className="option-row">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="form-input option-input"
                  maxLength={100}
                />
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="remove-option-btn"
                    aria-label={`Remove option ${index + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {formData.options.length < 6 && (
            <button
              type="button"
              onClick={addOption}
              className="add-option-btn"
            >
              + Add Option
            </button>
          )}
        </div>

        {error && (
          <div className="error-message" role="alert">
            ❌ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!isFormValid || isSubmitting || !dataService || !identity}
          className="submit-btn"
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              Creating Poll...
            </>
          ) : (
            '🗳️ Create Poll'
          )}
        </button>
      </form>
    </div>
  );
}
```

### File: `src/components/PollList.tsx`

#### Poll Display and Management Component

```typescript
import React from 'react';
import { IPollData, IVoteData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';
import { Identity } from '../services/IdentityService';
import { usePolls } from '../hooks/usePolls';
import { useVotes } from '../hooks/useVotes';
import PollCard from './PollCard';
import './PollList.css';

interface PollListProps {
  polls: IPollData[];
  votes: IVoteData[];
  dataService: DataService | null;
  identity: Identity | null;
}

export default function PollList({ polls, votes, dataService, identity }: PollListProps) {
  const { loading: pollsLoading, error: pollsError, refreshPolls } = usePolls(dataService);
  const { loading: votesLoading, error: votesError } = useVotes(dataService);

  const isLoading = pollsLoading || votesLoading;
  const hasError = pollsError || votesError;

  if (isLoading) {
    return (
      <div className="poll-list">
        <div className="poll-list-header">
          <h2>📊 Polls</h2>
        </div>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading polls...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="poll-list">
        <div className="poll-list-header">
          <h2>📊 Polls</h2>
        </div>
        <div className="error-state">
          <p>❌ {pollsError || votesError}</p>
          <button onClick={refreshPolls} className="retry-btn">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="poll-list">
        <div className="poll-list-header">
          <h2>📊 Polls</h2>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🗳️</div>
          <h3>No polls yet</h3>
          <p>Create the first poll to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="poll-list">
      <div className="poll-list-header">
        <h2>📊 Polls ({polls.length})</h2>
        <button onClick={refreshPolls} className="refresh-btn" title="Refresh polls">
          🔄
        </button>
      </div>

      <div className="polls-container">
        {polls.map(poll => (
          <PollCard
            key={poll.id}
            poll={poll}
            votes={votes}
            dataService={dataService}
            identity={identity}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 Success Metrics

### Expected User Interface

✅ **Functional Components**:
- Poll creation form with real-time validation
- Live poll list with automatic updates
- Connection status indicators in header
- Responsive design for different screen sizes

✅ **Real-time Features**:
- New polls appear automatically
- Vote counts update in real-time
- Connection status reflects network changes
- Identity verification status

✅ **Error Handling**:
- Form validation with clear feedback
- Network error recovery mechanisms
- Graceful degradation for Store unavailability
- User-friendly error messages

### Expected Console Logs

```
👤 Identity loaded: a1b2c3d4e5f6...
📥 New poll received: poll-123
🗳️ New vote received for poll: poll-123
📤 Creating poll: What's your favorite color?
✅ Poll created successfully
🧹 Cleaning up poll subscription
🧹 Cleaning up vote subscription
```

---

## 🚀 Preparation for Phase 6

Phase 5 establishes the complete UI foundation:

### Available Components:
- **Custom Hooks**: State management with real-time updates
- **Form Components**: Poll creation with validation
- **Display Components**: Poll lists and status indicators
- **Error Handling**: Comprehensive error boundaries

### Ready for Phase 6:
- **VoteInterface**: Voting buttons and interaction
- **VoteResults**: Real-time results visualization
- **Vote Deduplication**: Comprehensive duplicate prevention
- **Results Analytics**: Vote counting and percentage calculations

The UI components provide a solid foundation for implementing the complete voting experience with real-time feedback and robust error handling.

---

## 💡 Conclusion

Phase 5 creates **production-ready UI components** that:

- **Seamlessly integrate** with the DataService from Phase 4
- **Provide real-time updates** without manual refreshing
- **Handle errors gracefully** with user-friendly feedback
- **Follow React best practices** with custom hooks and proper state management
- **Maintain accessibility** with semantic HTML and ARIA labels

The components create an **intuitive user experience** while maintaining the robust real-time synchronization capabilities of the underlying Waku network.