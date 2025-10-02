# Building a Decentralized Polling App with Waku Protocol: A Phase-by-Phase Journey

## Introduction

Waku is a decentralized communication protocol that enables private, censorship-resistant messaging without relying on centralized servers. Think of it as a peer-to-peer messaging layer that any application can integrate to gain decentralization superpowers.

In this post, I'll walk you through how I built **DecenVote**, a fully decentralized polling application where users can create polls and vote—all without a central server. Everything happens through the Waku network using real-time messaging and distributed data storage.

This guide follows the actual iterative development process, broken down into phases. Each phase introduces a different piece of the Waku protocol, building upon the previous one. By the end, you'll understand how to integrate Waku into your own React applications.

**Tech Stack**: React + TypeScript, Waku SDK v0.0.35, Protocol Buffers

---

## Phase 0-1: Foundation & Project Setup

The journey started with the basics: setting up a React application with TypeScript and installing the Waku SDK v0.0.35. At this stage, the focus was on creating a clean project structure that separates concerns properly.

I organized the codebase into three main layers: components for UI, services for Waku protocol logic, and hooks for bridging React state with Waku services. This separation proved crucial later—it means the Waku integration logic is completely independent from React, making it reusable and testable.

**Key insight**: Start with good architecture. Keeping protocol logic separate from UI components makes the codebase maintainable as complexity grows.

---

## Phase 2: Connecting to the Waku Network

This phase was about establishing the connection to Waku's peer-to-peer network. Three key pieces came together:

### Centralized Configuration

Instead of scattering configuration values throughout the code, I created a single configuration module ([WakuConfig.ts](src/services/config/WakuConfig.ts)) that defines everything: bootstrap peers (the entry points to the network), content topics (message routing paths), and protocol timeouts. This centralization makes it trivial to adjust network parameters later without touching service code.

### Waku Light Node

The app uses a Waku Light Node—a lightweight client that participates in the network without storing full message history. This is perfect for browser-based applications. The node connects to bootstrap peers first, then discovers other peers automatically through the network's peer discovery mechanism.

Full nodes store all messages and help relay them to others, but light nodes only process what they need. This makes the app lightweight while remaining fully decentralized.

### Identity Management

Every user needs a cryptographic identity to participate in the network. I implemented an identity system ([IdentityService.ts](src/services/IdentityService.ts)) that generates a public/private key pair using the secp256k1 curve. The private key stays in the browser's local storage, while the public key becomes the user's unique identifier across the network.

**Key Waku concept**: Once the light node connects to bootstrap peers and discovers other peers, it can send and receive messages on specific "content topics"—think of them as decentralized channels or rooms.

---

## Phase 3: Data Schemas and Validation

Before sending data over the network, we need a standard format that's efficient and type-safe. I used Protocol Buffers (protobuf) to define two main data structures: polls and votes.

Each poll contains an ID, question, options array, creator's public key, and timestamp. Votes are simpler: they reference a poll ID, specify an option index, include the voter's public key, a signature, and a timestamp.

The [DataValidator](src/services/validators/DataValidator.ts) module acts as a gatekeeper, ensuring all data meets requirements before being published to the network. It checks for required fields, validates timestamps, ensures option indices are within bounds, and verifies signatures.

**Why protobuf?** It produces compact binary messages (saves bandwidth on the p2p network) and provides type safety across different platforms. The encoded protobuf messages are what actually travels through the Waku network.

---

## Phase 4: ReliableChannel - The Magic Layer

This is where Waku's real power shines. **ReliableChannel** is a high-level abstraction that handles three Waku protocols under the hood: Light Push, Filter, and Store.

### Understanding ReliableChannel

Instead of manually managing three separate protocols, ReliableChannel provides a simple unified interface:

- **Light Push protocol**: Used when publishing messages to the network
- **Filter protocol**: Used when subscribing to specific topics to receive messages
- **Store protocol**: Used when querying historical messages from peers that keep message history

The beauty is that you don't need to think about which protocol to use when—ReliableChannel handles it automatically.

### Modular Architecture

I broke the implementation into focused modules for maintainability:

The **ChannelManager** ([ChannelManager.ts](src/services/channels/ChannelManager.ts)) creates and manages ReliableChannel instances, one per content topic. The **DataProcessor** ([DataProcessor.ts](src/services/channels/DataProcessor.ts)) handles incoming messages, decoding protobuf payloads and routing them to the right callbacks.

The **ReliableChannelService** ([ReliableChannelService.ts](src/services/protocols/ReliableChannelService.ts)) orchestrates publishing and subscriptions. The **StoreService** ([StoreService.ts](src/services/protocols/StoreService.ts)) handles loading historical data separately, mainly for app initialization.

Finally, the **DataService** ([DataService.ts](src/services/DataService.ts)) acts as a unified API—it's what components actually interact with. Components never touch Waku protocols directly; they just call simple methods like `publishPoll()` or `subscribeToPolls()`.

### Content Topics: Message Routing

Content topics are like channels or rooms in the Waku network. I use two:
- `/polling-app/1/polls/messages` for poll creation messages
- `/polling-app/1/votes/messages` for vote submission messages

When you subscribe to a content topic via ReliableChannel, you receive all messages published to that topic in real-time through the Filter protocol.

### Graceful Degradation

Here's an important lesson I learned: the Store protocol is optional. Not all Waku peers provide Store functionality (storing message history). I implemented graceful error handling so that if Store peers aren't available, the app still functions perfectly—it just starts without historical data.

The app tries to load historical polls on startup using Store protocol. If that fails, it logs a warning and starts with an empty state. Real-time messaging via Filter protocol works regardless. This graceful degradation is crucial for production apps.

**Key insight**: ReliableChannel abstracts complexity, but you still need to handle each underlying protocol's potential failures gracefully.

---

## Phase 5: Poll Management with React Hooks

With the Waku integration complete, I created React hooks to bridge the service layer with UI components.

### Connection Hook

The [useWaku](src/hooks/useWaku.ts) hook manages the entire Waku lifecycle: initialization, connection status monitoring, creating the DataService instance when ready, and cleanup on unmount. Components use this hook to check if Waku is ready before attempting operations.

### Poll Management Hook

The [usePolls](src/hooks/usePolls.ts) hook handles poll state. When the component mounts, it does two things in parallel:

First, it attempts to load historical polls from the Store protocol. If Store peers are available, this gives users immediate access to past polls. If not, it gracefully continues with an empty array.

Second, it subscribes to the polls content topic via ReliableChannel. From this point on, whenever anyone publishes a new poll to the network, this subscription receives it in real-time through the Filter protocol, and the hook updates React state.

To create a poll, components call the `createPoll` function from the hook. This generates a unique poll ID, packages the data with the creator's public key and current timestamp, validates it, and publishes it using ReliableChannel's Light Push protocol. All other subscribed peers receive it instantly.

**The magic**: Historical loading (Store) and real-time synchronization (Filter) work together seamlessly. Users see past polls immediately and new polls appear live.

---

## Phase 6: Voting System Implementation

The voting system ([useVotes.ts](src/hooks/useVotes.ts)) follows the same pattern as polls but adds deduplication logic.

When a user votes, the hook creates a vote message containing the poll ID, selected option index, voter's public key, and a cryptographic signature proving authenticity. This gets published to the votes content topic via ReliableChannel.

All peers subscribed to votes receive these messages in real-time. The hook processes incoming votes and updates the vote counts for each poll option.

### Deduplication Challenge

Since Waku is message-based (not state-based like a traditional database), preventing double voting requires careful design. I implemented multi-layer deduplication:

At the client level, the hook tracks which polls the current user has voted on using a combination of poll ID and user public key. The UI disables voting buttons after the user votes.

At the data processing level, when receiving vote messages from the network, the DataProcessor filters out duplicates before passing them to callbacks. Each client maintains their own view of voting state by processing all vote messages they receive.

**Important lesson**: In decentralized systems, each peer builds their own view of the world by processing messages. Application logic (like deduplication) happens at each peer, not on a central server.

---

## Phase 7: Production Polish

The final phase focused on making the app production-ready: connection status display in the header, error notifications for failed operations, and comprehensive error handling throughout.

A critical aspect was memory leak prevention. React's useEffect hooks need proper cleanup, especially when dealing with Waku subscriptions. Each subscription gets an unsubscribe call in the cleanup function, and the Waku node properly disconnects when the app unmounts.

Performance optimization included smart subscription management—only subscribing once per content topic and reusing the same DataService instance across components instead of creating multiple ones.

The final app works without central servers, provides real-time updates across all users, gracefully degrades when Store protocol is unavailable, and maintains clean separation between UI and protocol logic.

---

## Key Takeaways

### When to Use What Protocol?

**ReliableChannel** should be your default choice. It handles Light Push (sending), Filter (receiving), and Store (history) automatically. Only use direct protocol access if you need fine-grained control or custom reliability logic.

The **Store protocol** is optional but greatly improves UX. Don't depend on it being available—always implement graceful fallbacks.

### Architecture Patterns That Work

A **service layer** isolates Waku protocol complexity from React components. **Custom hooks** bridge services with React state using familiar patterns. **Content topics** organize messages by type—use specific topics for different message types. **Graceful degradation** handles protocol errors elegantly without breaking the app.

### What Makes This Template Reusable?

The modular architecture means you can replace polls and votes with any message types. You can swap React for another framework since services are framework-agnostic. You can add RLN (Rate Limit Nullifiers) for spam prevention, or integrate encryption for private messaging.

The patterns demonstrated here work for any real-time decentralized application: chat apps, collaborative tools, social feeds, gaming, and more.

---

## Try It Yourself

**Repository**: [waku-polling-app](https://github.com/waku-org/waku-polling-app)

Clone the repo, run `npm install` and `npm start`. The app connects to Waku's test network automatically.

**Next Steps**:
- Read [DEVELOPMENT_PHASES.md](docs/workshops/DEVELOPMENT_PHASES.md) for detailed implementation guides
- Explore [WAKU_CONCEPTS.md](docs/core/WAKU_CONCEPTS.md) to learn more about Waku protocols
- Check [ARCHITECTURE.md](docs/technical/ARCHITECTURE.md) for system design details

**Want to build something similar?** Use this template as a starting point. The service architecture, hook patterns, and protocol integration strategies transfer directly to other use cases.

**Contributions welcome!** This is an open-source template and we encourage improvements. Whether it's a new feature, bug fix, documentation enhancement, or architectural suggestion—open an issue in the repository and let's build together.

---

*Questions or feedback? Open an issue in the repository or reach out to the Logos community. Happy building!* 🚀
