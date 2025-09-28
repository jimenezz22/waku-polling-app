/**
 * DataService - Orchestrates all Waku protocol operations
 *
 * This service acts as a unified interface for all Waku messaging operations:
 * - Publishing polls and votes (via LightPushService)
 * - Loading historical data (via StoreService)
 * - Real-time subscriptions (via FilterService)
 *
 * It provides a simple, centralized API for components to interact with
 * the Waku network without needing to know about individual protocols.
 *
 * Architecture:
 * DataService (orchestrator)
 *   ├── LightPushService (publishing)
 *   ├── StoreService (historical data)
 *   └── FilterService (subscriptions)
 */

import { WakuService } from "./WakuService";
import { LightPushService } from "./protocols/LightPushService";
import { StoreService } from "./protocols/StoreService";
import { FilterService } from "./protocols/FilterService";
import type {
  PollCallback,
  VoteCallback,
  ErrorCallback,
} from "./protocols/FilterService";
import type { IPollData, IVoteData } from "./ProtobufSchemas";

// Re-export types for convenience
export type { PollCallback, VoteCallback, ErrorCallback };

/**
 * DataService - Main orchestrator for all Waku data operations
 */
export class DataService {
  private wakuService: WakuService;

  // Protocol-specific services
  public readonly lightPush: LightPushService;
  public readonly store: StoreService;
  public readonly filter: FilterService;

  /**
   * Create a new DataService instance
   * @param wakuService - The WakuService instance to use for node access
   */
  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;

    // Initialize protocol services
    this.lightPush = new LightPushService(wakuService);
    this.store = new StoreService(wakuService);
    this.filter = new FilterService(wakuService);

    console.log("📡 DataService orchestrator initialized");
  }

  // ==================== PUBLISHING (Light Push) ====================

  /**
   * Publish a new poll using Light Push protocol
   * @param pollData - The poll data to publish
   * @returns The published poll data
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    return this.lightPush.publishPoll(pollData);
  }

  /**
   * Publish a new vote using Light Push protocol
   * @param voteData - The vote data to publish
   * @returns The published vote data
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    return this.lightPush.publishVote(voteData);
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

  // ==================== SUBSCRIPTIONS (Filter) ====================

  /**
   * Subscribe to new polls using Filter protocol
   * @param onPoll - Callback function for new polls
   * @param onError - Optional error callback
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    return this.filter.subscribeToPolls(onPoll, onError);
  }

  /**
   * Subscribe to new votes using Filter protocol
   * @param onVote - Callback function for new votes
   * @param onError - Optional error callback
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    return this.filter.subscribeToVotes(onVote, onError);
  }

  /**
   * Subscribe to both polls and votes at once
   * @param onPoll - Callback function for new polls
   * @param onVote - Callback function for new votes
   * @param onError - Optional error callback
   */
  async subscribeToAll(
    onPoll: PollCallback,
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    return this.filter.subscribeToAll(onPoll, onVote, onError);
  }

  /**
   * Unsubscribe from poll updates
   */
  async unsubscribeFromPolls(): Promise<void> {
    return this.filter.unsubscribeFromPolls();
  }

  /**
   * Unsubscribe from vote updates
   */
  async unsubscribeFromVotes(): Promise<void> {
    return this.filter.unsubscribeFromVotes();
  }

  /**
   * Unsubscribe from all topics
   */
  async unsubscribeFromAll(): Promise<void> {
    return this.filter.unsubscribeFromAll();
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Check if any Filter subscriptions are active
   */
  hasActiveSubscriptions(): boolean {
    return this.filter.hasActiveSubscriptions();
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
    await this.filter.cleanup();
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