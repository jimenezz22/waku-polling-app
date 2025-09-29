/**
 * ChannelManager - Manages ReliableChannel instances for different data types
 *
 * This service handles the creation, configuration, and lifecycle of channels
 * used for real-time data transmission in the polling application.
 */

import { ReliableChannel } from "@waku/sdk";
import { WakuConfig } from "../config/WakuConfig";

export interface Channel {
  channelId: string;
  reliableChannel: any;
  encoder: any;
  decoder: any;
}

export class ChannelManager {
  private channels: Map<string, Channel> = new Map();
  private senderId: string;
  private node: any;

  constructor(node: any) {
    this.node = node;
    this.senderId = this.generateSenderId();
  }

  /**
   * Generate a unique sender ID for this instance
   */
  private generateSenderId(): string {
    return `decenvote-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create and configure a channel for a specific data type
   */
  async createChannel(channelId: string): Promise<Channel | null> {
    if (!this.node) {
      console.error("❌ No Waku node available for channel creation");
      return null;
    }

    if (this.channels.has(channelId)) {
      console.log(`Channel ${channelId} already exists`);
      return this.channels.get(channelId)!;
    }

    try {
      console.log(`🔄 Creating channel for: ${channelId}`);

      // Use configuration for content topic
      const contentTopic = WakuConfig.getChannelTopic(channelId);

      // Create encoder and decoder
      const encoder = this.node.createEncoder({ contentTopic });
      const decoder = this.node.createDecoder({ contentTopic });

      // Create reliable channel
      const reliableChannel = await ReliableChannel.create(
        this.node,
        channelId,
        this.senderId,
        encoder,
        decoder
      );

      // Store the channel
      const channel: Channel = {
        channelId,
        reliableChannel,
        encoder,
        decoder
      };

      this.channels.set(channelId, channel);
      console.log(`✅ Channel created for: ${channelId} with topic: ${contentTopic}`);

      return channel;

    } catch (error) {
      console.error(`❌ Failed to create channel for ${channelId}:`, error);
      return null;
    }
  }

  /**
   * Get a channel by ID
   */
  getChannel(channelId: string): Channel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Remove a channel
   */
  removeChannel(channelId: string): boolean {
    return this.channels.delete(channelId);
  }

  /**
   * Get all channel IDs
   */
  getChannelIds(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Get channel count
   */
  getChannelCount(): number {
    return this.channels.size;
  }

  /**
   * Check if a channel exists
   */
  hasChannel(channelId: string): boolean {
    return this.channels.has(channelId);
  }

  /**
   * Get the sender ID
   */
  getSenderId(): string {
    return this.senderId;
  }

  /**
   * Clear all channels
   */
  clearChannels(): void {
    this.channels.clear();
  }
}

export default ChannelManager;