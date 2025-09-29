/**
 * DataService - Orchestrates all Waku protocol operations
 *
 * This service acts as a unified interface for all Waku messaging operations:
 * - Real-time publishing and subscriptions (via ReliableChannelService)
 * - Loading historical data (via StoreService)
 *
 * It provides a simple, centralized API for components to interact with
 * the Waku network without needing to know about individual protocols.
 *
 * Architecture:
 * DataService (orchestrator)
 *   ├── ReliableChannelService (real-time messaging)
 *   └── StoreService (historical data)
 */

import { WakuService } from "./WakuService";
import { ReliableChannelService } from "./protocols/ReliableChannelService";
import { StoreService } from "./protocols/StoreService";
import type {
  PollCallback,
  VoteCallback,
  ErrorCallback,
} from "./protocols/ReliableChannelService";
import type { IPollData, IVoteData } from "./ProtobufSchemas";

// Re-export types for convenience
export type { PollCallback, VoteCallback, ErrorCallback };

/**
 * DataService - Main orchestrator for all Waku data operations
 */
export class DataService {
  private wakuService: WakuService;

  // Protocol-specific services
  public readonly reliableChannel: ReliableChannelService;
  public readonly store: StoreService;

  /**
   * Create a new DataService instance
   * @param wakuService - The WakuService instance to use for node access
   */
  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;

    // Initialize protocol services
    this.reliableChannel = new ReliableChannelService(wakuService);
    this.store = new StoreService(wakuService);

    console.log("📡 DataService orchestrator initialized");
  }

  // ==================== PUBLISHING (ReliableChannel) ====================

  /**
   * Publish a new poll using ReliableChannel
   * @param pollData - The poll data to publish
   * @returns The published poll data
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    return this.reliableChannel.publishPoll(pollData);
  }

  /**
   * Publish a new vote using ReliableChannel
   * @param voteData - The vote data to publish
   * @returns The published vote data
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    return this.reliableChannel.publishVote(voteData);
  }

  // ==================== HISTORICAL DATA (Store) ====================

  /**
   * Load historical polls using Store protocol
   * @returns Array of all historical polls
   */
  async loadHistoricalPolls(): Promise<IPollData[]> {
    return this.store.loadHistoricalPolls();
  }

  /**
   * Load historical votes using Store protocol
   * @returns Array of all historical votes
   */
  async loadHistoricalVotes(): Promise<IVoteData[]> {
    return this.store.loadHistoricalVotes();
  }

  /**
   * Load all historical data (polls and votes) in parallel
   * @returns Object containing arrays of polls and votes
   */
  async loadAllHistoricalData(): Promise<{
    polls: IPollData[];
    votes: IVoteData[];
  }> {
    return this.store.loadAllHistoricalData();
  }

  // ==================== SUBSCRIPTIONS (ReliableChannel) ====================

  /**
   * Subscribe to new polls using ReliableChannel
   * @param onPoll - Callback function for new polls
   * @param onError - Optional error callback
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    return this.reliableChannel.subscribeToPolls(onPoll, onError);
  }

  /**
   * Subscribe to new votes using ReliableChannel
   * @param onVote - Callback function for new votes
   * @param onError - Optional error callback
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    return this.reliableChannel.subscribeToVotes(onVote, onError);
  }

  /**
   * Subscribe to both polls and votes at once using ReliableChannel
   * @param onPoll - Callback function for new polls
   * @param onVote - Callback function for new votes
   * @param onError - Optional error callback
   */
  async subscribeToAll(
    onPoll: PollCallback,
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    await this.reliableChannel.subscribeToPolls(onPoll, onError);
    await this.reliableChannel.subscribeToVotes(onVote, onError);
  }

  /**
   * Unsubscribe from poll updates
   */
  async unsubscribeFromPolls(): Promise<void> {
    return this.reliableChannel.unsubscribeFromPolls();
  }

  /**
   * Unsubscribe from vote updates
   */
  async unsubscribeFromVotes(): Promise<void> {
    return this.reliableChannel.unsubscribeFromVotes();
  }

  /**
   * Unsubscribe from all topics
   */
  async unsubscribeFromAll(): Promise<void> {
    await this.reliableChannel.unsubscribeFromPolls();
    await this.reliableChannel.unsubscribeFromVotes();
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if any ReliableChannel subscriptions are active
   */
  hasActiveSubscriptions(): boolean {
    return this.reliableChannel.hasActiveSubscriptions();
  }

  /**
   * Check if the service is ready to use
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }

  /**
   * Cleanup all subscriptions and resources
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up DataService...");
    await this.reliableChannel.unsubscribeFromPolls();
    await this.reliableChannel.unsubscribeFromVotes();
    console.log("✅ DataService cleanup complete");
  }
}

/**
 * Utility functions for common operations
 */

/**
 * Generate a unique poll ID
 */
export function generatePollId(): string {
  return `poll_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create poll data with defaults
 */
export function createPollDataWithDefaults(
  question: string,
  options: string[],
  createdBy: string
): IPollData {
  return {
    id: generatePollId(),
    question,
    options,
    createdBy,
    timestamp: Date.now(),
  };
}

/**
 * Create vote data with defaults
 */
export function createVoteDataWithDefaults(
  pollId: string,
  optionIndex: number,
  voterPublicKey: string,
  signature: string = ""
): IVoteData {
  return {
    pollId,
    optionIndex,
    voterPublicKey,
    signature,
    timestamp: Date.now(),
  };
}

export default DataService;