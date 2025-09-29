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
import { WakuConfig } from "../config/WakuConfig";
import { DataValidator } from "../validators/DataValidator";

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

    // Initialize decoders using configuration
    const routingInfo = {
      pubsubTopic: WakuConfig.ROUTING.pubsubTopic,
      clusterId: WakuConfig.ROUTING.clusterId,
      shardId: WakuConfig.ROUTING.shardId
    };

    this.pollDecoder = createDecoder(
      WakuConfig.CONTENT_TOPICS.polls,
      routingInfo
    );

    this.voteDecoder = createDecoder(
      WakuConfig.CONTENT_TOPICS.votes,
      routingInfo
    );

    console.log("📥 StoreService initialized");
  }


  // ==================== GENERIC STORE QUERY ====================

  /**
   * Generic method to load historical data
   */
  private async loadHistoricalData<T>(
    decoder: IDecoder<any>,
    decodeFunction: (payload: Uint8Array) => T,
    validateFunction: (data: T) => boolean,
    dataType: string
  ): Promise<T[]> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const results: T[] = [];

    try {
      console.log(`📥 Loading historical ${dataType} from Store...`);

      await node.store.queryWithOrderedCallback(
        [decoder],
        (wakuMessage: any) => {
          if (!wakuMessage.payload) {
            return;
          }

          try {
            const data = decodeFunction(wakuMessage.payload);
            if (validateFunction(data)) {
              results.push(data);
            }
          } catch (error) {
            console.error(`❌ Failed to decode historical ${dataType}:`, error);
          }
        }
      );

      console.log(`✅ Loaded ${results.length} historical ${dataType}`);
      return results;
    } catch (error) {
      console.warn(`⚠️ Failed to load historical ${dataType} (Store protocol unavailable):`, error);
      return [];
    }
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Load historical polls using Store protocol
   * @returns Array of all historical polls
   * @throws Error if node is not ready or query fails
   */
  async loadHistoricalPolls(): Promise<IPollData[]> {
    return this.loadHistoricalData<IPollData>(
      this.pollDecoder,
      decodePollData,
      DataValidator.validatePoll,
      "polls"
    );
  }

  /**
   * Load historical votes using Store protocol
   * @returns Array of all historical votes
   * @throws Error if node is not ready or query fails
   */
  async loadHistoricalVotes(): Promise<IVoteData[]> {
    return this.loadHistoricalData<IVoteData>(
      this.voteDecoder,
      decodeVoteData,
      DataValidator.validateVote,
      "votes"
    );
  }

  /**
   * Load all historical data (polls and votes) in parallel
   * @returns Object containing arrays of polls and votes
   */
  async loadAllHistoricalData(): Promise<{
    polls: IPollData[];
    votes: IVoteData[];
  }> {
    const [polls, votes] = await Promise.all([
      this.loadHistoricalPolls(),
      this.loadHistoricalVotes(),
    ]);

    return { polls, votes };
  }

  /**
   * Check if the service is ready to query
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }
}

export default StoreService;