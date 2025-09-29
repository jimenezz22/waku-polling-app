/**
 * ReliableChannelService - Waku ReliableChannel implementation for real-time messaging
 *
 * This service handles all real-time messaging for the polling app using Waku's ReliableChannel:
 * - Real-time poll and vote publishing
 * - Real-time poll and vote subscriptions
 * - Dynamic content topics per message type
 * - Store protocol error handling
 * - Message buffering for timing issues
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
 * ReliableChannelService - Manages real-time messaging using Waku ReliableChannel
 */
export class ReliableChannelService {
  private wakuService: WakuService;
  private channels: Map<string, PollChannel> = new Map();
  private senderId: string;

  // Callback functions
  private pollCallback: PollCallback | null = null;
  private voteCallback: VoteCallback | null = null;
  private errorCallback: ErrorCallback | null = null;

  // Message buffers for early messages
  private pendingPolls: IPollData[] = [];
  private pendingVotes: IVoteData[] = [];

  constructor(wakuService: WakuService) {
    this.wakuService = wakuService;
    this.senderId = this.generateSenderId();

    // Initialize channels when Waku is ready
    this.initializeChannels();

    console.log("📤 ReliableChannelService initialized");
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
   * Add a channel for a specific message type
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

      // Create dynamic content topic for message type
      const contentTopic = `/polling-app/1/${channelId}/messages`;

      // Create encoder and decoder using node methods (ReliableChannel)
      const encoder = node.createEncoder({ contentTopic });
      const decoder = node.createDecoder({ contentTopic });

      // Create reliable channel with Store error suppression
      const reliableChannel = await ReliableChannel.create(
        node,
        channelId,
        this.senderId,
        encoder,
        decoder
      );

      // Patch the reliableChannel to suppress Store errors
      this.patchReliableChannelForStoreErrors(reliableChannel);

      // Listen for incoming messages (ReliableChannel)
      reliableChannel.addEventListener("message-received", (event: any) => {
        this.handleIncomingMessage(event.detail, channelId);
      });

      // Setup other event listeners for ReliableChannel
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
   * Patch ReliableChannel to suppress Store protocol errors at the source
   */
  private patchReliableChannelForStoreErrors(reliableChannel: any) {
    // Patch the Store protocol access in MissingMessageRetriever, but keep the retriever functional
    if (reliableChannel.missingMessageRetriever) {
      console.log('🔧 Patching MissingMessageRetriever to prevent Store errors while keeping functionality');

      // Patch the _retrieve method to handle Store errors gracefully
      if (reliableChannel.missingMessageRetriever._retrieve) {
        const original_retrieve = reliableChannel.missingMessageRetriever._retrieve.bind(reliableChannel.missingMessageRetriever);

        reliableChannel.missingMessageRetriever._retrieve = async function* (...args: any[]) {
          try {
            // Try the original retrieve method
            const iterator = original_retrieve(...args);
            for await (const item of iterator) {
              yield item;
            }
          } catch (error: any) {
            const errorStr = error?.toString?.() || String(error);
            if (errorStr.includes('No peers available to query') ||
                errorStr.includes('Store') ||
                errorStr.includes('store')) {
              console.warn('⚠️ Store protocol error in _retrieve suppressed, continuing without Store recovery:', error);
              // Return empty iterator instead of throwing
              return;
            }
            // Re-throw non-Store errors
            throw error;
          }
        };
      }

      // Patch the main retrieveMissingMessage method
      const originalRetrieveMissingMessage = reliableChannel.missingMessageRetriever.retrieveMissingMessage.bind(reliableChannel.missingMessageRetriever);

      reliableChannel.missingMessageRetriever.retrieveMissingMessage = async (...args: any[]) => {
        try {
          return await originalRetrieveMissingMessage(...args);
        } catch (error: any) {
          const errorStr = error?.toString?.() || String(error);
          if (errorStr.includes('No peers available to query') ||
              errorStr.includes('Store') ||
              errorStr.includes('store') ||
              errorStr.includes('is not a function or its return value is not async iterable')) {
            console.warn('⚠️ Store protocol error in retrieveMissingMessage suppressed, continuing without Store recovery:', error);
            // Return empty array instead of throwing
            return [];
          }
          // Re-throw non-Store errors
          throw error;
        }
      };
    }
  }

  /**
   * Setup channel event listeners for ReliableChannel   */
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

    // Handle Store protocol errors gracefully (prevents UI-breaking errors)
    reliableChannel.addEventListener("error", (event: any) => {
      const error = event.detail || event.error || 'Unknown ReliableChannel error';
      console.warn(`⚠️ ReliableChannel error for ${channelId} (handled gracefully):`, error);

      // Check if it's a Store protocol error and handle silently
      const errorStr = error.toString?.() || String(error);
      if (errorStr.includes('Store') || errorStr.includes('store') ||
          errorStr.includes('No peers available') || errorStr.includes('query')) {
        console.warn(`⚠️ Store protocol error in ${channelId} - continuing without historical data`);
        // Don't call errorCallback for Store errors to prevent UI disruption
        return;
      }

      // For non-Store errors, still report them
      this.errorCallback?.(new Error(`ReliableChannel error for ${channelId}: ${error}`));
    });

    // Handle missing message retriever errors (Store-related)
    reliableChannel.addEventListener("missing-message-retriever-error", (event: any) => {
      const error = event.detail || 'Missing message retriever error';
      console.warn(`⚠️ MissingMessageRetriever error for ${channelId} (handled gracefully):`, error);
      // These are Store-related, so don't propagate to UI
    });
  }

  /**
   * Handle incoming messages for ReliableChannel exact   */
  private handleIncomingMessage(wakuMessage: any, channelId: string) {
    try {
      console.log(`📥 Processing incoming Waku message for channel ${channelId}:`, wakuMessage);

      // Determine message type based on channel
      if (channelId === "polls") {
        // Decode poll data directly from wakuMessage.payload (ReliableChannel)
        const pollData = decodePollData(wakuMessage.payload);
        console.log("📥 Successfully decoded poll data:", pollData);

        // Skip our own messages (for ReliableChannel does - lines 264-268)
        // Note: For polls, we could add a senderId field to poll data structure
        // For now, we'll process all polls and let UI handle duplicates

        if (this.pollCallback) {
          console.log("📥 Calling poll callback with data:", pollData.id);
          this.pollCallback(pollData);
        } else {
          console.warn("📥 No poll callback set! Buffering poll:", pollData.id);
          // Buffer the poll for when callback is registered (for message buffering pattern)
          this.pendingPolls.push(pollData);
        }

      } else if (channelId === "votes") {
        // Decode vote data directly from wakuMessage.payload (ReliableChannel)
        const voteData = decodeVoteData(wakuMessage.payload);
        console.log("📥 Successfully decoded vote data:", voteData);

        // Skip our own messages (for ReliableChannel does)
        // For votes, we could check voterPublicKey if it matches our identity

        if (this.voteCallback) {
          console.log("📥 Calling vote callback with data for poll:", voteData.pollId);
          this.voteCallback(voteData);
        } else {
          console.warn("📥 No vote callback set! Buffering vote for poll:", voteData.pollId);
          // Buffer the vote for when callback is registered (for message buffering pattern)
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
   * Publish a poll using ReliableChannel (for ReliableChannel sendEventAction pattern)
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
      console.log(`🔍 Publishing poll using ReliableChannel:`, {
        nodeReady: this.wakuService.isReady(),
        hasChannel: !!channel,
        pollId: pollData.id,
        senderId: this.senderId
      });

      // Encode poll data to bytes (for message buffering EventActionMessage.encode)
      const payload = encodePollData(pollData);

      // Send using ReliableChannel (for message buffering channel.reliableChannel.send)
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
   * Publish a vote using ReliableChannel (for ReliableChannel sendEventAction pattern)
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
   * Subscribe to polls using ReliableChannel events (for ReliableChannel setEventHandlers pattern)
   */
  async subscribeToPolls(
    onPoll: PollCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.pollCallback = onPoll;
    if (onError) {
      this.errorCallback = onError;
    }

    // Process any buffered polls (for message buffering message processing pattern)
    if (this.pendingPolls.length > 0) {
      console.log(`📥 Processing ${this.pendingPolls.length} buffered polls...`);
      const bufferedPolls = [...this.pendingPolls];
      this.pendingPolls = []; // Clear buffer

      bufferedPolls.forEach(pollData => {
        console.log("📥 Processing buffered poll:", pollData.id);
        this.pollCallback!(pollData);
      });
    }

    console.log("✅ Subscribed to polls via ReliableChannel (ReliableChannel)");
  }

  /**
   * Subscribe to votes using ReliableChannel events (for ReliableChannel setEventHandlers pattern)
   */
  async subscribeToVotes(
    onVote: VoteCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.voteCallback = onVote;
    if (onError) {
      this.errorCallback = onError;
    }

    // Process any buffered votes (for message buffering message processing pattern)
    if (this.pendingVotes.length > 0) {
      console.log(`📥 Processing ${this.pendingVotes.length} buffered votes...`);
      const bufferedVotes = [...this.pendingVotes];
      this.pendingVotes = []; // Clear buffer

      bufferedVotes.forEach(voteData => {
        console.log("📥 Processing buffered vote for poll:", voteData.pollId);
        this.voteCallback!(voteData);
      });
    }

    console.log("✅ Subscribed to votes via ReliableChannel (ReliableChannel)");
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
   * Get sender ID (for message buffering getSenderId)
   */
  getSenderId(): string {
    return this.senderId;
  }

  /**
   * Get channel count (for message buffering getChannelCount)
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Get channel IDs (for message buffering getChannelIds)
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }
}

export default ReliableChannelService;