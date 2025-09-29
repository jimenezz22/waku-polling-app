/**
 * LightPushService - ReliableChannel implementation following Scala's exact pattern
 *
 * This implementation replicates Scala's successful ReliableChannel architecture:
 * - Dynamic content topics per channel
 * - Direct event.detail handling
 * - Simple message processing with senderId filtering
 * - Node-based encoder/decoder creation
 */

import { ReliableChannel } from "@waku/sdk";
import {
  encodePollData,
  encodeVoteData,
  decodePollData, // Used in handleIncomingMessage
  decodeVoteData, // Used in handleIncomingMessage
  type IPollData,
  type IVoteData,
} from "../ProtobufSchemas";
import { WakuService } from "../WakuService";

export type PollCallback = (poll: IPollData) => void;
export type VoteCallback = (vote: IVoteData) => void;
export type ErrorCallback = (error: Error) => void;

interface PollChannel {
  channelId: string;
  reliableChannel: any;
  encoder: any;
  decoder: any;
}

/**
 * LightPushService following Scala's ReliableChannel pattern
 */
export class LightPushService {
  private wakuService: WakuService;
  private channels: Map<string, PollChannel> = new Map();
  private senderId: string;

  // Callback functions
  private pollCallback: PollCallback | null = null;
  private voteCallback: VoteCallback | null = null;
  private errorCallback: ErrorCallback | null = null;

  // Message buffers for early messages (like Scala's processedMessageIds pattern)
  private pendingPolls: IPollData[] = [];
  private pendingVotes: IVoteData[] = [];

  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;
    this.senderId = this.generateSenderId();

    // Initialize channels when Waku is ready
    this.initializeChannels();

    console.log("📤 LightPushService initialized with Scala pattern");
  }

  private generateSenderId(): string {
    return `decenvote-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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

      console.log("🔄 Creating channels using Scala pattern...");

      // Create channels for polls and votes like Scala does for calendars
      await this.addChannel("polls");
      await this.addChannel("votes");

      console.log("✅ Channels initialized successfully using Scala pattern");

    } catch (error) {
      console.error("❌ Failed to initialize channels:", error);
      setTimeout(() => this.initializeChannels(), 5000);
    }
  }

  /**
   * Add a channel for a specific message type (following Scala's addCalendarChannel pattern)
   */
  public async addChannel(channelId: string): Promise<boolean> {
    const node = this.wakuService.getNode();
    if (!node) {
      this.errorCallback?.(new Error('Waku node not initialized'));
      return false;
    }

    if (this.channels.has(channelId)) {
      console.log(`Channel ${channelId} already exists`);
      return true;
    }

    try {
      console.log(`Adding channel for: ${channelId}`);

      // Create dynamic content topic following Scala's pattern
      const contentTopic = `/polling-app/1/${channelId}/messages`;

      // Create encoder and decoder using node methods (Scala pattern)
      const encoder = node.createEncoder({ contentTopic });
      const decoder = node.createDecoder({ contentTopic });

      // Create reliable channel
      const reliableChannel = await ReliableChannel.create(
        node,
        channelId,
        this.senderId,
        encoder,
        decoder
      );

      // Listen for incoming messages (Scala pattern)
      reliableChannel.addEventListener("message-received", (event: any) => {
        this.handleIncomingMessage(event.detail, channelId);
      });

      // Setup other event listeners like Scala
      this.setupChannelEventListeners(reliableChannel, channelId);

      // Store the channel
      const channel: PollChannel = {
        channelId,
        reliableChannel,
        encoder,
        decoder
      };

      this.channels.set(channelId, channel);
      console.log(`Channel added for: ${channelId} with content topic: ${contentTopic}`);

      return true;

    } catch (error) {
      console.error(`Failed to add channel for ${channelId}:`, error);
      this.errorCallback?.(new Error(`Failed to add channel: ${error}`));
      return false;
    }
  }

  /**
   * Setup channel event listeners following Scala's pattern
   */
  private setupChannelEventListeners(reliableChannel: any, channelId: string) {
    reliableChannel.addEventListener("sending-message-irrecoverable-error", (event: any) => {
      console.error(`Failed to send message for channel ${channelId}:`, event.detail.error);
      this.errorCallback?.(new Error(`Failed to send message for channel ${channelId}: ${event.detail.error}`));
    });

    reliableChannel.addEventListener("message-sent", (event: any) => {
      console.log(`Message sent successfully for channel ${channelId}:`, event.detail);
    });

    reliableChannel.addEventListener("message-acknowledged", (event: any) => {
      console.log(`Message acknowledged by network for channel ${channelId}:`, event.detail);
    });
  }

  /**
   * Handle incoming messages following Scala's exact pattern
   */
  private handleIncomingMessage(wakuMessage: any, channelId: string) {
    try {
      console.log(`📥 Processing incoming Waku message for channel ${channelId}:`, wakuMessage);

      // Determine message type based on channel
      if (channelId === "polls") {
        // Decode poll data directly from wakuMessage.payload (Scala pattern)
        const pollData = decodePollData(wakuMessage.payload);
        console.log("📥 Successfully decoded poll data:", pollData);

        // Skip our own messages (like Scala does - lines 264-268)
        // Note: For polls, we could add a senderId field to poll data structure
        // For now, we'll process all polls and let UI handle duplicates

        if (this.pollCallback) {
          console.log("📥 Calling poll callback with data:", pollData.id);
          this.pollCallback(pollData);
        } else {
          console.warn("📥 No poll callback set! Buffering poll:", pollData.id);
          // Buffer the poll for when callback is registered (like Scala's pattern)
          this.pendingPolls.push(pollData);
        }

      } else if (channelId === "votes") {
        // Decode vote data directly from wakuMessage.payload (Scala pattern)
        const voteData = decodeVoteData(wakuMessage.payload);
        console.log("📥 Successfully decoded vote data:", voteData);

        // Skip our own messages (like Scala does)
        // For votes, we could check voterPublicKey if it matches our identity

        if (this.voteCallback) {
          console.log("📥 Calling vote callback with data for poll:", voteData.pollId);
          this.voteCallback(voteData);
        } else {
          console.warn("📥 No vote callback set! Buffering vote for poll:", voteData.pollId);
          // Buffer the vote for when callback is registered (like Scala's pattern)
          this.pendingVotes.push(voteData);
        }
      }

    } catch (error) {
      console.error(`❌ Failed to decode incoming message for channel ${channelId}:`, error);
      this.errorCallback?.(new Error(`Failed to decode message for channel ${channelId}: ${error}`));
    }
  }

  // ==================== PUBLISHING ====================

  /**
   * Publish a poll using ReliableChannel (following Scala's sendEventAction pattern)
   */
  async publishPoll(pollData: IPollData): Promise<IPollData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const channel = this.channels.get("polls");
    if (!channel) {
      throw new Error("Polls channel is not initialized");
    }

    if (!this.validatePollData(pollData)) {
      throw new Error("Invalid poll data");
    }

    try {
      console.log(`🔍 Publishing poll using Scala pattern:`, {
        nodeReady: this.wakuService.isReady(),
        hasChannel: !!channel,
        pollId: pollData.id,
        senderId: this.senderId
      });

      // Encode poll data to bytes (like Scala's EventActionMessage.encode)
      const payload = encodePollData(pollData);

      // Send using ReliableChannel (like Scala's channel.reliableChannel.send)
      const messageId = channel.reliableChannel.send(payload);

      console.log('📤 ReliableChannel message sent:', { messageId, pollId: pollData.id });
      console.log(`✅ Poll published via ReliableChannel: ${pollData.id}`);

      return pollData;

    } catch (error) {
      console.error("❌ Failed to publish poll via ReliableChannel:", error);
      throw new Error(`Failed to publish poll: ${error}`);
    }
  }

  /**
   * Publish a vote using ReliableChannel (following Scala's sendEventAction pattern)
   */
  async publishVote(voteData: IVoteData): Promise<IVoteData> {
    if (!this.wakuService.isReady()) {
      throw new Error("Waku node is not ready");
    }

    const channel = this.channels.get("votes");
    if (!channel) {
      throw new Error("Votes channel is not initialized");
    }

    if (!this.validateVoteData(voteData)) {
      throw new Error("Invalid vote data");
    }

    try {
      // Encode vote data to bytes
      const payload = encodeVoteData(voteData);

      // Send using ReliableChannel
      const messageId = channel.reliableChannel.send(payload);

      console.log('📤 Vote sent via ReliableChannel:', { messageId, pollId: voteData.pollId });
      console.log(`✅ Vote published via ReliableChannel for poll: ${voteData.pollId}`);

      return voteData;

    } catch (error) {
      console.error("❌ Failed to publish vote via ReliableChannel:", error);
      throw new Error(`Failed to publish vote: ${error}`);
    }
  }

  // ==================== SUBSCRIPTIONS ====================

  /**
   * Subscribe to polls using ReliableChannel events (following Scala's setEventHandlers pattern)
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.pollCallback = onPoll;
    if (onError) {
      this.errorCallback = onError;
    }

    // Process any buffered polls (like Scala's message processing pattern)
    if (this.pendingPolls.length > 0) {
      console.log(`📥 Processing ${this.pendingPolls.length} buffered polls...`);
      const bufferedPolls = [...this.pendingPolls];
      this.pendingPolls = []; // Clear buffer

      bufferedPolls.forEach(pollData => {
        console.log("📥 Processing buffered poll:", pollData.id);
        this.pollCallback!(pollData);
      });
    }

    console.log("✅ Subscribed to polls via ReliableChannel (Scala pattern)");
  }

  /**
   * Subscribe to votes using ReliableChannel events (following Scala's setEventHandlers pattern)
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.voteCallback = onVote;
    if (onError) {
      this.errorCallback = onError;
    }

    // Process any buffered votes (like Scala's message processing pattern)
    if (this.pendingVotes.length > 0) {
      console.log(`📥 Processing ${this.pendingVotes.length} buffered votes...`);
      const bufferedVotes = [...this.pendingVotes];
      this.pendingVotes = []; // Clear buffer

      bufferedVotes.forEach(voteData => {
        console.log("📥 Processing buffered vote for poll:", voteData.pollId);
        this.voteCallback!(voteData);
      });
    }

    console.log("✅ Subscribed to votes via ReliableChannel (Scala pattern)");
  }

  /**
   * Unsubscribe from poll updates
   */
  async unsubscribeFromPolls(): Promise<void> {
    this.pollCallback = null;
    console.log("✅ Unsubscribed from polls");
  }

  /**
   * Unsubscribe from vote updates
   */
  async unsubscribeFromVotes(): Promise<void> {
    this.voteCallback = null;
    console.log("✅ Unsubscribed from votes");
  }

  /**
   * Check if any subscriptions are active
   */
  hasActiveSubscriptions(): boolean {
    return this.pollCallback !== null || this.voteCallback !== null;
  }

  // ==================== VALIDATION ====================

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

  /**
   * Check if the service is ready to publish
   */
  isReady(): boolean {
    return this.wakuService.isReady();
  }

  /**
   * Get sender ID (like Scala's getSenderId)
   */
  getSenderId(): string {
    return this.senderId;
  }

  /**
   * Get channel count (like Scala's getChannelCount)
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Get channel IDs (like Scala's getChannelIds)
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }
}

export default LightPushService;