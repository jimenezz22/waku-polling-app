/**
 * WakuService - Core service for Waku Light Node integration
 *
 * This service handles:
 * - Light Node initialization and connection
 * - Protocol setup (Light Push, Filter, Store)
 * - Basic connection management
 * - Network status monitoring
 */

import { createLightNode, waitForRemotePeer, Protocols } from "@waku/sdk";
import { WakuConfig } from "./config/WakuConfig";

export interface WakuStatus {
  connected: boolean;
  peerCount: number;
  syncComplete: boolean;
  error: string | null;
}

export class WakuService {
  private node: any = null;
  private isInitialized = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, any> = new Map();
  private status: WakuStatus = {
    connected: false,
    peerCount: 0,
    syncComplete: false,
    error: null
  };

  // Content topics from config
  public static readonly CONTENT_TOPICS = WakuConfig.CONTENT_TOPICS;


  /**
   * Check if Waku service is initialized
   */
  checkIsInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get the Waku node instance
   */
  getNode(): any {
    return this.node;
  }

  /**
   * Wait for LightPush peers with retries
   */
  async waitForLightPushPeers(): Promise<void> {
    if (!this.node) {
      throw new Error("Waku node not initialized");
    }

    console.log("🔄 Checking for LightPush peers...");

    let attempts = 3;

    while (attempts > 0) {
      try {
        await waitForRemotePeer(this.node, [Protocols.LightPush], WakuConfig.PROTOCOL_TIMEOUTS.lightPush);

        // Verify we actually have peers
        const connections = this.node.libp2p.getConnections();
        console.log(`📊 Found ${connections.length} total connections`);

        if (connections.length > 0) {
          console.log("✅ LightPush peers found and verified");
          return;
        }
      } catch (error) {
        console.warn(`⚠️ Attempt ${4 - attempts}/3 failed:`, error);
      }

      attempts--;

      if (attempts > 0) {
        console.log("🔁 Retrying peer discovery...");
        await new Promise(resolve => setTimeout(resolve, WakuConfig.NODE.reconnectDelay));
      }
    }

    console.error("❌ Failed to find LightPush peers after 3 attempts");
    throw new Error("No LightPush peers available");
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: WakuStatus) => void): () => void {
    // Create a simple listener pattern
    const statusListener = setInterval(() => {
      callback(this.getStatus());
    }, 1000);

    // Return cleanup function
    return () => clearInterval(statusListener);
  }

  /**
   * Initialize the Waku Light Node and wait for peer connections
   */
  async initialize(): Promise<any> {
    if (this.isInitialized && this.node) {
      return this.node;
    }

    try {
      console.log("🚀 Initializing Waku Light Node...");

      // Create Light Node with configuration
      this.node = await createLightNode({
        defaultBootstrap: WakuConfig.NODE.defaultBootstrap,
        bootstrapPeers: WakuConfig.NODE.bootstrapPeers
      });

      console.log("✅ Light Node created");

      // Start the node
      await this.node.start();
      console.log("✅ Waku node started");

      // Let the node auto-discover peers (since we're using defaultBootstrap: true)
      console.log("🔄 Letting node discover peers automatically...");

      // Wait for peers with proper protocol support
      console.log("⏳ Waiting for peers with required protocols...");
      try {
        // First, wait for LightPush specifically (needed for creating polls)
        await waitForRemotePeer(this.node, [Protocols.LightPush], WakuConfig.NODE.connectionTimeout);
        console.log("✅ LightPush peer found");

        // Give peers time to stabilize
        console.log("⏳ Letting peers stabilize...");
        await new Promise(resolve => setTimeout(resolve, WakuConfig.NODE.peerStabilizationDelay));

        // Then try to get Filter and Store (best effort)
        try {
          await waitForRemotePeer(this.node, [
            Protocols.Filter,     // For real-time updates
            Protocols.Store       // For loading historical data
          ], WakuConfig.PROTOCOL_TIMEOUTS.filter);
          console.log("✅ Connected to remote peers with all protocols");
        } catch (storeError) {
          console.warn("⚠️ Store/Filter peers not found, but LightPush is available");
        }
      } catch (error) {
        console.error("❌ No LightPush peers found. Polls creation will not work:", error);
        this.status.error = "No LightPush peers available";
        // Continue anyway - user will see the error when trying to create polls
      }

      this.isInitialized = true;
      this.status.connected = true;
      // Only clear error if we don't have a LightPush error
      if (this.status.error !== "No LightPush peers available") {
        this.status.error = null;
      }

      // Get peer count
      try {
        const connections = this.node.libp2p.getConnections();
        this.status.peerCount = connections.length;
      } catch (error) {
        console.warn("Could not get connection count:", error);
        this.status.peerCount = 0;
      }

      console.log(`🎉 Waku node fully initialized! Connected to ${this.status.peerCount} peers`);

      // Start monitoring connection status
      this.startStatusMonitoring();

      return this.node;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("❌ Failed to initialize Waku node:", errorMessage);

      this.status.connected = false;
      this.status.error = errorMessage;
      this.isInitialized = false;

      // Clean up on error
      if (this.node) {
        try {
          await this.node.stop();
        } catch (e) {
          console.error("Failed to stop node after error:", e);
        }
        this.node = null;
      }

      throw new Error(`Waku initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Check if the service is initialized and ready
   */
  isReady(): boolean {
    return this.isInitialized && this.node !== null && this.status.connected;
  }

  /**
   * Get current connection status
   */
  getStatus(): WakuStatus {
    return { ...this.status };
  }

  /**
   * Cleanup all resources - CRITICAL for preventing memory leaks
   */
  async cleanup(): Promise<void> {
    console.log("🧹 Starting cleanup...");

    // Clear monitoring interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log("✅ Cleared monitoring interval");
    }

    // Unsubscribe all active subscriptions
    this.subscriptions.forEach(async (subscription, topic) => {
      try {
        if (subscription && subscription.unsubscribe) {
          await subscription.unsubscribe();
        }
        console.log(`✅ Unsubscribed from ${topic}`);
      } catch (error) {
        console.warn(`⚠️ Failed to unsubscribe from ${topic}:`, error);
      }
    });
    this.subscriptions.clear();

    // Stop the node
    if (this.node) {
      try {
        await this.node.stop();
        console.log("✅ Waku node stopped");
      } catch (error) {
        console.error("❌ Error stopping node:", error);
      }
      this.node = null;
    }

    // Reset status
    this.isInitialized = false;
    this.status = {
      connected: false,
      peerCount: 0,
      syncComplete: false,
      error: null
    };

    console.log("✅ Cleanup complete");
  }

  /**
   * Stop the Waku node and cleanup resources
   * @deprecated Use cleanup() instead
   */
  async stop(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Start monitoring connection status
   */
  private startStatusMonitoring(): void {
    if (!this.node) return;

    // Clear any existing interval
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    // Monitor peer connections
    this.monitorInterval = setInterval(async () => {
      if (!this.node) {
        if (this.monitorInterval) {
          clearInterval(this.monitorInterval);
          this.monitorInterval = null;
        }
        return;
      }

      try {
        if (this.node && this.node.libp2p) {
          const connections = this.node.libp2p.getConnections();
          this.status.peerCount = connections.length;
          this.status.connected = connections.length > 0;

          if (!this.status.connected) {
            console.warn("⚠️ Lost connection to all peers");
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not update peer count:", error);
      }
    }, WakuConfig.MONITORING.statusCheckInterval);
  }

  /**
   * Register a subscription for cleanup tracking
   * Used to prevent duplicate subscriptions and ensure cleanup
   */
  registerSubscription(topic: string, subscription: any): void {
    // Unsubscribe from existing subscription if it exists
    const existing = this.subscriptions.get(topic);
    if (existing && existing.unsubscribe) {
      existing.unsubscribe().catch((error: any) => {
        console.warn(`Failed to cleanup existing subscription for ${topic}:`, error);
      });
    }

    // Store new subscription
    this.subscriptions.set(topic, subscription);
    console.log(`📝 Registered subscription for ${topic}`);
  }

  /**
   * Get a registered subscription
   */
  getSubscription(topic: string): any {
    return this.subscriptions.get(topic);
  }

  /**
   * Reconnection logic for handling network issues
   */
  async reconnect(): Promise<void> {
    console.log("🔄 Attempting to reconnect...");

    try {
      // Cleanup current node if exists
      await this.cleanup();

      // Re-initialize
      await this.initialize();

      console.log("✅ Reconnection successful");
    } catch (error) {
      console.error("❌ Reconnection failed:", error);
      throw error;
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<boolean> {
    if (!this.isReady() || !this.node) {
      return false;
    }

    try {
      // Check if we have active connections
      if (this.node && this.node.libp2p) {
        const connections = this.node.libp2p.getConnections();
        return connections.length > 0;
      }
      return false;
    } catch (error) {
      console.warn("⚠️ Health check failed:", error);
      return false;
    }
  }
}

// Export singleton instance for simple usage
export const wakuService = new WakuService();

// Export for testing with custom options
export default WakuService;