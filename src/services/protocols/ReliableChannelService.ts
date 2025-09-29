/**
 * ReliableChannelService - Orchestrator for real-time data transmission
 *
 * This service coordinates between different modules to provide:
 * - Real-time poll and vote publishing via ReliableChannel
 * - Real-time subscriptions with automatic buffering
 * - Graceful Store protocol error handling
 */

import {
  encodePollData,
  encodeVoteData,
  type IPollData,
  type IVoteData,
} from "../ProtobufSchemas";
import { WakuService } from "../WakuService";
import { ChannelManager } from "../channels/ChannelManager";
import { DataProcessor, type PollCallback, type VoteCallback, type ErrorCallback } from "../channels/DataProcessor";
import { DataValidator } from "../validators/DataValidator";
import { StoreErrorPatcher } from "../utils/StoreErrorPatcher";

/**
 * ReliableChannelService - Manages real-time messaging using Waku ReliableChannel
 */
export class ReliableChannelService {
  private wakuService: WakuService;
  private channelManager: ChannelManager;
  private dataProcessor: DataProcessor;

  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;
    this.channelManager = new ChannelManager(wakuService.getNode());
    this.dataProcessor = new DataProcessor();

    // Initialize channels when Waku is ready
    this.initializeChannels();

    console.log("📤 ReliableChannelService initialized");
  }

  private async initializeChannels(): Promise<void> {
    // Wait for Waku to be initialized
    if (!this.wakuService.checkIsInitialized()) {
      console.log("⏳ Waiting for Waku to be initialized...");
      setTimeout(() => this.initializeChannels(), 1000);
      return;
    }

    try {
      const node = this.wakuService.getNode();
      if (!node) {
        console.warn("❌ No Waku node available for channels");
        return;
      }

      console.log("🔄 Creating ReliableChannel channels...");

      // Create channels for polls and votes
      await this.addChannel("polls");
      await this.addChannel("votes");

      console.log("✅ ReliableChannel channels initialized successfully");

    } catch (error) {
      console.error("❌ Failed to initialize channels:", error);
      setTimeout(() => this.initializeChannels(), 5000);
    }
  }

  /**
   * Add a channel for a specific data type
   */
  public async addChannel(channelId: string): Promise<boolean> {
    try {
      const channel = await this.channelManager.createChannel(channelId);
      if (!channel) {
        return false;
      }

      // Apply Store error suppression
      StoreErrorPatcher.patchChannel(channel.reliableChannel);

      // Setup error handling
      StoreErrorPatcher.setupErrorHandling(
        channel.reliableChannel,
        channelId,
        (error) => console.error(error)
      );

      // Listen for incoming data
      channel.reliableChannel.addEventListener("message-received", (event: any) => {
        this.dataProcessor.processIncomingData(event.detail.payload, channelId);
      });

      // Setup basic event listeners
      this.setupBasicEventListeners(channel.reliableChannel, channelId);

      return true;

    } catch (error) {
      console.error(`Failed to add channel for ${channelId}:`, error);
      return false;
    }
  }


  /**
   * Setup basic event listeners for data flow monitoring
   */
  private setupBasicEventListeners(reliableChannel: any, channelId: string) {
    reliableChannel.addEventListener("sending-message-irrecoverable-error", (event: any) => {
      console.error(`Failed to send data for channel ${channelId}:`, event.detail.error);
    });

    reliableChannel.addEventListener("message-sent", () => {
      console.log(`Data sent successfully for channel ${channelId}`);
    });

    reliableChannel.addEventListener("message-acknowledged", () => {
      console.log(`Data acknowledged by network for channel ${channelId}`);
    });
  }


  // ==================== PUBLISHING ====================

  /**
   * Publish a poll using ReliableChannel (for ReliableChannel sendEventAction pattern)
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const channel = this.channelManager.getChannel("polls");
    if (!channel) {
      throw new Error("Polls channel is not initialized");
    }

    if (!DataValidator.validatePoll(pollData)) {
      throw new Error("Invalid poll data");
    }

    try {
      const payload = encodePollData(pollData);
      channel.reliableChannel.send(payload);
      console.log(`✅ Poll published: ${pollData.id}`);
      return pollData;

    } catch (error) {
      console.error("❌ Failed to publish poll:", error);
      throw new Error(`Failed to publish poll: ${error}`);
    }
  }

  /**
   * Publish a vote using ReliableChannel (for ReliableChannel sendEventAction pattern)
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const channel = this.channelManager.getChannel("votes");
    if (!channel) {
      throw new Error("Votes channel is not initialized");
    }

    if (!DataValidator.validateVote(voteData)) {
      throw new Error("Invalid vote data");
    }

    try {
      const payload = encodeVoteData(voteData);
      channel.reliableChannel.send(payload);
      console.log(`✅ Vote published for poll: ${voteData.pollId}`);
      return voteData;

    } catch (error) {
      console.error("❌ Failed to publish vote:", error);
      throw new Error(`Failed to publish vote: ${error}`);
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to polls using ReliableChannel events (for ReliableChannel setEventHandlers pattern)
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.dataProcessor.setPollCallback(onPoll);
    if (onError) {
      this.dataProcessor.setErrorCallback(onError);
    }

    console.log("✅ Subscribed to polls via ReliableChannel");
  }

  /**
   * Subscribe to votes using ReliableChannel events (for ReliableChannel setEventHandlers pattern)
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.dataProcessor.setVoteCallback(onVote);
    if (onError) {
      this.dataProcessor.setErrorCallback(onError);
    }

    console.log("✅ Subscribed to votes via ReliableChannel");
  }

  /**
   * Unsubscribe from poll updates
   */
  async unsubscribeFromPolls(): Promise<void> {
    this.dataProcessor.clearPollCallback();
    console.log("✅ Unsubscribed from polls");
  }

  /**
   * Unsubscribe from vote updates
   */
  async unsubscribeFromVotes(): Promise<void> {
    this.dataProcessor.clearVoteCallback();
    console.log("✅ Unsubscribed from votes");
  }

  /**
   * Check if any subscriptions are active
   */
  hasActiveSubscriptions(): boolean {
    return this.dataProcessor.hasActiveCallbacks();
  }


  // ==================== UTILITY METHODS ====================

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      senderId: this.channelManager.getSenderId(),
      channelCount: this.channelManager.getChannelCount(),
      channels: this.channelManager.getChannelIds(),
      hasActiveSubscriptions: this.dataProcessor.hasActiveCallbacks(),
      pendingData: this.dataProcessor.getPendingCounts()
    };
  }
}

export default ReliableChannelService;