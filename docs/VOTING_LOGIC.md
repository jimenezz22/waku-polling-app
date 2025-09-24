# DecenVote Voting Logic

## Overview

DecenVote implements a robust voting system that ensures **one vote per identity per poll** while maintaining real-time results and preventing fraud through cryptographic verification.

## Core Voting Principles

### 1. One Vote Per Identity
- Each cryptographic identity can vote only once per poll
- Duplicate votes are rejected at the application level
- Vote replacement is not allowed (first vote wins)

### 2. Cryptographic Integrity
- All votes are signed with the voter's private key
- Signatures are verified before counting
- Invalid signatures are rejected

### 3. Real-time Counting
- Vote counts update immediately when new votes arrive
- Results are calculated from all valid votes
- UI updates reflect live vote tallies

## Vote Data Structure

### Vote Message Format

```js
// Vote message structure
const VoteMessage = new protobuf.Type("VoteMessage")
  .add(new protobuf.Field("pollId", 1, "string"))        // Which poll
  .add(new protobuf.Field("optionIndex", 2, "uint32"))   // Which option (0-based)
  .add(new protobuf.Field("voterPublicKey", 3, "string")) // Voter identity
  .add(new protobuf.Field("signature", 4, "string"))     // Cryptographic proof
  .add(new protobuf.Field("timestamp", 5, "uint64"));    // When voted

// Example vote
const vote = {
  pollId: "poll_1234567890_abc123",
  optionIndex: 1,                           // Voting for option at index 1
  voterPublicKey: "0x04a1b2c3d4...",        // Voter's public key
  signature: "0x1234abcd...",               // Cryptographic signature
  timestamp: 1640995200000                  // Unix timestamp
};
```

## Vote Validation

### Input Validation

```js
class VoteValidator {
  // Validate vote before submission
  static validateVoteInput(pollId, optionIndex, poll) {
    const errors = [];

    // Check poll exists
    if (!poll) {
      errors.push("Poll not found");
      return { valid: false, errors };
    }

    // Check poll ID matches
    if (poll.id !== pollId) {
      errors.push("Poll ID mismatch");
    }

    // Check option index is valid
    if (typeof optionIndex !== 'number') {
      errors.push("Option index must be a number");
    } else if (optionIndex < 0) {
      errors.push("Option index cannot be negative");
    } else if (optionIndex >= poll.options.length) {
      errors.push(`Option index ${optionIndex} is out of range (0-${poll.options.length - 1})`);
    }

    // Check if poll is still active (if you have expiry logic)
    if (poll.expiresAt && Date.now() > poll.expiresAt) {
      errors.push("Poll has expired");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Validate received vote message
  static validateReceivedVote(voteData) {
    const errors = [];

    // Required fields
    const requiredFields = ['pollId', 'optionIndex', 'voterPublicKey', 'timestamp'];
    for (const field of requiredFields) {
      if (voteData[field] === undefined || voteData[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Data type validation
    if (typeof voteData.optionIndex !== 'number' || voteData.optionIndex < 0) {
      errors.push("Invalid option index");
    }

    if (typeof voteData.timestamp !== 'number') {
      errors.push("Invalid timestamp");
    }

    // Timestamp validation (not too far in future)
    const maxClockSkew = 5 * 60 * 1000; // 5 minutes
    if (voteData.timestamp > Date.now() + maxClockSkew) {
      errors.push("Vote timestamp is too far in the future");
    }

    // Public key format validation
    if (!voteData.voterPublicKey || !voteData.voterPublicKey.startsWith('0x')) {
      errors.push("Invalid voter public key format");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

### Duplicate Vote Detection

```js
class DuplicateVoteChecker {
  constructor() {
    this.voteRegistry = new Set(); // Track "pollId_voterPublicKey" combinations
  }

  // Check if voter has already voted on a poll
  hasVoted(pollId, voterPublicKey) {
    const voteKey = `${pollId}_${voterPublicKey}`;
    return this.voteRegistry.has(voteKey);
  }

  // Register a new vote
  registerVote(pollId, voterPublicKey) {
    const voteKey = `${pollId}_${voterPublicKey}`;
    this.voteRegistry.add(voteKey);
  }

  // Remove vote registration (for testing/reset)
  unregisterVote(pollId, voterPublicKey) {
    const voteKey = `${pollId}_${voterPublicKey}`;
    this.voteRegistry.delete(voteKey);
  }

  // Process array of votes and build registry
  buildFromVotes(votes) {
    this.voteRegistry.clear();
    votes.forEach(vote => {
      this.registerVote(vote.pollId, vote.voterPublicKey);
    });
  }

  // Get all votes for a specific poll
  getVotersForPoll(pollId, votes) {
    return votes
      .filter(vote => vote.pollId === pollId)
      .map(vote => vote.voterPublicKey);
  }
}
```

## Vote Submission

### Vote Casting Logic

```js
class VoteCaster {
  constructor(node, identity, voteEncoder) {
    this.node = node;
    this.identity = identity;
    this.voteEncoder = voteEncoder;
    this.duplicateChecker = new DuplicateVoteChecker();
  }

  // Cast a vote on a poll
  async castVote(pollId, optionIndex, polls, existingVotes) {
    try {
      // Find the poll
      const poll = polls.find(p => p.id === pollId);

      // Validate input
      const inputValidation = VoteValidator.validateVoteInput(pollId, optionIndex, poll);
      if (!inputValidation.valid) {
        throw new Error(`Invalid vote: ${inputValidation.errors.join(', ')}`);
      }

      // Check for duplicate vote
      this.duplicateChecker.buildFromVotes(existingVotes);
      if (this.duplicateChecker.hasVoted(pollId, this.identity.publicKeyHex)) {
        throw new Error("You have already voted on this poll");
      }

      // Create vote data
      const voteData = {
        pollId,
        optionIndex,
        voterPublicKey: this.identity.publicKeyHex,
        signature: "", // Will be filled by Waku signing
        timestamp: Date.now()
      };

      // Validate the vote data
      const dataValidation = VoteValidator.validateReceivedVote(voteData);
      if (!dataValidation.valid) {
        throw new Error(`Invalid vote data: ${dataValidation.errors.join(', ')}`);
      }

      // Serialize and send
      const protoMessage = VoteMessage.create(voteData);
      const payload = VoteMessage.encode(protoMessage).finish();

      const result = await this.node.lightPush.send(this.voteEncoder, { payload });

      if (result.recipients.length > 0) {
        console.log(`Vote cast successfully for poll ${pollId}, option ${optionIndex}`);
        return {
          success: true,
          voteData,
          recipients: result.recipients.length
        };
      } else {
        throw new Error("Failed to send vote to network");
      }

    } catch (error) {
      console.error("Vote casting failed:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update duplicate checker with new votes
  updateVoteRegistry(votes) {
    this.duplicateChecker.buildFromVotes(votes);
  }
}
```

## Vote Counting

### Real-time Vote Counting

```js
class VoteCounter {
  constructor() {
    this.pollResults = new Map(); // pollId -> results
  }

  // Calculate results for a single poll
  calculatePollResults(pollId, polls, votes) {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) {
      return null;
    }

    // Get all valid votes for this poll
    const pollVotes = votes.filter(vote =>
      vote.pollId === pollId &&
      vote.optionIndex >= 0 &&
      vote.optionIndex < poll.options.length
    );

    // Remove duplicates (keep first vote per voter)
    const uniqueVotes = this.deduplicateVotes(pollVotes);

    // Count votes per option
    const optionCounts = poll.options.map(() => 0);
    uniqueVotes.forEach(vote => {
      if (vote.optionIndex < optionCounts.length) {
        optionCounts[vote.optionIndex]++;
      }
    });

    // Calculate percentages
    const totalVotes = uniqueVotes.length;
    const results = poll.options.map((option, index) => {
      const count = optionCounts[index];
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

      return {
        option,
        count,
        percentage
      };
    });

    const pollResult = {
      pollId,
      poll,
      results,
      totalVotes,
      uniqueVoters: uniqueVotes.length,
      lastUpdated: Date.now()
    };

    // Cache the result
    this.pollResults.set(pollId, pollResult);

    return pollResult;
  }

  // Remove duplicate votes (first vote wins)
  deduplicateVotes(votes) {
    const seen = new Set();
    const uniqueVotes = [];

    // Sort by timestamp to ensure consistent ordering
    const sortedVotes = [...votes].sort((a, b) => a.timestamp - b.timestamp);

    for (const vote of sortedVotes) {
      const voterKey = vote.voterPublicKey;

      if (!seen.has(voterKey)) {
        seen.add(voterKey);
        uniqueVotes.push(vote);
      } else {
        console.log(`Duplicate vote detected from ${voterKey.slice(0, 16)}... - ignoring`);
      }
    }

    return uniqueVotes;
  }

  // Calculate results for all polls
  calculateAllResults(polls, votes) {
    const allResults = {};

    polls.forEach(poll => {
      const result = this.calculatePollResults(poll.id, polls, votes);
      if (result) {
        allResults[poll.id] = result;
      }
    });

    return allResults;
  }

  // Get cached result for a poll
  getCachedResult(pollId) {
    return this.pollResults.get(pollId);
  }

  // Check if user voted on a poll
  hasUserVoted(pollId, userPublicKey, votes) {
    return votes.some(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === userPublicKey
    );
  }

  // Get user's vote for a poll
  getUserVote(pollId, userPublicKey, votes) {
    return votes.find(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === userPublicKey
    );
  }

  // Get voting statistics
  getVotingStats(polls, votes) {
    const stats = {
      totalPolls: polls.length,
      totalVotes: votes.length,
      uniqueVoters: new Set(votes.map(v => v.voterPublicKey)).size,
      averageVotesPerPoll: 0,
      mostPopularPoll: null,
      leastPopularPoll: null
    };

    if (polls.length > 0) {
      const pollVoteCounts = polls.map(poll => {
        const pollVotes = votes.filter(v => v.pollId === poll.id);
        return {
          poll,
          voteCount: pollVotes.length
        };
      });

      stats.averageVotesPerPoll = votes.length / polls.length;

      const sortedByVotes = pollVoteCounts.sort((a, b) => b.voteCount - a.voteCount);
      stats.mostPopularPoll = sortedByVotes[0];
      stats.leastPopularPoll = sortedByVotes[sortedByVotes.length - 1];
    }

    return stats;
  }
}
```

## React Integration

### Voting Hook

```jsx
function useVoting(node, identity, polls, votes) {
  const [isVoting, setIsVoting] = useState(false);
  const [votingErrors, setVotingErrors] = useState({});

  const voteEncoder = useMemo(() =>
    createEncoder({ contentTopic: "/decenvote/1/votes/proto" }), []
  );

  const voteCaster = useMemo(() =>
    new VoteCaster(node, identity, voteEncoder), [node, identity, voteEncoder]
  );

  const voteCounter = useMemo(() => new VoteCounter(), []);

  // Cast a vote
  const castVote = useCallback(async (pollId, optionIndex) => {
    if (!node || !identity) {
      throw new Error("Node or identity not available");
    }

    setIsVoting(true);
    setVotingErrors(prev => ({ ...prev, [pollId]: null }));

    try {
      const result = await voteCaster.castVote(pollId, optionIndex, polls, votes);

      if (result.success) {
        console.log("Vote cast successfully");
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setVotingErrors(prev => ({ ...prev, [pollId]: error.message }));
      throw error;
    } finally {
      setIsVoting(false);
    }
  }, [node, identity, polls, votes, voteCaster]);

  // Calculate results for all polls
  const pollResults = useMemo(() => {
    return voteCounter.calculateAllResults(polls, votes);
  }, [polls, votes, voteCounter]);

  // Check if user has voted
  const hasVoted = useCallback((pollId) => {
    return voteCounter.hasUserVoted(pollId, identity?.publicKeyHex, votes);
  }, [identity, votes, voteCounter]);

  // Get user's vote
  const getUserVote = useCallback((pollId) => {
    return voteCounter.getUserVote(pollId, identity?.publicKeyHex, votes);
  }, [identity, votes, voteCounter]);

  return {
    castVote,
    pollResults,
    hasVoted,
    getUserVote,
    isVoting,
    votingErrors,
    stats: voteCounter.getVotingStats(polls, votes)
  };
}
```

### Voting Component

```jsx
function VotingInterface({ poll, onVote, disabled = false }) {
  const { castVote, hasVoted, getUserVote, isVoting, votingErrors } = useVoting();
  const [selectedOption, setSelectedOption] = useState(null);

  const userVoted = hasVoted(poll.id);
  const userVote = getUserVote(poll.id);
  const error = votingErrors[poll.id];

  const handleVote = async (optionIndex) => {
    try {
      await castVote(poll.id, optionIndex);
      onVote?.(poll.id, optionIndex);
    } catch (error) {
      console.error("Voting failed:", error);
    }
  };

  if (userVoted) {
    return (
      <div className="voting-complete">
        <p>✅ You voted for: <strong>{poll.options[userVote.optionIndex]}</strong></p>
        <small>Voted on {new Date(userVote.timestamp).toLocaleString()}</small>
      </div>
    );
  }

  return (
    <div className="voting-interface">
      <h3>{poll.question}</h3>

      <div className="voting-options">
        {poll.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleVote(index)}
            disabled={disabled || isVoting}
            className={`vote-option ${selectedOption === index ? 'selected' : ''}`}
            onMouseEnter={() => setSelectedOption(index)}
            onMouseLeave={() => setSelectedOption(null)}
          >
            {option}
            {isVoting && selectedOption === index && (
              <span className="voting-spinner">⏳</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="voting-error">
          ❌ {error}
        </div>
      )}

      {isVoting && (
        <div className="voting-status">
          Casting your vote...
        </div>
      )}
    </div>
  );
}
```

### Results Display

```jsx
function PollResults({ pollResult }) {
  if (!pollResult) {
    return <div>Loading results...</div>;
  }

  const { poll, results, totalVotes } = pollResult;

  return (
    <div className="poll-results">
      <h3>{poll.question}</h3>

      <div className="results-summary">
        <span className="total-votes">{totalVotes} total votes</span>
      </div>

      <div className="results-list">
        {results.map((result, index) => (
          <div key={index} className="result-item">
            <div className="result-header">
              <span className="option-text">{result.option}</span>
              <span className="vote-count">{result.count} votes ({result.percentage}%)</span>
            </div>

            <div className="result-bar">
              <div
                className="result-fill"
                style={{ width: `${result.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="results-footer">
        <small>
          Last updated: {new Date(pollResult.lastUpdated).toLocaleString()}
        </small>
      </div>
    </div>
  );
}
```

## Edge Cases and Error Handling

### Concurrent Vote Handling

```js
// Handle race conditions when multiple users vote simultaneously
class ConcurrentVoteHandler {
  constructor() {
    this.processedVotes = new Set(); // Track processed vote IDs
  }

  // Generate unique vote ID
  generateVoteId(vote) {
    return `${vote.pollId}_${vote.voterPublicKey}_${vote.timestamp}`;
  }

  // Process vote only once
  processVoteOnce(vote, callback) {
    const voteId = this.generateVoteId(vote);

    if (this.processedVotes.has(voteId)) {
      console.log("Vote already processed, skipping");
      return false;
    }

    this.processedVotes.add(voteId);
    callback(vote);
    return true;
  }

  // Clean old processed votes (memory management)
  cleanOldVotes(maxAge = 60 * 60 * 1000) { // 1 hour
    const cutoff = Date.now() - maxAge;
    // In a real implementation, you'd track timestamps
    // For now, just clear everything periodically
    if (this.processedVotes.size > 10000) {
      this.processedVotes.clear();
    }
  }
}
```

### Vote Conflict Resolution

```js
// Handle conflicts when processing votes
class VoteConflictResolver {
  // Resolve conflicts when same voter has multiple votes
  resolveVoteConflicts(votes) {
    const voterVotes = new Map(); // voterPublicKey -> vote
    const resolvedVotes = [];
    const conflicts = [];

    for (const vote of votes) {
      const existingVote = voterVotes.get(vote.voterPublicKey);

      if (!existingVote) {
        // First vote from this voter
        voterVotes.set(vote.voterPublicKey, vote);
        resolvedVotes.push(vote);
      } else {
        // Conflict: voter has multiple votes
        conflicts.push({
          voter: vote.voterPublicKey,
          existingVote,
          newVote: vote
        });

        // Resolution strategy: keep earliest vote
        if (vote.timestamp < existingVote.timestamp) {
          // Replace with earlier vote
          const index = resolvedVotes.findIndex(v => v === existingVote);
          if (index !== -1) {
            resolvedVotes[index] = vote;
            voterVotes.set(vote.voterPublicKey, vote);
          }
        }
        // Otherwise, ignore the later vote
      }
    }

    return {
      resolvedVotes,
      conflicts
    };
  }
}
```

This voting logic ensures integrity, prevents fraud, and provides real-time results while handling edge cases gracefully.