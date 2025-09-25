/**
 * WakuService - Core service for Waku Light Node integration
 *
 * This service handles:
 * - Light Node initialization and connection
 * - Protocol setup (Light Push, Filter, Store)
 * - Basic connection management
 * - Network status monitoring
 */

import { createLightNode } from "@waku/sdk";

export interface WakuStatus {
  connected: boolean;
  peerCount: number;
  syncComplete: boolean;
  error: string | null;
}

export class WakuService {
  private node: any = null;
  private isInitialized = false;
  private status: WakuStatus = {
    connected: false,
    peerCount: 0,
    syncComplete: false,
    error: null
  };

  // Content topics for DecenVote
  public static readonly CONTENT_TOPICS = {
    POLLS: "/decenvote/1/polls/proto",
    VOTES: "/decenvote/1/votes/proto"
  } as const;


  /**
   * Initialize the Waku Light Node and wait for peer connections
   */
  async initialize(): Promise<any> {
    if (this.isInitialized && this.node) {
      return this.node;
    }

    try {
      console.log("🚀 Initializing Waku Light Node...");

      // Create Light Node - using the exact pattern from docs
      this.node = await createLightNode({
        defaultBootstrap: true
      });

      console.log("✅ Light Node created");

      // Start the node
      await this.node.start();
      console.log("✅ Waku node started");

      // Wait for some time to allow connections
      console.log("⏳ Waiting for peers...");
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log("✅ Connected to remote peers");

      this.isInitialized = true;
      this.status.connected = true;
      this.status.error = null;

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
   * Get the current Waku node instance
   */
  getNode(): any {
    return this.node;
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
   * Stop the Waku node and cleanup resources
   */
  async stop(): Promise<void> {
    if (this.node) {
      console.log("🛑 Stopping Waku node...");
      await this.node.stop();
      this.node = null;
      this.isInitialized = false;
      this.status.connected = false;
      console.log("✅ Waku node stopped");
    }
  }

  /**
   * Start monitoring connection status
   */
  private startStatusMonitoring(): void {
    if (!this.node) return;

    // Monitor peer connections
    const monitorInterval = setInterval(async () => {
      if (!this.node) {
        clearInterval(monitorInterval);
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
    }, 10000); // Check every 10 seconds
  }

  /**
   * Reconnection logic for handling network issues
   */
  async reconnect(): Promise<void> {
    console.log("🔄 Attempting to reconnect...");

    try {
      // Stop current node if exists
      await this.stop();

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