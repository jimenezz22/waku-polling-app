# Waku Implementation Guide for DecenVote

This guide provides comprehensive implementation patterns for building DecenVote using **Waku SDK 0.0.35** with **ReliableChannel** for real-time bidirectional communication. It reflects the current modular architecture with centralized configuration and validation.

## Table of Contents

1. [Project Setup](#project-setup)
2. [Light Node Configuration](#light-node-configuration)
3. [Data Structure with Protobuf](#data-structure-with-protobuf)
4. [ReliableChannel Implementation](#reliablechannel-implementation)
5. [Store Protocol Integration](#store-protocol-integration)
6. [Identity Management](#identity-management)
7. [Modular Service Architecture](#modular-service-architecture)
8. [Complete Implementation Examples](#complete-implementation-examples)

---

## Project Setup

### Required Dependencies (Waku SDK 0.0.35)

```bash
# Core Waku SDK 0.0.35 with ReliableChannel support
npm install @waku/sdk@0.0.35

# Additional required packages
npm install protobufjs @waku/message-encryption @waku/utils

# Development dependencies for browser compatibility
npm install --save-dev @craco/craco
npm install --save-dev assert buffer crypto-browserify https-browserify os-browserify process stream-browserify stream-http url util
```

### Craco Configuration for Browser Compatibility

Create `craco.config.js` for Node.js polyfills:

```javascript
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        // ... other polyfills
      };

      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
      ];

      return webpackConfig;
    },
  },
};
```

---

## Light Node Configuration

### WakuService Implementation

```typescript
// src/services/WakuService.ts
import { createLightNode, Protocols, LightNode } from "@waku/sdk";
import { WakuConfig } from "./config/WakuConfig";

export class WakuService {
  private node: LightNode | null = null;
  private isStarted = false;

  async initialize(): Promise<LightNode> {
    try {
      this.node = await createLightNode({
        defaultBootstrap: WakuConfig.NODE.defaultBootstrap,
        bootstrapPeers: WakuConfig.NODE.bootstrapPeers,
      });

      await this.node.start();

      // Wait for peer connections with timeout
      await Promise.race([
        this.node.waitForPeers([Protocols.LightPush, Protocols.Filter, Protocols.Store]),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), WakuConfig.NODE.connectionTimeout)
        )
      ]);

      this.isStarted = true;
      console.log('Waku node started successfully');
      return this.node;
    } catch (error) {
      console.error('Failed to initialize Waku node:', error);
      throw error;
    }
  }

  getNode(): LightNode | null {
    return this.node;
  }

  isConnected(): boolean {
    return this.isStarted && this.node !== null;
  }

  async stop(): Promise<void> {
    if (this.node) {
      await this.node.stop();
      this.node = null;
      this.isStarted = false;
    }
  }
}
```

### Centralized Configuration (WakuConfig)

```typescript
// src/services/config/WakuConfig.ts
export interface WakuNodeConfig {
  defaultBootstrap: boolean;
  bootstrapPeers: string[];
  connectionTimeout: number;
  reconnectDelay: number;
  maxReconnectAttempts: number;
}

export class WakuConfig {
  static readonly NODE: WakuNodeConfig = {
    defaultBootstrap: true,
    bootstrapPeers: [
      "/dns4/node-01.do-ams3.waku.test.statusim.net/tcp/8000/wss/p2p/16Uiu2HAmJb2e28qLXxT5kZxVUUoJt72EMzNGXB47RedcBafeDCBA",
    ],
    connectionTimeout: 45000,
    reconnectDelay: 3000,
    maxReconnectAttempts: 3,
  };

  static readonly CONTENT_TOPICS = {
    polls: "/decenvote/1/polls/proto",
    votes: "/decenvote/1/votes/proto",
  };

  static readonly RELIABLE_CHANNEL_TOPICS = {
    polls: "/polling-app/1/polls/messages",
    votes: "/polling-app/1/votes/messages",
  };

  static readonly PROTOCOL_TIMEOUTS = {
    lightPush: 15000,
    filter: 10000,
    store: 10000,
  };
}
```

---

## Data Structure with Protobuf

### DecenVote Data Schema Implementation

```typescript
// src/services/ProtobufSchemas.ts
import protobuf from "protobufjs";

// Poll Data Structure
const PollDataSchema = new protobuf.Type("PollData")
  .add(new protobuf.Field("id", 1, "string"))
  .add(new protobuf.Field("question", 2, "string"))
  .add(new protobuf.Field("options", 3, "string", "repeated"))
  .add(new protobuf.Field("createdBy", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));

// Vote Data Structure
const VoteDataSchema = new protobuf.Type("VoteData")
  .add(new protobuf.Field("pollId", 1, "string"))
  .add(new protobuf.Field("optionIndex", 2, "uint32"))
  .add(new protobuf.Field("voterPublicKey", 3, "string"))
  .add(new protobuf.Field("signature", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));

// TypeScript interfaces
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

// Encoder/Decoder functions
export const PollDataCodec = {
  encode: (data: IPollData): Uint8Array => {
    const message = PollDataSchema.create(data);
    return PollDataSchema.encode(message).finish();
  },

  decode: (buffer: Uint8Array): IPollData => {
    return PollDataSchema.decode(buffer) as IPollData;
  }
};

export const VoteDataCodec = {
  encode: (data: IVoteData): Uint8Array => {
    const message = VoteDataSchema.create(data);
    return VoteDataSchema.encode(message).finish();
  },

  decode: (buffer: Uint8Array): IVoteData => {
    return VoteDataSchema.decode(buffer) as IVoteData;
  }
};
```

### Data Validation

```typescript
// src/services/validators/DataValidator.ts
import { IPollData, IVoteData } from "../ProtobufSchemas";

export class DataValidator {
  static validatePoll(poll: IPollData): boolean {
    if (!poll?.id || !poll?.question || !poll?.createdBy) {
      return false;
    }

    if (!Array.isArray(poll.options) || poll.options.length < 2) {
      return false;
    }

    if (poll.options.some(option => !option?.trim())) {
      return false;
    }

    if (typeof poll.timestamp !== 'number' || poll.timestamp <= 0) {
      return false;
    }

    return true;
  }

  static validateVote(vote: IVoteData): boolean {
    if (!vote?.pollId || !vote?.voterPublicKey) {
      return false;
    }

    if (typeof vote.optionIndex !== 'number' || vote.optionIndex < 0) {
      return false;
    }

    if (typeof vote.timestamp !== 'number' || vote.timestamp <= 0) {
      return false;
    }

    return true;
  }

  static validatePolls(polls: IPollData[]): IPollData[] {
    return polls.filter(poll => this.validatePoll(poll));
  }

  static validateVotes(votes: IVoteData[]): IVoteData[] {
    return votes.filter(vote => this.validateVote(vote));
  }
}
```

---

## ReliableChannel Implementation

### ChannelManager - ReliableChannel Lifecycle Management

```typescript
// src/services/channels/ChannelManager.ts
import { LightNode, ReliableChannel } from "@waku/sdk";
import { WakuConfig } from "../config/WakuConfig";

export class ChannelManager {
  private channels = new Map<string, ReliableChannel>();
  private node: LightNode;

  constructor(node: LightNode) {
    this.node = node;
  }

  async createChannel(contentTopic: string): Promise<ReliableChannel> {
    if (this.channels.has(contentTopic)) {
      return this.channels.get(contentTopic)!;
    }

    try {
      const channel = await this.node.createReliableChannel({
        contentTopic,
        senderId: this.generateSenderId(),
      });

      this.channels.set(contentTopic, channel);
      console.log(`ReliableChannel created for topic: ${contentTopic}`);
      return channel;
    } catch (error) {
      console.error(`Failed to create ReliableChannel for ${contentTopic}:`, error);
      throw error;
    }
  }

  getChannel(contentTopic: string): ReliableChannel | undefined {
    return this.channels.get(contentTopic);
  }

  async closeChannel(contentTopic: string): Promise<void> {
    const channel = this.channels.get(contentTopic);
    if (channel) {
      await channel.close();
      this.channels.delete(contentTopic);
    }
  }

  async closeAllChannels(): Promise<void> {
    for (const [topic, channel] of this.channels) {
      try {
        await channel.close();
      } catch (error) {
        console.error(`Error closing channel ${topic}:`, error);
      }
    }
    this.channels.clear();
  }

  private generateSenderId(): string {
    return `sender_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### DataProcessor - Data Processing and Buffering

```typescript
// src/services/channels/DataProcessor.ts
import { IPollData, IVoteData } from "../ProtobufSchemas";
import { DataValidator } from "../validators/DataValidator";

export type PollCallback = (poll: IPollData) => void;
export type VoteCallback = (vote: IVoteData) => void;
export type ErrorCallback = (error: Error) => void;

export class DataProcessor {
  private pollBuffer: IPollData[] = [];
  private voteBuffer: IVoteData[] = [];
  private isReady = false;

  private pollCallbacks: PollCallback[] = [];
  private voteCallbacks: VoteCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];

  setReady(ready: boolean): void {
    this.isReady = ready;
    if (ready) {
      this.flushBuffers();
    }
  }

  processPoll(poll: IPollData): void {
    if (!DataValidator.validatePoll(poll)) {
      this.notifyError(new Error(`Invalid poll data: ${poll.id}`));
      return;
    }

    if (this.isReady) {
      this.notifyPollCallbacks(poll);
    } else {
      this.pollBuffer.push(poll);
    }
  }

  processVote(vote: IVoteData): void {
    if (!DataValidator.validateVote(vote)) {
      this.notifyError(new Error(`Invalid vote data for poll: ${vote.pollId}`));
      return;
    }

    if (this.isReady) {
      this.notifyVoteCallbacks(vote);
    } else {
      this.voteBuffer.push(vote);
    }
  }

  addPollCallback(callback: PollCallback): void {
    this.pollCallbacks.push(callback);
  }

  addVoteCallback(callback: VoteCallback): void {
    this.voteCallbacks.push(callback);
  }

  addErrorCallback(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  private flushBuffers(): void {
    this.pollBuffer.forEach(poll => this.notifyPollCallbacks(poll));
    this.voteBuffer.forEach(vote => this.notifyVoteCallbacks(vote));
    this.pollBuffer = [];
    this.voteBuffer = [];
  }

  private notifyPollCallbacks(poll: IPollData): void {
    this.pollCallbacks.forEach(callback => {
      try {
        callback(poll);
      } catch (error) {
        this.notifyError(error as Error);
      }
    });
  }

  private notifyVoteCallbacks(vote: IVoteData): void {
    this.voteCallbacks.forEach(callback => {
      try {
        callback(vote);
      } catch (error) {
        this.notifyError(error as Error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (callbackError) {
        console.error('Error in error callback:', callbackError);
      }
    });
  }
}
```

### ReliableChannelService - Real-time Communication Orchestrator

```typescript
// src/services/protocols/ReliableChannelService.ts
import { LightNode } from "@waku/sdk";
import { IPollData, IVoteData, PollDataCodec, VoteDataCodec } from "../ProtobufSchemas";
import { WakuConfig } from "../config/WakuConfig";
import { ChannelManager } from "../channels/ChannelManager";
import { DataProcessor, PollCallback, VoteCallback, ErrorCallback } from "../channels/DataProcessor";
import { StoreErrorPatcher } from "../utils/StoreErrorPatcher";

export class ReliableChannelService {
  private channelManager: ChannelManager;
  private dataProcessor: DataProcessor;
  private storeErrorPatcher: StoreErrorPatcher;
  private isSubscribed = false;

  constructor(private node: LightNode) {
    this.channelManager = new ChannelManager(node);
    this.dataProcessor = new DataProcessor();
    this.storeErrorPatcher = new StoreErrorPatcher();
  }

  async publishPoll(poll: IPollData): Promise<void> {
    try {
      const channel = await this.channelManager.createChannel(
        WakuConfig.RELIABLE_CHANNEL_TOPICS.polls
      );
      const payload = PollDataCodec.encode(poll);
      await channel.send(payload);
      console.log(`Poll published: ${poll.id}`);
    } catch (error) {
      console.error('Failed to publish poll:', error);
      throw error;
    }
  }

  async publishVote(vote: IVoteData): Promise<void> {
    try {
      const channel = await this.channelManager.createChannel(
        WakuConfig.RELIABLE_CHANNEL_TOPICS.votes
      );
      const payload = VoteDataCodec.encode(vote);
      await channel.send(payload);
      console.log(`Vote published for poll: ${vote.pollId}`);
    } catch (error) {
      console.error('Failed to publish vote:', error);
      throw error;
    }
  }

  async subscribeToPolls(callback: PollCallback, errorCallback?: ErrorCallback): Promise<void> {
    this.dataProcessor.addPollCallback(callback);
    if (errorCallback) {
      this.dataProcessor.addErrorCallback(errorCallback);
    }

    if (!this.isSubscribed) {
      await this.setupSubscriptions();
    }
  }

  async subscribeToVotes(callback: VoteCallback, errorCallback?: ErrorCallback): Promise<void> {
    this.dataProcessor.addVoteCallback(callback);
    if (errorCallback) {
      this.dataProcessor.addErrorCallback(errorCallback);
    }

    if (!this.isSubscribed) {
      await this.setupSubscriptions();
    }
  }

  private async setupSubscriptions(): Promise<void> {
    try {
      // Setup poll subscriptions
      const pollChannel = await this.channelManager.createChannel(
        WakuConfig.RELIABLE_CHANNEL_TOPICS.polls
      );

      await pollChannel.subscribe((payload: Uint8Array) => {
        try {
          const poll = PollDataCodec.decode(payload);
          this.dataProcessor.processPoll(poll);
        } catch (error) {
          console.error('Failed to decode poll:', error);
        }
      });

      // Setup vote subscriptions
      const voteChannel = await this.channelManager.createChannel(
        WakuConfig.RELIABLE_CHANNEL_TOPICS.votes
      );

      await voteChannel.subscribe((payload: Uint8Array) => {
        try {
          const vote = VoteDataCodec.decode(payload);
          this.dataProcessor.processVote(vote);
        } catch (error) {
          console.error('Failed to decode vote:', error);
        }
      });

      this.isSubscribed = true;
      this.dataProcessor.setReady(true);
      console.log('ReliableChannel subscriptions established');
    } catch (error) {
      const patchedError = this.storeErrorPatcher.patchStoreError(error as Error);
      if (patchedError.shouldContinue) {
        console.warn('Store protocol unavailable, continuing with real-time only');
        this.dataProcessor.setReady(true);
      } else {
        throw patchedError.error;
      }
    }
  }

  async cleanup(): Promise<void> {
    await this.channelManager.closeAllChannels();
    this.isSubscribed = false;
  }
}
```

---

## Store Protocol Integration

### StoreService - Historical Data Loading

```typescript
// src/services/protocols/StoreService.ts
import { LightNode, createDecoder } from "@waku/sdk";
import { IPollData, IVoteData, PollDataCodec, VoteDataCodec } from "../ProtobufSchemas";
import { DataValidator } from "../validators/DataValidator";
import { WakuConfig } from "../config/WakuConfig";

export class StoreService {
  constructor(private node: LightNode) {}

  async loadHistoricalPolls(): Promise<IPollData[]> {
    return this.loadHistoricalData<IPollData>(
      WakuConfig.CONTENT_TOPICS.polls,
      PollDataCodec.decode,
      DataValidator.validatePoll
    );
  }

  async loadHistoricalVotes(): Promise<IVoteData[]> {
    return this.loadHistoricalData<IVoteData>(
      WakuConfig.CONTENT_TOPICS.votes,
      VoteDataCodec.decode,
      DataValidator.validateVote
    );
  }

  private async loadHistoricalData<T>(
    contentTopic: string,
    decoder: (buffer: Uint8Array) => T,
    validator: (data: T) => boolean
  ): Promise<T[]> {
    const data: T[] = [];

    try {
      const storeDecoder = createDecoder(contentTopic);

      await this.node.store.queryWithOrderedCallback(
        [storeDecoder],
        (wakuMessage) => {
          if (!wakuMessage.payload) return;

          try {
            const decodedData = decoder(wakuMessage.payload);
            if (validator(decodedData)) {
              data.push(decodedData);
            } else {
              console.warn(`Invalid data received from Store for topic: ${contentTopic}`);
            }
          } catch (error) {
            console.error(`Failed to decode data from Store:`, error);
          }
        },
        {
          timeFilter: {
            startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            endTime: new Date(),
          },
        }
      );

      console.log(`Loaded ${data.length} items from Store for topic: ${contentTopic}`);
      return data;
    } catch (error) {
      console.warn(`Store protocol unavailable for topic ${contentTopic}:`, error);
      return [];
    }
  }
}
```
```

### StoreErrorPatcher - Graceful Error Handling

```typescript
// src/services/utils/StoreErrorPatcher.ts
export interface PatchedError {
  error: Error;
  shouldContinue: boolean;
}

export class StoreErrorPatcher {
  patchStoreError(error: Error): PatchedError {
    const errorMessage = error.message.toLowerCase();

    // Check for known Store protocol errors
    if (
      errorMessage.includes('no store peers available') ||
      errorMessage.includes('store query failed') ||
      errorMessage.includes('no peers available') ||
      errorMessage.includes('peer not found')
    ) {
      console.warn('Store protocol error detected, continuing without Store:', error.message);
      return {
        error: new Error('Store protocol unavailable - app will work with real-time data only'),
        shouldContinue: true
      };
    }

    // Check for timeout errors
    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out')
    ) {
      console.warn('Store protocol timeout, continuing without Store:', error.message);
      return {
        error: new Error('Store protocol timeout - app will work with real-time data only'),
        shouldContinue: true
      };
    }

    // For other errors, don't continue
    return {
      error,
      shouldContinue: false
    };
  }
}
```

---

## Identity Management

### IdentityService - Cryptographic Identity Management

```typescript
// src/services/IdentityService.ts
import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";

export interface IIdentity {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  privateKeyHex: string;
  publicKeyHex: string;
}

export class IdentityService {
  private static readonly STORAGE_KEY = 'decenvote_identity';
  private identity: IIdentity | null = null;

  generateIdentity(): IIdentity {
    const privateKey = generatePrivateKey();
    const publicKey = getPublicKey(privateKey);

    return {
      privateKey,
      publicKey,
      privateKeyHex: bytesToHex(privateKey),
      publicKeyHex: bytesToHex(publicKey)
    };
  }

  getOrCreateIdentity(): IIdentity {
    if (this.identity) {
      return this.identity;
    }

    // Try to load from localStorage
    const stored = this.loadFromStorage();
    if (stored) {
      this.identity = stored;
      return stored;
    }

    // Generate new identity
    this.identity = this.generateIdentity();
    this.saveToStorage(this.identity);
    return this.identity;
  }

  private loadFromStorage(): IIdentity | null {
    try {
      const stored = localStorage.getItem(IdentityService.STORAGE_KEY);
      if (!stored) return null;

      const { privateKeyHex } = JSON.parse(stored);
      const privateKey = hexToBytes(privateKeyHex);
      const publicKey = getPublicKey(privateKey);

      return {
        privateKey,
        publicKey,
        privateKeyHex,
        publicKeyHex: bytesToHex(publicKey)
      };
    } catch (error) {
      console.error('Failed to load identity from storage:', error);
      return null;
    }
  }

  private saveToStorage(identity: IIdentity): void {
    try {
      const toStore = {
        privateKeyHex: identity.privateKeyHex,
        publicKeyHex: identity.publicKeyHex
      };
      localStorage.setItem(IdentityService.STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save identity to storage:', error);
    }
  }

  clearIdentity(): void {
    this.identity = null;
    localStorage.removeItem(IdentityService.STORAGE_KEY);
  }

  getCurrentIdentity(): IIdentity | null {
    return this.identity;
  }
}
```

---

## Modular Service Architecture

### DataService - Unified API Orchestrator

```typescript
// src/services/DataService.ts
import { LightNode } from "@waku/sdk";
import { IPollData, IVoteData } from "./ProtobufSchemas";
import { ReliableChannelService } from "./protocols/ReliableChannelService";
import { StoreService } from "./protocols/StoreService";
import { IdentityService } from "./IdentityService";
import { PollCallback, VoteCallback, ErrorCallback } from "./channels/DataProcessor";

export class DataService {
  private reliableChannelService: ReliableChannelService;
  private storeService: StoreService;
  private identityService: IdentityService;

  constructor(node: LightNode) {
    this.reliableChannelService = new ReliableChannelService(node);
    this.storeService = new StoreService(node);
    this.identityService = new IdentityService();
  }

  // Real-time operations
  async publishPoll(poll: IPollData): Promise<void> {
    return this.reliableChannelService.publishPoll(poll);
  }

  async publishVote(vote: IVoteData): Promise<void> {
    return this.reliableChannelService.publishVote(vote);
  }

  async subscribeToPolls(callback: PollCallback, errorCallback?: ErrorCallback): Promise<void> {
    return this.reliableChannelService.subscribeToPolls(callback, errorCallback);
  }

  async subscribeToVotes(callback: VoteCallback, errorCallback?: ErrorCallback): Promise<void> {
    return this.reliableChannelService.subscribeToVotes(callback, errorCallback);
  }

  // Historical data operations
  async loadHistoricalPolls(): Promise<IPollData[]> {
    return this.storeService.loadHistoricalPolls();
  }

  async loadHistoricalVotes(): Promise<IVoteData[]> {
    return this.storeService.loadHistoricalVotes();
  }

  // Identity operations
  getOrCreateIdentity() {
    return this.identityService.getOrCreateIdentity();
  }

  getCurrentIdentity() {
    return this.identityService.getCurrentIdentity();
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.reliableChannelService.cleanup();
  }
}
```

### Integration Example

```typescript
// Usage in React component or service
import { WakuService } from "./services/WakuService";
import { DataService } from "./services/DataService";
import { IPollData, IVoteData } from "./services/ProtobufSchemas";

class DecenVoteApp {
  private wakuService: WakuService;
  private dataService: DataService;

  async initialize() {
    // Initialize Waku node
    this.wakuService = new WakuService();
    const node = await this.wakuService.initialize();

    // Initialize DataService
    this.dataService = new DataService(node);

    // Setup subscriptions
    await this.dataService.subscribeToPolls(
      this.handleNewPoll.bind(this),
      this.handleError.bind(this)
    );

    await this.dataService.subscribeToVotes(
      this.handleNewVote.bind(this),
      this.handleError.bind(this)
    );

    // Load historical data
    const historicalPolls = await this.dataService.loadHistoricalPolls();
    const historicalVotes = await this.dataService.loadHistoricalVotes();

    console.log(`Loaded ${historicalPolls.length} polls and ${historicalVotes.length} votes`);
  }

  async createPoll(question: string, options: string[]): Promise<void> {
    const identity = this.dataService.getOrCreateIdentity();

    const poll: IPollData = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      options,
      createdBy: identity.publicKeyHex,
      timestamp: Date.now()
    };

    await this.dataService.publishPoll(poll);
  }

  async castVote(pollId: string, optionIndex: number): Promise<void> {
    const identity = this.dataService.getOrCreateIdentity();

    const vote: IVoteData = {
      pollId,
      optionIndex,
      voterPublicKey: identity.publicKeyHex,
      signature: "", // Add proper signing implementation
      timestamp: Date.now()
    };

    await this.dataService.publishVote(vote);
  }

  private handleNewPoll(poll: IPollData): void {
    console.log('New poll received:', poll);
    // Update UI
  }

  private handleNewVote(vote: IVoteData): void {
    console.log('New vote received:', vote);
    // Update UI
  }

  private handleError(error: Error): void {
    console.error('DataService error:', error);
    // Show error notification
  }

  async cleanup(): Promise<void> {
    await this.dataService.cleanup();
    await this.wakuService.stop();
  }
}
```

---

## Complete Implementation Examples

### Custom React Hook Integration

```typescript
// src/hooks/usePolls.ts
import { useState, useEffect } from 'react';
import { IPollData } from '../services/ProtobufSchemas';
import { DataService } from '../services/DataService';

export const usePolls = (dataService: DataService | null) => {
  const [polls, setPolls] = useState<IPollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataService) return;

    const initializePolls = async () => {
      try {
        // Load historical polls
        const historicalPolls = await dataService.loadHistoricalPolls();
        setPolls(historicalPolls);

        // Subscribe to new polls
        await dataService.subscribeToPolls(
          (newPoll: IPollData) => {
            setPolls(prev => {
              const exists = prev.some(p => p.id === newPoll.id);
              return exists ? prev : [...prev, newPoll];
            });
          },
          (err: Error) => {
            setError(err.message);
          }
        );

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load polls');
        setLoading(false);
      }
    };

    initializePolls();
  }, [dataService]);

  const createPoll = async (question: string, options: string[]): Promise<void> => {
    if (!dataService) throw new Error('DataService not available');

    const identity = dataService.getOrCreateIdentity();
    const poll: IPollData = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      options,
      createdBy: identity.publicKeyHex,
      timestamp: Date.now()
    };

    await dataService.publishPoll(poll);
  };

  return { polls, loading, error, createPoll };
};

### React Component Example

```typescript
// src/components/PollCreation.tsx
import React, { useState } from 'react';
import { DataValidator } from '../services/validators/DataValidator';
import { usePolls } from '../hooks/usePolls';

interface PollCreationProps {
  dataService: DataService | null;
}

export const PollCreation: React.FC<PollCreationProps> = ({ dataService }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createPoll } = usePolls(dataService);

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate before creating
      const validOptions = options.filter(opt => opt.trim().length > 0);

      if (!question.trim()) {
        throw new Error('Question is required');
      }

      if (validOptions.length < 2) {
        throw new Error('At least 2 options are required');
      }

      setIsSubmitting(true);
      await createPoll(question.trim(), validOptions);

      // Reset form
      setQuestion('');
      setOptions(['', '']);
    } catch (error) {
      console.error('Failed to create poll:', error);
      alert(error instanceof Error ? error.message : 'Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="poll-creation">
      <div>
        <label>Question:</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Enter your poll question"
          required
        />
      </div>

      <div>
        <label>Options:</label>
        {options.map((option, index) => (
          <div key={index} className="option-input">
            <input
              type="text"
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              required
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
              >
                Remove
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addOption}>
          Add Option
        </button>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating...' : 'Create Poll'}
      </button>
    </form>
  );
};
```

This implementation guide provides a complete reference for building decentralized applications with Waku SDK 0.0.35, focusing on the ReliableChannel protocol and modular architecture patterns used in DecenVote.
```

