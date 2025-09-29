/**
 * WakuConfig - Centralized configuration for Waku services
 *
 * This module provides a single source of truth for all Waku-related
 * configuration, making it easier to modify settings without changing code.
 */

export interface WakuNodeConfig {
  defaultBootstrap: boolean;
  bootstrapPeers: string[];
  connectionTimeout: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
  peerStabilizationDelay: number;
}

export interface ContentTopicConfig {
  polls: string;
  votes: string;
}

export interface RoutingConfig {
  pubsubTopic: string;
  clusterId: number;
  shardId: number;
}

export interface MonitoringConfig {
  statusCheckInterval: number;
  healthCheckInterval: number;
}

export class WakuConfig {
  /**
   * Node configuration for Waku Light Node
   */
  static readonly NODE: WakuNodeConfig = {
    defaultBootstrap: true,
    bootstrapPeers: [
      '/dns4/waku.fryorcraken.xyz/tcp/8000/wss/p2p/16Uiu2HAmMRvhDHrtiHft1FTUYnn6cVA8AWVrTyLUayJJ3MWpUZDB'
    ],
    connectionTimeout: 45000,  // 45 seconds
    reconnectDelay: 3000,      // 3 seconds
    maxReconnectAttempts: 3,
    peerStabilizationDelay: 2000  // 2 seconds
  };

  /**
   * Content topics for different data types
   */
  static readonly CONTENT_TOPICS: ContentTopicConfig = {
    polls: "/decenvote/1/polls/proto",
    votes: "/decenvote/1/votes/proto"
  };

  /**
   * Dynamic content topics for ReliableChannel
   */
  static readonly CHANNEL_TOPICS = {
    polls: "/polling-app/1/polls/messages",
    votes: "/polling-app/1/votes/messages"
  };

  /**
   * Default routing configuration for Store protocol
   */
  static readonly ROUTING: RoutingConfig = {
    pubsubTopic: "/waku/2/default-waku/proto",
    clusterId: 1,
    shardId: 0
  };

  /**
   * Monitoring and health check intervals
   */
  static readonly MONITORING: MonitoringConfig = {
    statusCheckInterval: 10000,  // 10 seconds
    healthCheckInterval: 30000   // 30 seconds
  };

  /**
   * Protocol-specific timeouts
   */
  static readonly PROTOCOL_TIMEOUTS = {
    lightPush: 15000,    // 15 seconds
    filter: 10000,       // 10 seconds
    store: 10000,        // 10 seconds
    default: 120000      // 2 minutes (fallback)
  };

  /**
   * Get content topic for a specific data type
   */
  static getContentTopic(dataType: 'polls' | 'votes'): string {
    return this.CONTENT_TOPICS[dataType];
  }

  /**
   * Get channel topic for ReliableChannel
   */
  static getChannelTopic(channelId: string): string {
    return `/polling-app/1/${channelId}/messages`;
  }

  /**
   * Check if a bootstrap peer is configured
   */
  static hasBootstrapPeers(): boolean {
    return this.NODE.defaultBootstrap || this.NODE.bootstrapPeers.length > 0;
  }
}

export default WakuConfig;