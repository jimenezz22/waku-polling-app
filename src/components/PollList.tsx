import React, { useEffect, useState } from 'react';
import { DataService, createVoteDataWithDefaults } from '../services/DataService';
import { identityService } from '../services/IdentityService';
import type { IPollData, IVoteData } from '../services/ProtobufSchemas';
import { PollCard } from './PollCard';

interface PollListProps {
  dataService: DataService;
}

export const PollList: React.FC<PollListProps> = ({ dataService }) => {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [votes, setVotes] = useState<IVoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserPublicKey, setCurrentUserPublicKey] = useState<string>('');

  useEffect(() => {
    const identity = identityService.getIdentity();
    if (identity) {
      setCurrentUserPublicKey(identity.publicKeyHex);
    }
  }, []);

  useEffect(() => {
    if (!dataService.isReady()) {
      setError('Waiting for Waku network...');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [historicalPolls, historicalVotes] = await Promise.all([
          dataService.loadHistoricalPolls(),
          dataService.loadHistoricalVotes(),
        ]);

        setPolls(historicalPolls.sort((a, b) => b.timestamp - a.timestamp));
        setVotes(historicalVotes);

        await setupSubscriptions();

        setLoading(false);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      }
    };

    const setupSubscriptions = async () => {
      try {
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
          }
        );

        await dataService.subscribeToVotes(
          (newVote) => {
            setVotes((prev) => {
              if (
                prev.some(
                  (v) =>
                    v.pollId === newVote.pollId &&
                    v.voterPublicKey === newVote.voterPublicKey
                )
              ) {
                return prev;
              }
              return [...prev, newVote];
            });
          },
          (err) => {
            console.error('Vote subscription error:', err);
          }
        );
      } catch (err) {
        console.error('Failed to setup subscriptions:', err);
      }
    };

    loadData();

    return () => {
      dataService.cleanup().catch((err) => {
        console.error('Cleanup error:', err);
      });
    };
  }, [dataService]);

  const getUserVoteForPoll = (pollId: string): number | null => {
    const userVote = votes.find(
      (v) => v.pollId === pollId && v.voterPublicKey === currentUserPublicKey
    );
    return userVote ? userVote.optionIndex : null;
  };

  const getVoteResultsForPoll = (pollId: string): { [optionIndex: number]: number } => {
    const pollVotes = votes.filter((v) => v.pollId === pollId);

    const deduplicatedVotes = new Map<string, IVoteData>();
    pollVotes.forEach((vote) => {
      const key = `${vote.pollId}_${vote.voterPublicKey}`;
      if (!deduplicatedVotes.has(key)) {
        deduplicatedVotes.set(key, vote);
      }
    });

    const results: { [optionIndex: number]: number } = {};
    Array.from(deduplicatedVotes.values()).forEach((vote) => {
      results[vote.optionIndex] = (results[vote.optionIndex] || 0) + 1;
    });

    return results;
  };

  const handleVote = async (pollId: string, optionIndex: number) => {
    const userVote = getUserVoteForPoll(pollId);
    if (userVote !== null) {
      console.warn('User has already voted on this poll');
      return;
    }

    if (!currentUserPublicKey) {
      console.error('User identity not available');
      return;
    }

    try {
      const voteData = createVoteDataWithDefaults(
        pollId,
        optionIndex,
        currentUserPublicKey,
        ''
      );

      await dataService.publishVote(voteData);

      console.log(`✅ Vote submitted for poll ${pollId}, option ${optionIndex}`);
    } catch (err) {
      console.error('Failed to submit vote:', err);
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
            currentUserPublicKey={currentUserPublicKey}
            userVote={getUserVoteForPoll(poll.id)}
            voteResults={getVoteResultsForPoll(poll.id)}
            showResults={true}
          />
        ))}
      </div>
    </div>
  );
};

export default PollList;