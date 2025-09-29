/**
 * DataProcessor - Handles processing of incoming poll and vote data
 *
 * This service manages data callbacks, buffering, and processing
 * for different data types in the polling application.
 */

import {
  decodePollData,
  decodeVoteData,
  type IPollData,
  type IVoteData,
} from "../ProtobufSchemas";
import { DataValidator } from "../validators/DataValidator";

export type PollCallback = (poll: IPollData) => void;
export type VoteCallback = (vote: IVoteData) => void;
export type ErrorCallback = (error: Error) => void;

export class DataProcessor {
  // Callback functions
  private pollCallback: PollCallback | null = null;
  private voteCallback: VoteCallback | null = null;
  private errorCallback: ErrorCallback | null = null;

  // Data buffers for early data
  private pendingPolls: IPollData[] = [];
  private pendingVotes: IVoteData[] = [];

  /**
   * Process incoming data based on channel type
   */
  processIncomingData(payload: Uint8Array, channelId: string): void {
    try {
      console.log(`📥 Processing incoming data for channel ${channelId}`);

      if (channelId === "polls") {
        this.processPollData(payload);
      } else if (channelId === "votes") {
        this.processVoteData(payload);
      } else {
        console.warn(`Unknown channel ID: ${channelId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to process data for channel ${channelId}:`, error);
      this.errorCallback?.(new Error(`Failed to process data: ${error}`));
    }
  }

  /**
   * Process poll data
   */
  private processPollData(payload: Uint8Array): void {
    try {
      const pollData = decodePollData(payload);
      console.log("📥 Successfully decoded poll data:", pollData.id);

      // Validate poll data
      if (!DataValidator.validatePoll(pollData)) {
        console.warn("📥 Invalid poll data received, skipping");
        return;
      }

      if (this.pollCallback) {
        console.log("📥 Calling poll callback with data:", pollData.id);
        this.pollCallback(pollData);
      } else {
        console.warn("📥 No poll callback set! Buffering poll:", pollData.id);
        this.pendingPolls.push(pollData);
      }
    } catch (error) {
      console.error("❌ Failed to decode poll data:", error);
      this.errorCallback?.(new Error(`Failed to decode poll: ${error}`));
    }
  }

  /**
   * Process vote data
   */
  private processVoteData(payload: Uint8Array): void {
    try {
      const voteData = decodeVoteData(payload);
      console.log("📥 Successfully decoded vote data for poll:", voteData.pollId);

      // Validate vote data
      if (!DataValidator.validateVote(voteData)) {
        console.warn("📥 Invalid vote data received, skipping");
        return;
      }

      if (this.voteCallback) {
        console.log("📥 Calling vote callback for poll:", voteData.pollId);
        this.voteCallback(voteData);
      } else {
        console.warn("📥 No vote callback set! Buffering vote:", voteData.pollId);
        this.pendingVotes.push(voteData);
      }
    } catch (error) {
      console.error("❌ Failed to decode vote data:", error);
      this.errorCallback?.(new Error(`Failed to decode vote: ${error}`));
    }
  }

  /**
   * Set poll callback and process buffered data
   */
  setPollCallback(callback: PollCallback): void {
    this.pollCallback = callback;
    this.processPendingPolls();
  }

  /**
   * Set vote callback and process buffered data
   */
  setVoteCallback(callback: VoteCallback): void {
    this.voteCallback = callback;
    this.processPendingVotes();
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * Process buffered polls
   */
  private processPendingPolls(): void {
    if (this.pendingPolls.length > 0 && this.pollCallback) {
      console.log(`📥 Processing ${this.pendingPolls.length} buffered polls...`);
      const bufferedPolls = [...this.pendingPolls];
      this.pendingPolls = [];

      bufferedPolls.forEach(pollData => {
        console.log("📥 Processing buffered poll:", pollData.id);
        this.pollCallback!(pollData);
      });
    }
  }

  /**
   * Process buffered votes
   */
  private processPendingVotes(): void {
    if (this.pendingVotes.length > 0 && this.voteCallback) {
      console.log(`📥 Processing ${this.pendingVotes.length} buffered votes...`);
      const bufferedVotes = [...this.pendingVotes];
      this.pendingVotes = [];

      bufferedVotes.forEach(voteData => {
        console.log("📥 Processing buffered vote for poll:", voteData.pollId);
        this.voteCallback!(voteData);
      });
    }
  }

  /**
   * Clear poll callback
   */
  clearPollCallback(): void {
    this.pollCallback = null;
  }

  /**
   * Clear vote callback
   */
  clearVoteCallback(): void {
    this.voteCallback = null;
  }

  /**
   * Check if callbacks are active
   */
  hasActiveCallbacks(): boolean {
    return this.pollCallback !== null || this.voteCallback !== null;
  }

  /**
   * Get pending data counts
   */
  getPendingCounts(): { polls: number; votes: number } {
    return {
      polls: this.pendingPolls.length,
      votes: this.pendingVotes.length
    };
  }

  /**
   * Clear all buffers
   */
  clearBuffers(): void {
    this.pendingPolls = [];
    this.pendingVotes = [];
  }
}

export default DataProcessor;