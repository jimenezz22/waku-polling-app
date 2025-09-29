/**
 * FilterService - Handles real-time message subscriptions using Waku Filter protocol
 *
 * This service is responsible for:
 * - Creating Filter subscriptions for polls and votes
 * - Managing subscription lifecycle (subscribe/unsubscribe)
 * - Decoding and validating incoming messages
 * - Preventing duplicate subscriptions
 * - Proper cleanup to avoid memory leaks
 *
 * Filter protocol allows lightweight clients to receive real-time messages
 * that match specific content topics without maintaining full network connections.
 */

import { createDecoder } from "@waku/sdk";
import type { IDecoder } from "@waku/sdk";
import {
  decodePollData,
  decodeVoteData,
  type IPollData,
  type IVoteData,
} from "../ProtobufSchemas";
import { WakuService } from "../WakuService";

/**
 * Callback types for real-time updates
 */
export type PollCallback = (poll: IPollData) => void;
export type VoteCallback = (vote: IVoteData) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * FilterService - Manages real-time subscriptions for polls and votes
 */
export class FilterService {
  private wakuService: WakuService;
  private pollDecoder: IDecoder<any>;
  private voteDecoder: IDecoder<any>;

  // Filter subscriptions tracking
  private pollSubscription: any = null;
  private voteSubscription: any = null;

  /**
   * Create a new FilterService instance
   * @param wakuService - The WakuService instance to use for node access
   */
  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;

    // Initialize decoders for both content topics
    // Using default routing info compatible with bootstrap network
    const routingInfo = {
      pubsubTopic: "/waku/2/default-waku/proto",  // Default pubsub topic
      clusterId: 1,     // Default cluster
      shardId: 0        // Default shard
    };

    this.pollDecoder = createDecoder(
      WakuService.CONTENT_TOPICS.POLLS,
      routingInfo
    );

    this.voteDecoder = createDecoder(
      WakuService.CONTENT_TOPICS.VOTES,
      routingInfo
    );

    console.log("🔔 FilterService initialized");
  }

  // ==================== VALIDATION ====================

  /**
   * Validate poll data (simple null checks)
   */
  private validatePollData(poll: IPollData): boolean {
    if (!poll.id || !poll.question || !poll.createdBy) {
      return false;
    }

    if (!poll.options || poll.options.length < 2) {
      return false;
    }

    if (!poll.timestamp) {
      return false;
    }

    return true;
  }

  /**
   * Validate vote data (simple null checks)
   */
  private validateVoteData(vote: IVoteData): boolean {
    if (!vote.pollId || !vote.voterPublicKey) {
      return false;
    }

    if (vote.optionIndex === null || vote.optionIndex === undefined) {
      return false;
    }

    if (!vote.timestamp) {
      return false;
    }

    return true;
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to new polls using Filter protocol
   * @param onPoll - Callback function for new polls
   * @param onError - Optional error callback
   * @throws Error if node is not ready or subscription fails
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    // Prevent duplicate subscriptions
    if (this.pollSubscription) {
      console.warn("⚠️ Poll subscription already exists");
      return;
    }

    try {
      console.log("🔔 Setting up Filter subscription for polls...");

      // Create Filter subscription
      const { error, subscription } = await node.filter.createSubscription({
        contentTopics: [WakuService.CONTENT_TOPICS.POLLS],
      });

      if (error) {
        throw new Error(`Failed to create poll subscription: ${error}`);
      }

      this.pollSubscription = subscription;

      // Register subscription with WakuService for cleanup
      this.wakuService.registerSubscription(
        WakuService.CONTENT_TOPICS.POLLS,
        subscription
      );

      // Subscribe to new poll messages
      await this.pollSubscription.subscribe(
        [this.pollDecoder],
        (wakuMessage: any) => {
          if (!wakuMessage.payload) {
            return;
          }

          try {
            // Decode poll data
            const pollData = decodePollData(wakuMessage.payload);

            // Validate and call callback
            if (this.validatePollData(pollData)) {
              console.log(`📊 New poll received: ${pollData.question}`);
              onPoll(pollData);
            }
          } catch (error) {
            console.error("❌ Failed to decode poll message:", error);
            onError?.(error as Error);
          }
        }
      );

      console.log("✅ Poll subscription active");
    } catch (error) {
      console.error("❌ Failed to subscribe to polls:", error);
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Subscribe to new votes using Filter protocol
   * @param onVote - Callback function for new votes
   * @param onError - Optional error callback
   * @throws Error if node is not ready or subscription fails
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    // Prevent duplicate subscriptions
    if (this.voteSubscription) {
      console.warn("⚠️ Vote subscription already exists");
      return;
    }

    try {
      console.log("🔔 Setting up Filter subscription for votes...");

      // Create Filter subscription
      const { error, subscription } = await node.filter.createSubscription({
        contentTopics: [WakuService.CONTENT_TOPICS.VOTES],
      });

      if (error) {
        throw new Error(`Failed to create vote subscription: ${error}`);
      }

      this.voteSubscription = subscription;

      // Register subscription with WakuService for cleanup
      this.wakuService.registerSubscription(
        WakuService.CONTENT_TOPICS.VOTES,
        subscription
      );

      // Subscribe to new vote messages
      await this.voteSubscription.subscribe(
        [this.voteDecoder],
        (wakuMessage: any) => {
          if (!wakuMessage.payload) {
            return;
          }

          try {
            // Decode vote data
            const voteData = decodeVoteData(wakuMessage.payload);

            // Validate and call callback
            if (this.validateVoteData(voteData)) {
              console.log(`🗳️ New vote received for poll: ${voteData.pollId}`);
              onVote(voteData);
            }
          } catch (error) {
            console.error("❌ Failed to decode vote message:", error);
            onError?.(error as Error);
          }
        }
      );

      console.log("✅ Vote subscription active");
    } catch (error) {
      console.error("❌ Failed to subscribe to votes:", error);
      onError?.(error as Error);
      throw error;
    }
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
    await Promise.all([
      this.subscribeToPolls(onPoll, onError),
      this.subscribeToVotes(onVote, onError),
    ]);
  }

  // ==================== UNSUBSCRIBE ====================

  /**
   * Unsubscribe from poll updates
   */
  async unsubscribeFromPolls(): Promise<void> {
    if (this.pollSubscription) {
      try {
        await this.pollSubscription.unsubscribe([
          WakuService.CONTENT_TOPICS.POLLS,
        ]);
        this.pollSubscription = null;
        console.log("🔕 Unsubscribed from polls");
      } catch (error) {
        console.error("❌ Failed to unsubscribe from polls:", error);
      }
    }
  }

  /**
   * Unsubscribe from vote updates
   */
  async unsubscribeFromVotes(): Promise<void> {
    if (this.voteSubscription) {
      try {
        await this.voteSubscription.unsubscribe([
          WakuService.CONTENT_TOPICS.VOTES,
        ]);
        this.voteSubscription = null;
        console.log("🔕 Unsubscribed from votes");
      } catch (error) {
        console.error("❌ Failed to unsubscribe from votes:", error);
      }
    }
  }

  /**
   * Unsubscribe from all topics
   */
  async unsubscribeFromAll(): Promise<void> {
    await Promise.all([
      this.unsubscribeFromPolls(),
      this.unsubscribeFromVotes(),
    ]);
  }

  // ==================== UTILITY ====================

  /**
   * Check if Filter subscriptions are active
   */
  hasActiveSubscriptions(): boolean {
    return this.pollSubscription !== null || this.voteSubscription !== null;
  }

  /**
   * Check if poll subscription is active
   */
  hasPollSubscription(): boolean {
    return this.pollSubscription !== null;
  }

  /**
   * Check if vote subscription is active
   */
  hasVoteSubscription(): boolean {
    return this.voteSubscription !== null;
  }

  /**
   * Check if the service is ready to subscribe
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up FilterService subscriptions...");
    await this.unsubscribeFromAll();
    console.log("✅ FilterService cleanup complete");
  }
}

export default FilterService;