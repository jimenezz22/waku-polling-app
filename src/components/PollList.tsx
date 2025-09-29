/**
 * PollList - Component for displaying and managing polls
 *
 * This component:
 * - Displays all polls from the Waku network in real-time
 * - Handles loading and error states
 * - Provides voting functionality through PollCard components
 * - Shows empty state when no polls are available
 * - Integrates with usePolls and useVotes hooks for state management
 */

import React from 'react';
import { DataService } from '../services/DataService';
import { usePolls } from '../hooks/usePolls';
import { useVotes } from '../hooks/useVotes';
import { useIdentity } from '../hooks/useIdentity';
import { PollCard } from './PollCard';

interface PollListProps {
  dataService: DataService;
}

export const PollList: React.FC<PollListProps> = ({ dataService }) => {
  const { fullPublicKey } = useIdentity();
  const { polls, loading, error } = usePolls(dataService);
  const { submitVote, getUserVoteForPoll, getVoteResults } = useVotes(dataService, fullPublicKey);

  const handleVote = async (pollId: string, optionIndex: number) => {
    try {
      await submitVote(pollId, optionIndex);
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  if (loading) {
    return (
      <div className="poll-list">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading polls from Waku network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="poll-list">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="poll-list">
        <div className="empty-state">
          <p>No polls yet. Create the first one!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="poll-list">
      <h2>Polls ({polls.length})</h2>
      <div className="polls-container">
        {polls.map((poll) => (
          <PollCard
            key={poll.id}
            poll={poll}
            onVote={handleVote}
            currentUserPublicKey={fullPublicKey}
            userVote={getUserVoteForPoll(poll.id)}
            voteResults={getVoteResults(poll.id)}
            showResults={true}
          />
        ))}
      </div>
    </div>
  );
};

export default PollList;