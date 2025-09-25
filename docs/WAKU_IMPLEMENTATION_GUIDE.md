# DecenVote: Comprehensive Waku JS Implementation Guide

This guide provides all the necessary code examples and patterns to implement DecenVote using Waku JS SDK, based on the official documentation.

## Table of Contents

1. [Project Setup](#project-setup)
2. [Light Node Configuration](#light-node-configuration)
3. [Message Structure with Protobuf](#message-structure-with-protobuf)
4. [Light Push Protocol (Publishing)](#light-push-protocol-publishing)
5. [Filter Protocol (Real-time Subscriptions)](#filter-protocol-real-time-subscriptions)
6. [Store Protocol (Historical Data)](#store-protocol-historical-data)
7. [Waku Identity System](#waku-identity-system)
8. [React Integration](#react-integration)
9. [Complete Implementation Examples](#complete-implementation-examples)

---

## Project Setup

### Installation

```bash
# Core packages
npm install @waku/sdk protobufjs

# For encryption/signing (identity system)
npm install @waku/message-encryption @waku/utils
```

### CDN Alternative (No Build Tools)

```js
import * as waku from "https://unpkg.com/@waku/sdk@latest/bundle/index.js";
import "https://cdn.jsdelivr.net/npm/protobufjs@latest/dist/protobuf.min.js";
```

---

## Light Node Configuration

### Basic Light Node Setup

```js
import { createLightNode, Protocols } from "@waku/sdk";

// Create and start a Light Node
const node = await createLightNode({ defaultBootstrap: true });
await node.start();

// Wait for peer connections
await node.waitForPeers([Protocols.LightPush, Protocols.Filter, Protocols.Store]);

// Stop the node when done
// await node.stop();
```

### Auto-sharding Configuration (Recommended)

```js
const node = await createLightNode({
  defaultBootstrap: true,
  networkConfig: {
    clusterId: 1,
    contentTopics: [
      "/decenvote/1/polls/proto",
      "/decenvote/1/votes/proto"
    ],
  },
});
```

### Static Sharding Configuration

```js
const node = await createLightNode({
  defaultBootstrap: true,
  networkConfig: {
    clusterId: 1,
    shards: [0, 1, 2, 3],
  },
});
```

### Custom Store Peer Configuration

```js
const node = await createLightNode({
  defaultBootstrap: true,
  store: {
    peer: "/ip4/1.2.3.4/tcp/1234/p2p/16Uiu2HAm..." // Your Store node multiaddr
  }
});
```

---

## Message Structure with Protobuf

### DecenVote Message Structures

```js
import protobuf from "protobufjs";

// Poll Message Structure
const PollMessage = new protobuf.Type("PollMessage")
  .add(new protobuf.Field("id", 1, "string"))
  .add(new protobuf.Field("question", 2, "string"))
  .add(new protobuf.Field("options", 3, "string", "repeated"))
  .add(new protobuf.Field("createdBy", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));

// Vote Message Structure
const VoteMessage = new protobuf.Type("VoteMessage")
  .add(new protobuf.Field("pollId", 1, "string"))
  .add(new protobuf.Field("optionIndex", 2, "uint32"))
  .add(new protobuf.Field("voterPublicKey", 3, "string"))
  .add(new protobuf.Field("signature", 4, "string"))
  .add(new protobuf.Field("timestamp", 5, "uint64"));
```

### Content Topics and Encoders/Decoders

```js
import { createEncoder, createDecoder } from "@waku/sdk";

// Content topics
const POLLS_CONTENT_TOPIC = "/decenvote/1/polls/proto";
const VOTES_CONTENT_TOPIC = "/decenvote/1/votes/proto";

// Create encoders and decoders
const pollEncoder = createEncoder({ contentTopic: POLLS_CONTENT_TOPIC });
const pollDecoder = createDecoder(POLLS_CONTENT_TOPIC);

const voteEncoder = createEncoder({ contentTopic: VOTES_CONTENT_TOPIC });
const voteDecoder = createDecoder(VOTES_CONTENT_TOPIC);

// For ephemeral messages (not stored)
const ephemeralEncoder = createEncoder({
  contentTopic: POLLS_CONTENT_TOPIC,
  ephemeral: true, // Won't be stored by Store peers
});
```

---

## Light Push Protocol (Publishing)

### Publishing Polls

```js
// Create a new poll
const createPoll = async (question, options, creatorPublicKey) => {
  const pollData = {
    id: generatePollId(), // Your ID generation logic
    question: question,
    options: options,
    createdBy: creatorPublicKey,
    timestamp: Date.now()
  };

  // Serialize the message
  const protoMessage = PollMessage.create(pollData);
  const serializedMessage = PollMessage.encode(protoMessage).finish();

  // Send using Light Push
  const result = await node.lightPush.send(pollEncoder, {
    payload: serializedMessage,
  });

  if (result.recipients.length > 0) {
    console.log("Poll published successfully");
    return pollData;
  } else {
    console.error("Failed to publish poll:", result.errors);
    throw new Error("Failed to publish poll");
  }
};
```

### Publishing Votes

```js
// Cast a vote
const castVote = async (pollId, optionIndex, voterPrivateKey, voterPublicKey) => {
  const voteData = {
    pollId: pollId,
    optionIndex: optionIndex,
    voterPublicKey: voterPublicKey,
    signature: "", // Will be filled after signing
    timestamp: Date.now()
  };

  // Sign the vote (see Identity System section)
  const signature = await signVote(voteData, voterPrivateKey);
  voteData.signature = signature;

  // Serialize the message
  const protoMessage = VoteMessage.create(voteData);
  const serializedMessage = VoteMessage.encode(protoMessage).finish();

  // Send using Light Push
  const result = await node.lightPush.send(voteEncoder, {
    payload: serializedMessage,
  });

  if (result.recipients.length > 0) {
    console.log("Vote cast successfully");
    return voteData;
  } else {
    console.error("Failed to cast vote:", result.errors);
    throw new Error("Failed to cast vote");
  }
};
```

---

## Filter Protocol (Real-time Subscriptions)

### Setting up Filter Subscriptions

```js
// Create filter subscriptions
const setupFilterSubscriptions = async () => {
  // Create subscriptions for both content topics
  const { error: pollsError, subscription: pollsSubscription } =
    await node.filter.createSubscription({
      contentTopics: [POLLS_CONTENT_TOPIC]
    });

  const { error: votesError, subscription: votesSubscription } =
    await node.filter.createSubscription({
      contentTopics: [VOTES_CONTENT_TOPIC]
    });

  if (pollsError || votesError) {
    throw new Error("Failed to create subscriptions");
  }

  // Subscribe to new polls
  await pollsSubscription.subscribe([pollDecoder], (wakuMessage) => {
    if (!wakuMessage.payload) return;

    try {
      const pollData = PollMessage.decode(wakuMessage.payload);
      onNewPoll(pollData); // Your callback function
    } catch (error) {
      console.error("Failed to decode poll message:", error);
    }
  });

  // Subscribe to new votes
  await votesSubscription.subscribe([voteDecoder], (wakuMessage) => {
    if (!wakuMessage.payload) return;

    try {
      const voteData = VoteMessage.decode(wakuMessage.payload);
      onNewVote(voteData); // Your callback function
    } catch (error) {
      console.error("Failed to decode vote message:", error);
    }
  });

  return { pollsSubscription, votesSubscription };
};
```

### Managing Filter Subscriptions

```js
// Ping and reinitiate subscriptions on disconnection
const pingAndReinitiateSubscription = async (subscription, decoder, callback) => {
  try {
    await subscription.ping();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("peer has no subscriptions")
    ) {
      // Reinitiate the subscription if the ping fails
      await subscription.subscribe([decoder], callback);
      console.log("Subscription reinitiated");
    } else {
      throw error;
    }
  }
};

// Periodically ping subscriptions
setInterval(async () => {
  await pingAndReinitiateSubscription(pollsSubscription, pollDecoder, pollCallback);
  await pingAndReinitiateSubscription(votesSubscription, voteDecoder, voteCallback);
}, 30000); // Every 30 seconds
```

### Unsubscribing

```js
// Unsubscribe from content topics
await pollsSubscription.unsubscribe([POLLS_CONTENT_TOPIC]);
await votesSubscription.unsubscribe([VOTES_CONTENT_TOPIC]);
```

---

## Store Protocol (Historical Data)

### Retrieving Historical Polls

```js
// Query for all historical polls
const loadHistoricalPolls = async () => {
  const polls = [];

  const callback = (wakuMessage) => {
    if (!wakuMessage.payload) return;

    try {
      const pollData = PollMessage.decode(wakuMessage.payload);
      polls.push(pollData);
    } catch (error) {
      console.error("Failed to decode historical poll:", error);
    }
  };

  // Query Store peers for historical polls
  await node.store.queryWithOrderedCallback([pollDecoder], callback);

  return polls;
};
```

### Retrieving Historical Votes

```js
// Query for all historical votes
const loadHistoricalVotes = async () => {
  const votes = [];

  const callback = (wakuMessage) => {
    if (!wakuMessage.payload) return;

    try {
      const voteData = VoteMessage.decode(wakuMessage.payload);
      votes.push(voteData);
    } catch (error) {
      console.error("Failed to decode historical vote:", error);
    }
  };

  // Query Store peers for historical votes
  await node.store.queryWithOrderedCallback([voteDecoder], callback);

  return votes;
};
```

### Store Query Options

```js
import { PageDirection, waku } from "@waku/sdk";

// Query with time filter (last 24 hours)
const loadRecentPolls = async () => {
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(endTime.getDate() - 1);

  const queryOptions = {
    timeFilter: {
      startTime,
      endTime,
    },
    pageDirection: PageDirection.BACKWARD, // Most recent first
  };

  const polls = [];
  const callback = (wakuMessage) => {
    if (!wakuMessage.payload) return;
    const pollData = PollMessage.decode(wakuMessage.payload);
    polls.push(pollData);
  };

  await node.store.queryWithOrderedCallback([pollDecoder], callback, queryOptions);
  return polls;
};

// Query with pagination using cursor
const loadPollsWithPagination = async () => {
  let allPolls = [];
  let cursor = null;

  do {
    const polls = [];
    const callback = (wakuMessage) => {
      if (!wakuMessage.payload) return;
      const pollData = PollMessage.decode(wakuMessage.payload);
      polls.push(pollData);
      return polls.length >= 10; // Stop after 10 messages per page
    };

    const options = cursor ? { cursor } : {};
    await node.store.queryWithOrderedCallback([pollDecoder], callback, options);

    allPolls = allPolls.concat(polls);

    // Create cursor for next page
    if (polls.length > 0) {
      const lastMessage = polls[polls.length - 1];
      cursor = await waku.createCursor(lastMessage);
    } else {
      cursor = null; // No more messages
    }
  } while (cursor);

  return allPolls;
};
```

### Using Query Generator (Advanced)

```js
// Using async generator for more control
const loadVotesWithGenerator = async () => {
  const votes = [];
  const storeQuery = node.store.queryGenerator([voteDecoder]);

  for await (const messagesPromises of storeQuery) {
    const messages = await Promise.all(
      messagesPromises.map(async (p) => {
        try {
          const msg = await p;
          if (msg.payload) {
            return VoteMessage.decode(msg.payload);
          }
        } catch (error) {
          console.error("Failed to decode vote:", error);
        }
        return null;
      })
    );

    votes.push(...messages.filter(Boolean));
  }

  return votes;
};
```

---

## Waku Identity System

### Generating Identity Keys

```js
import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";

// Generate a new identity
const generateIdentity = () => {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);

  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey)
  };
};

// Restore identity from stored hex keys
const restoreIdentity = (privateKeyHex) => {
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = getPublicKey(privateKey);

  return {
    privateKey,
    publicKey,
    privateKeyHex,
    publicKeyHex: bytesToHex(publicKey)
  };
};
```

### Local Storage Management

```js
// Store identity in localStorage
const storeIdentity = (identity) => {
  localStorage.setItem('decenvote_identity', JSON.stringify({
    privateKeyHex: identity.privateKeyHex,
    publicKeyHex: identity.publicKeyHex
  }));
};

// Load identity from localStorage
const loadIdentity = () => {
  const stored = localStorage.getItem('decenvote_identity');
  if (stored) {
    const { privateKeyHex } = JSON.parse(stored);
    return restoreIdentity(privateKeyHex);
  }
  return null;
};

// Get or create identity
const getOrCreateIdentity = () => {
  let identity = loadIdentity();
  if (!identity) {
    identity = generateIdentity();
    storeIdentity(identity);
  }
  return identity;
};
```

### Signing Votes

```js
import { createEncoder } from "@waku/message-encryption/symmetric";
import { generateSymmetricKey } from "@waku/message-encryption";

// Create a signing encoder (uses symmetric encryption with deterministic key)
const createSigningEncoder = (contentTopic, sigPrivKey) => {
  // Use a deterministic symmetric key for signing-only purposes
  const symmetricKey = generateSymmetricKey(); // In real app, use app-wide key

  return createEncoder({
    contentTopic: contentTopic,
    symKey: symmetricKey,
    sigPrivKey: sigPrivKey, // Private key for signing
  });
};

// Sign and send a vote
const signAndSendVote = async (voteData, voterPrivateKey) => {
  // Create encoder with signing capability
  const signingEncoder = createSigningEncoder(VOTES_CONTENT_TOPIC, voterPrivateKey);

  // Serialize the message
  const protoMessage = VoteMessage.create(voteData);
  const serializedMessage = VoteMessage.encode(protoMessage).finish();

  // Send with signature
  const result = await node.lightPush.send(signingEncoder, {
    payload: serializedMessage,
  });

  return result;
};
```

### Verifying Vote Signatures

```js
import { createDecoder } from "@waku/message-encryption/symmetric";

// Create a decoder for signed messages
const createSigningDecoder = (contentTopic) => {
  const symmetricKey = generateSymmetricKey(); // Same key as encoder
  return createDecoder(contentTopic, symmetricKey);
};

// Verify vote in callback
const verifyVoteCallback = (wakuMessage) => {
  if (!wakuMessage.payload) return;

  try {
    const voteData = VoteMessage.decode(wakuMessage.payload);

    // Check if message is signed
    if (wakuMessage.signaturePublicKey) {
      const expectedPublicKey = hexToBytes(voteData.voterPublicKey);

      // Verify signature matches the claimed voter
      if (wakuMessage.verifySignature(expectedPublicKey)) {
        console.log("Vote signature verified");
        onVerifiedVote(voteData);
      } else {
        console.log("Vote signature verification failed");
      }
    } else {
      console.log("Vote has no signature");
    }
  } catch (error) {
    console.error("Failed to verify vote:", error);
  }
};
```

---

## Complete Implementation Examples

### Poll Management System

```js
class PollManager {
  constructor(node, identity) {
    this.node = node;
    this.identity = identity;
    this.polls = new Map();
    this.votes = new Map();

    this.setupEncodersDecoders();
    this.setupSubscriptions();
    this.loadHistoricalData();
  }

  setupEncodersDecoders() {
    this.pollEncoder = createEncoder({ contentTopic: POLLS_CONTENT_TOPIC });
    this.pollDecoder = createDecoder(POLLS_CONTENT_TOPIC);
    this.voteEncoder = createEncoder({ contentTopic: VOTES_CONTENT_TOPIC });
    this.voteDecoder = createDecoder(VOTES_CONTENT_TOPIC);
  }

  async setupSubscriptions() {
    // Create filter subscriptions
    const { subscription: pollsSubscription } =
      await this.node.filter.createSubscription({
        contentTopics: [POLLS_CONTENT_TOPIC]
      });

    const { subscription: votesSubscription } =
      await this.node.filter.createSubscription({
        contentTopics: [VOTES_CONTENT_TOPIC]
      });

    // Subscribe to new polls
    await pollsSubscription.subscribe([this.pollDecoder], (wakuMessage) => {
      this.handleNewPoll(wakuMessage);
    });

    // Subscribe to new votes
    await votesSubscription.subscribe([this.voteDecoder], (wakuMessage) => {
      this.handleNewVote(wakuMessage);
    });
  }

  async loadHistoricalData() {
    // Load historical polls
    await this.node.store.queryWithOrderedCallback([this.pollDecoder], (wakuMessage) => {
      this.handleNewPoll(wakuMessage);
    });

    // Load historical votes
    await this.node.store.queryWithOrderedCallback([this.voteDecoder], (wakuMessage) => {
      this.handleNewVote(wakuMessage);
    });
  }

  handleNewPoll(wakuMessage) {
    if (!wakuMessage.payload) return;

    try {
      const pollData = PollMessage.decode(wakuMessage.payload);
      this.polls.set(pollData.id, pollData);
      this.onPollUpdate?.(pollData);
    } catch (error) {
      console.error("Failed to decode poll:", error);
    }
  }

  handleNewVote(wakuMessage) {
    if (!wakuMessage.payload) return;

    try {
      const voteData = VoteMessage.decode(wakuMessage.payload);

      // Check for duplicate votes
      if (this.hasVoted(voteData.pollId, voteData.voterPublicKey)) {
        console.log("Duplicate vote detected, ignoring");
        return;
      }

      const voteKey = `${voteData.pollId}_${voteData.voterPublicKey}`;
      this.votes.set(voteKey, voteData);
      this.onVoteUpdate?.(voteData);
    } catch (error) {
      console.error("Failed to decode vote:", error);
    }
  }

  async createPoll(question, options) {
    const pollData = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      options,
      createdBy: this.identity.publicKeyHex,
      timestamp: Date.now()
    };

    const protoMessage = PollMessage.create(pollData);
    const payload = PollMessage.encode(protoMessage).finish();

    const result = await this.node.lightPush.send(this.pollEncoder, { payload });

    if (result.recipients.length > 0) {
      return pollData;
    } else {
      throw new Error("Failed to publish poll");
    }
  }

  async castVote(pollId, optionIndex) {
    // Check if user already voted
    if (this.hasVoted(pollId, this.identity.publicKeyHex)) {
      throw new Error("You have already voted on this poll");
    }

    const voteData = {
      pollId,
      optionIndex,
      voterPublicKey: this.identity.publicKeyHex,
      signature: "", // Implement proper signing
      timestamp: Date.now()
    };

    const protoMessage = VoteMessage.create(voteData);
    const payload = VoteMessage.encode(protoMessage).finish();

    const result = await this.node.lightPush.send(this.voteEncoder, { payload });

    if (result.recipients.length > 0) {
      return voteData;
    } else {
      throw new Error("Failed to cast vote");
    }
  }

  hasVoted(pollId, voterPublicKey) {
    const voteKey = `${pollId}_${voterPublicKey}`;
    return this.votes.has(voteKey);
  }

  getPollResults(pollId) {
    const poll = this.polls.get(pollId);
    if (!poll) return null;

    const pollVotes = Array.from(this.votes.values())
      .filter(vote => vote.pollId === pollId);

    const results = poll.options.map((option, index) => ({
      option,
      count: pollVotes.filter(vote => vote.optionIndex === index).length
    }));

    return {
      poll,
      results,
      totalVotes: pollVotes.length
    };
  }

  getAllPolls() {
    return Array.from(this.polls.values());
  }

  // Event handlers (set these to update UI)
  onPollUpdate = null;
  onVoteUpdate = null;
}
```

### Utility Functions

```js
// Helper functions for DecenVote
export const DecenVoteUtils = {
  // Generate unique poll ID
  generatePollId() {
    return `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Validate poll data
  validatePoll(question, options) {
    if (!question || question.trim().length === 0) {
      throw new Error("Question is required");
    }

    if (!options || options.length < 2) {
      throw new Error("At least 2 options are required");
    }

    if (options.some(option => !option || option.trim().length === 0)) {
      throw new Error("All options must have content");
    }
  },

  // Calculate vote percentages
  calculatePercentages(results, totalVotes) {
    if (totalVotes === 0) {
      return results.map(result => ({ ...result, percentage: 0 }));
    }

    return results.map(result => ({
      ...result,
      percentage: Math.round((result.count / totalVotes) * 100)
    }));
  },

  // Format timestamp for display
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  },

  // Truncate public key for display
  truncatePublicKey(publicKey, length = 16) {
    if (!publicKey) return "";
    return publicKey.length > length
      ? `${publicKey.slice(0, length)}...`
      : publicKey;
  }
};
```

---

## Error Handling and Best Practices

### Connection Management

```js
class WakuConnectionManager {
  constructor(nodeOptions) {
    this.nodeOptions = nodeOptions;
    this.node = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      this.node = await createLightNode(this.nodeOptions);
      await this.node.start();
      await this.node.waitForPeers([Protocols.LightPush, Protocols.Filter, Protocols.Store]);

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log("Waku node connected successfully");

      return this.node;
    } catch (error) {
      console.error("Failed to initialize Waku node:", error);
      await this.handleConnectionError();
      throw error;
    }
  }

  async handleConnectionError() {
    this.isConnected = false;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff

      console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        this.initialize();
      }, delay);
    } else {
      console.error("Max reconnection attempts reached");
    }
  }

  async stop() {
    if (this.node) {
      await this.node.stop();
      this.isConnected = false;
    }
  }
}
```

### Message Validation

```js
const MessageValidator = {
  validatePollMessage(pollData) {
    const required = ['id', 'question', 'options', 'createdBy', 'timestamp'];

    for (const field of required) {
      if (!pollData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(pollData.options) || pollData.options.length < 2) {
      throw new Error("Poll must have at least 2 options");
    }

    if (pollData.timestamp > Date.now() + 60000) { // Allow 1 minute clock skew
      throw new Error("Poll timestamp is in the future");
    }
  },

  validateVoteMessage(voteData) {
    const required = ['pollId', 'optionIndex', 'voterPublicKey', 'timestamp'];

    for (const field of required) {
      if (voteData[field] === undefined || voteData[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (typeof voteData.optionIndex !== 'number' || voteData.optionIndex < 0) {
      throw new Error("Invalid option index");
    }

    if (voteData.timestamp > Date.now() + 60000) { // Allow 1 minute clock skew
      throw new Error("Vote timestamp is in the future");
    }
  }
};
```

This comprehensive guide provides all the necessary code patterns and examples to implement DecenVote using Waku JS SDK. Each section builds upon the previous ones, creating a complete implementation reference for your decentralized voting application.