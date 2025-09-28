import React from 'react';
import type { IPollData } from '../services/ProtobufSchemas';

interface PollCardProps {
  poll: IPollData;
  onVote?: (pollId: string, optionIndex: number) => void;
  currentUserPublicKey?: string;
  userVote?: number | null;
  voteResults?: { [optionIndex: number]: number };
  showResults?: boolean;
}

export const PollCard: React.FC<PollCardProps> = ({
  poll,
  onVote,
  currentUserPublicKey,
  userVote,
  voteResults = {},
  showResults = false
}) => {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const truncateKey = (key: string, length: number = 16) => {
    if (key.length <= length) return key;
    return `${key.slice(0, length)}...`;
  };

  const isCreatedByCurrentUser = currentUserPublicKey === poll.createdBy;

  const totalVotes = Object.values(voteResults).reduce((sum, count) => sum + count, 0);

  const getVotePercentage = (optionIndex: number) => {
    if (totalVotes === 0) return 0;
    return Math.round(((voteResults[optionIndex] || 0) / totalVotes) * 100);
  };

  const handleVoteClick = (optionIndex: number) => {
    if (onVote && userVote === null) {
      onVote(poll.id, optionIndex);
    }
  };

  return (
    <div className="poll-card">
      <div className="poll-header">
        <h3 className="poll-question">{poll.question}</h3>
        <div className="poll-meta">
          <span className="poll-creator" title={poll.createdBy}>
            {isCreatedByCurrentUser ? '👤 You' : `👤 ${truncateKey(poll.createdBy)}`}
          </span>
          <span className="poll-timestamp">{formatTimestamp(poll.timestamp)}</span>
        </div>
      </div>

      <div className="poll-options">
        {poll.options.map((option, index) => {
          const voteCount = voteResults[index] || 0;
          const percentage = getVotePercentage(index);
          const isUserVote = userVote === index;
          const canVote = userVote === null && onVote;

          return (
            <div
              key={index}
              className={`poll-option ${isUserVote ? 'user-voted' : ''} ${canVote ? 'clickable' : ''}`}
              onClick={() => handleVoteClick(index)}
            >
              <div className="option-content">
                <span className="option-text">{option}</span>
                {showResults && (
                  <span className="option-stats">
                    {voteCount} vote{voteCount !== 1 ? 's' : ''} ({percentage}%)
                  </span>
                )}
              </div>

              {showResults && (
                <div className="vote-bar-container">
                  <div
                    className="vote-bar"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}

              {isUserVote && (
                <span className="user-vote-indicator">✓ Your vote</span>
              )}
            </div>
          );
        })}
      </div>

      {userVote !== null && userVote !== undefined && !showResults && (
        <div className="poll-footer">
          <p className="voted-message">✓ You voted for: {poll.options[userVote]}</p>
        </div>
      )}

      {showResults && totalVotes > 0 && (
        <div className="poll-footer">
          <p className="total-votes">Total votes: {totalVotes}</p>
        </div>
      )}
    </div>
  );
};

export default PollCard;