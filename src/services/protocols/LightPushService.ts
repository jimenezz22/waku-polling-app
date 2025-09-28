/**
 * LightPushService - Handles message publishing using Waku Light Push protocol
 *
 * This service is responsible for:
 * - Publishing new polls to the network
 * - Publishing votes to the network
 * - Message validation before publishing
 * - Encoding messages with proper content topics
 *
 * Light Push allows lightweight clients to publish messages without maintaining
 * full-time connections to the network.
 */

import { createEncoder } from "@waku/sdk";
import type { IEncoder } from "@waku/sdk";
import {
  encodePollData,
  encodeVoteData,
  type IPollData,
  type IVoteData,
} from "../ProtobufSchemas";
import { WakuService } from "../WakuService";

/**
 * LightPushService - Publishes polls and votes using Light Push protocol
 */
export class LightPushService {
  private wakuService: WakuService;
  private pollEncoder: IEncoder;
  private voteEncoder: IEncoder;

  /**
   * Create a new LightPushService instance
   * @param wakuService - The WakuService instance to use for node access
   */
  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;

    // Initialize encoders for both content topics
    const routingInfo = {
      pubsubTopic: "/waku/2/default-waku/proto",
      clusterId: 0,
      shardId: 0,
    };

    this.pollEncoder = createEncoder({
      contentTopic: WakuService.CONTENT_TOPICS.POLLS,
      routingInfo,
    });

    this.voteEncoder = createEncoder({
      contentTopic: WakuService.CONTENT_TOPICS.VOTES,
      routingInfo,
    });

    console.log("📤 LightPushService initialized");
  }

  // ==================== VALIDATION ====================

  /**
   * Validate poll data before publishing
   */
  private validatePollData(poll: IPollData): boolean {
    if (!poll.id || !poll.question || !poll.createdBy) {
      console.error("❌ Invalid poll: missing required fields");
      return false;
    }

    if (!poll.options || poll.options.length < 2) {
      console.error("❌ Invalid poll: must have at least 2 options");
      return false;
    }

    if (!poll.timestamp) {
      console.error("❌ Invalid poll: missing timestamp");
      return false;
    }

    return true;
  }

  /**
   * Validate vote data before publishing
   */
  private validateVoteData(vote: IVoteData): boolean {
    if (!vote.pollId || !vote.voterPublicKey) {
      console.error("❌ Invalid vote: missing required fields");
      return false;
    }

    if (vote.optionIndex === null || vote.optionIndex === undefined) {
      console.error("❌ Invalid vote: missing optionIndex");
      return false;
    }

    if (!vote.timestamp) {
      console.error("❌ Invalid vote: missing timestamp");
      return false;
    }

    return true;
  }

  // ==================== PUBLISHING ====================

  /**
   * Publish a new poll using Light Push protocol
   * @param pollData - The poll data to publish
   * @returns The published poll data
   * @throws Error if node is not ready or publishing fails
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    // Validate poll data
    if (!this.validatePollData(pollData)) {
      throw new Error("Invalid poll data");
    }

    try {
      // Encode poll data to bytes
      const payload = encodePollData(pollData);

      // Send using Light Push protocol
      const result = await node.lightPush.send(this.pollEncoder, {
        payload,
      });

      // Check if message was sent successfully
      if (result.recipients.length > 0) {
        console.log(`✅ Poll published successfully: ${pollData.id}`);
        return pollData;
      } else {
        throw new Error(
          `Failed to publish poll: ${result.errors?.join(", ") || "No recipients"}`
        );
      }
    } catch (error) {
      console.error("❌ Failed to publish poll:", error);
      throw error;
    }
  }

  /**
   * Publish a new vote using Light Push protocol
   * @param voteData - The vote data to publish
   * @returns The published vote data
   * @throws Error if node is not ready or publishing fails
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    const node = this.wakuService.getNode();

    if (!node || !this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    // Validate vote data
    if (!this.validateVoteData(voteData)) {
      throw new Error("Invalid vote data");
    }

    try {
      // Encode vote data to bytes
      const payload = encodeVoteData(voteData);

      // Send using Light Push protocol
      const result = await node.lightPush.send(this.voteEncoder, {
        payload,
      });

      // Check if message was sent successfully
      if (result.recipients.length > 0) {
        console.log(`✅ Vote published successfully for poll: ${voteData.pollId}`);
        return voteData;
      } else {
        throw new Error(
          `Failed to publish vote: ${result.errors?.join(", ") || "No recipients"}`
        );
      }
    } catch (error) {
      console.error("❌ Failed to publish vote:", error);
      throw error;
    }
  }

  /**
   * Check if the service is ready to publish
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }
}

export default LightPushService;