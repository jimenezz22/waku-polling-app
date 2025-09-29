/**
 * DataValidator - Centralized validation for poll and vote data
 *
 * This module provides reusable validation logic for data types
 * used across different services, ensuring consistency and reducing duplication.
 */

import type { IPollData, IVoteData } from "../ProtobufSchemas";

export class DataValidator {
  /**
   * Validate poll data structure
   * @param poll - Poll data to validate
   * @returns true if valid, false otherwise
   */
  static validatePoll(poll: IPollData): boolean {
    if (!poll?.id || !poll?.question || !poll?.createdBy) {
      console.debug("❌ Invalid poll data: missing required fields");
      return false;
    }

    if (!poll.options || poll.options.length < 2) {
      console.debug("❌ Invalid poll data: must have at least 2 options");
      return false;
    }

    if (!poll.timestamp) {
      console.debug("❌ Invalid poll data: missing timestamp");
      return false;
    }

    return true;
  }

  /**
   * Validate vote data structure
   * @param vote - Vote data to validate
   * @returns true if valid, false otherwise
   */
  static validateVote(vote: IVoteData): boolean {
    if (!vote?.pollId || !vote?.voterPublicKey) {
      console.debug("❌ Invalid vote data: missing required fields");
      return false;
    }

    if (vote.optionIndex === null || vote.optionIndex === undefined) {
      console.debug("❌ Invalid vote data: missing optionIndex");
      return false;
    }

    if (!vote.timestamp) {
      console.debug("❌ Invalid vote data: missing timestamp");
      return false;
    }

    return true;
  }

  /**
   * Validate a batch of polls
   * @param polls - Array of polls to validate
   * @returns Array of valid polls
   */
  static filterValidPolls(polls: IPollData[]): IPollData[] {
    return polls.filter(poll => this.validatePoll(poll));
  }

  /**
   * Validate a batch of votes
   * @param votes - Array of votes to validate
   * @returns Array of valid votes
   */
  static filterValidVotes(votes: IVoteData[]): IVoteData[] {
    return votes.filter(vote => this.validateVote(vote));
  }
}

export default DataValidator;