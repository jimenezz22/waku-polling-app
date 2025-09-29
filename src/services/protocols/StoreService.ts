/**
 * StoreService - Handles loading historical data using Waku Store protocol
 *
 * This service is responsible for:
 * - Loading historical polls from the network
 * - Loading historical votes from the network
 * - Decoding and validating historical messages
 * - Handling Store query errors gracefully
 *
 * Store protocol allows clients to retrieve messages that were published
 * while they were offline, providing data persistence in a decentralized way.
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
 * StoreService - Loads historical polls and votes using Store protocol
 */
export class StoreService {
  private wakuService: WakuService;
  private pollDecoder: IDecoder<any>;
  private voteDecoder: IDecoder<any>;

  /**
   * Create a new StoreService instance
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

    console.log("📥 StoreService initialized");
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

  // ==================== STORE QUERIES ====================

  /**
   * Load historical polls using Store protocol
   * @returns Array of all historical polls
   * @throws Error if node is not ready or query fails
   */
  async loadHistoricalPolls(): Promise<IPollData[]> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const polls: IPollData[] = [];

    try {
      console.log("📥 Loading historical polls from Store...");

      // Query Store protocol for historical messages
      await node.store.queryWithOrderedCallback(
        [this.pollDecoder],
        (wakuMessage: any) => {
          if (!wakuMessage.payload) {
            return;
          }

          try {
            // Decode poll data from message payload
            const pollData = decodePollData(wakuMessage.payload);

            // Validate before adding
            if (this.validatePollData(pollData)) {
              polls.push(pollData);
            }
          } catch (error) {
            console.error("❌ Failed to decode historical poll:", error);
          }
        }
      );

      console.log(`✅ Loaded ${polls.length} historical polls`);
      return polls;
    } catch (error) {
      console.error("❌ Failed to load historical polls:", error);
      throw error;
    }
  }

  /**
   * Load historical votes using Store protocol
   * @returns Array of all historical votes
   * @throws Error if node is not ready or query fails
   */
  async loadHistoricalVotes(): Promise<IVoteData[]> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const votes: IVoteData[] = [];

    try {
      console.log("📥 Loading historical votes from Store...");

      // Query Store protocol for historical messages
      await node.store.queryWithOrderedCallback(
        [this.voteDecoder],
        (wakuMessage: any) => {
          if (!wakuMessage.payload) {
            return;
          }

          try {
            // Decode vote data from message payload
            const voteData = decodeVoteData(wakuMessage.payload);

            // Validate before adding
            if (this.validateVoteData(voteData)) {
              votes.push(voteData);
            }
          } catch (error) {
            console.error("❌ Failed to decode historical vote:", error);
          }
        }
      );

      console.log(`✅ Loaded ${votes.length} historical votes`);
      return votes;
    } catch (error) {
      console.error("❌ Failed to load historical votes:", error);
      throw error;
    }
  }

  /**
   * Load all historical data (polls and votes) in parallel
   * @returns Object containing arrays of polls and votes
   */
  async loadAllHistoricalData(): Promise<{
    polls: IPollData[];
    votes: IVoteData[];
  }> {
    try {
      const [polls, votes] = await Promise.all([
        this.loadHistoricalPolls(),
        this.loadHistoricalVotes(),
      ]);

      return { polls, votes };
    } catch (error) {
      console.error("❌ Failed to load historical data:", error);
      throw error;
    }
  }

  /**
   * Check if the service is ready to query
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }
}

export default StoreService;