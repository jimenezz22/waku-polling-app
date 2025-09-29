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

import { createEncoder, ReliableChannel } from "@waku/sdk";
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
  private pollChannel: any = null;
  private voteChannel: any = null;
  private senderId: string;

  /**
   * Create a new LightPushService instance
   * @param wakuService - The WakuService instance to use for node access
   */
  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;
    this.senderId = this.generateSenderId();

    // Initialize encoders for both content topics
    // Using default routing info compatible with bootstrap network
    const routingInfo = {
      pubsubTopic: "/waku/2/default-waku/proto",  // Default pubsub topic
      clusterId: 1,     // Default cluster
      shardId: 0        // Default shard
    };

    this.pollEncoder = createEncoder({
      contentTopic: WakuService.CONTENT_TOPICS.POLLS,
      ephemeral: true,  // Like the boilerplate projects
      routingInfo,
    });

    this.voteEncoder = createEncoder({
      contentTopic: WakuService.CONTENT_TOPICS.VOTES,
      ephemeral: true,  // Like the boilerplate projects
      routingInfo,
    });

    // Initialize ReliableChannels once Waku is ready
    this.initializeReliableChannels();

    console.log("📤 LightPushService initialized");
  }

  private generateSenderId(): string {
    return `decenvote-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async initializeReliableChannels(): Promise<void> {
    // Wait for Waku to be initialized before creating ReliableChannels
    if (!this.wakuService.checkIsInitialized()) {
      console.log("⏳ Waiting for Waku to be initialized...");
      // Try again in 1 second
      setTimeout(() => this.initializeReliableChannels(), 1000);
      return;
    }

    try {
      const node = this.wakuService.getNode();
      if (!node) {
        console.warn("❌ No Waku node available for ReliableChannels");
        return;
      }

      console.log("🔄 Creating ReliableChannels...");

      // Create decoder for polls
      const pollDecoder = node.createDecoder({
        contentTopic: WakuService.CONTENT_TOPICS.POLLS,
      });

      // Create decoder for votes
      const voteDecoder = node.createDecoder({
        contentTopic: WakuService.CONTENT_TOPICS.VOTES,
      });

      // Create ReliableChannel for polls
      this.pollChannel = await ReliableChannel.create(
        node,
        "decenvote-polls",
        this.senderId,
        this.pollEncoder,
        pollDecoder
      );

      // Create ReliableChannel for votes
      this.voteChannel = await ReliableChannel.create(
        node,
        "decenvote-votes",
        this.senderId,
        this.voteEncoder,
        voteDecoder
      );

      console.log("✅ ReliableChannels initialized successfully");

    } catch (error) {
      console.error("❌ Failed to initialize ReliableChannels:", error);
      // Retry in 5 seconds
      setTimeout(() => this.initializeReliableChannels(), 5000);
    }
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
   * Publish a new poll using ReliableChannel
   * @param pollData - The poll data to publish
   * @returns The published poll data
   * @throws Error if node is not ready or publishing fails
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    if (!this.pollChannel) {
      throw new Error("Poll ReliableChannel is not initialized");
    }

    // Validate poll data
    if (!this.validatePollData(pollData)) {
      throw new Error("Invalid poll data");
    }

    try {
      // Debug: Check node state before sending
      console.log(`🔍 Pre-send debug:`, {
        nodeReady: this.wakuService.isReady(),
        hasReliableChannel: !!this.pollChannel,
        pollId: pollData.id,
        senderId: this.senderId
      });

      // Encode poll data to bytes
      const payload = encodePollData(pollData);

      // Send using ReliableChannel (much more reliable than direct LightPush)
      const messageId = this.pollChannel.send(payload);

      console.log('📤 ReliableChannel message sent:', { messageId, pollId: pollData.id });

      // ReliableChannel handles retransmission and peer management automatically
      console.log(`✅ Poll published via ReliableChannel: ${pollData.id}`);
      return pollData;

    } catch (error) {
      console.error("❌ Failed to publish poll via ReliableChannel:", error);
      throw new Error(`Failed to publish poll: ${error}`);
    }
  }

  /**
   * Publish a new vote using ReliableChannel
   * @param voteData - The vote data to publish
   * @returns The published vote data
   * @throws Error if node is not ready or publishing fails
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    if (!this.voteChannel) {
      throw new Error("Vote ReliableChannel is not initialized");
    }

    // Validate vote data
    if (!this.validateVoteData(voteData)) {
      throw new Error("Invalid vote data");
    }

    try {
      // Encode vote data to bytes
      const payload = encodeVoteData(voteData);

      // Send using ReliableChannel
      const messageId = this.voteChannel.send(payload);

      console.log('📤 Vote sent via ReliableChannel:', { messageId, pollId: voteData.pollId });
      console.log(`✅ Vote published via ReliableChannel for poll: ${voteData.pollId}`);
      return voteData;

    } catch (error) {
      console.error("❌ Failed to publish vote via ReliableChannel:", error);
      throw new Error(`Failed to publish vote: ${error}`);
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