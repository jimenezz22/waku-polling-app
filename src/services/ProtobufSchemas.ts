/**
 * ProtobufSchemas - Message structure definitions for DecenVote
 *
 * This file defines the Protobuf message schemas for polls and votes.
 * Using protobufjs to create type-safe message structures for Waku communication.
 *
 * Note: We use "Data" suffix instead of "Message" to avoid confusion with
 * Waku message objects.
 */

import protobuf from "protobufjs";

/**
 * PollData - Structure for poll creation messages
 *
 * Fields:
 * - id: Unique poll identifier
 * - question: The poll question text
 * - options: Array of poll options (must have at least 2)
 * - createdBy: Public key of poll creator
 * - timestamp: Unix timestamp of poll creation
 */
export const PollData = new protobuf.Type("PollData")
  .add(new protobuf.Field("id", 1, "string"))
  .add(new protobuf.Field("question", 2, "string"))
  .add(new protobuf.Field("options", 3, "string", "repeated"))
  .add(new protobuf.Field("createdBy", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));

/**
 * VoteData - Structure for vote submission messages
 *
 * Fields:
 * - pollId: ID of the poll being voted on
 * - optionIndex: Index of the selected option (0-based)
 * - voterPublicKey: Public key of the voter (for deduplication)
 * - signature: Cryptographic signature for vote verification
 * - timestamp: Unix timestamp of vote submission
 */
export const VoteData = new protobuf.Type("VoteData")
  .add(new protobuf.Field("pollId", 1, "string"))
  .add(new protobuf.Field("optionIndex", 2, "uint32"))
  .add(new protobuf.Field("voterPublicKey", 3, "string"))
  .add(new protobuf.Field("signature", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));

/**
 * TypeScript interfaces for type safety
 * These match the Protobuf definitions above
 */

export interface IPollData {
  id: string;
  question: string;
  options: string[];
  createdBy: string;
  timestamp: number;
}

export interface IVoteData {
  pollId: string;
  optionIndex: number;
  voterPublicKey: string;
  signature: string;
  timestamp: number;
}

/**
 * Utility functions for working with the schemas
 */

/**
 * Create a poll data object with validation
 */
export function createPollData(data: IPollData): any {
  const poll = PollData.create(data);
  const error = PollData.verify(poll);

  if (error) {
    throw new Error(`Invalid poll data: ${error}`);
  }

  return poll;
}

/**
 * Create a vote data object with validation
 */
export function createVoteData(data: IVoteData): any {
  const vote = VoteData.create(data);
  const error = VoteData.verify(vote);

  if (error) {
    throw new Error(`Invalid vote data: ${error}`);
  }

  return vote;
}

/**
 * Encode poll data to bytes for transmission
 */
export function encodePollData(data: IPollData): Uint8Array {
  const poll = createPollData(data);
  return PollData.encode(poll).finish();
}

/**
 * Decode poll data from bytes
 */
export function decodePollData(bytes: Uint8Array): IPollData {
  const decoded = PollData.decode(bytes);
  return PollData.toObject(decoded) as IPollData;
}

/**
 * Encode vote data to bytes for transmission
 */
export function encodeVoteData(data: IVoteData): Uint8Array {
  const vote = createVoteData(data);
  return VoteData.encode(vote).finish();
}

/**
 * Decode vote data from bytes
 */
export function decodeVoteData(bytes: Uint8Array): IVoteData {
  const decoded = VoteData.decode(bytes);
  return VoteData.toObject(decoded) as IVoteData;
}