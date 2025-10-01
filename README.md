# DecenVote - Decentralized Polling App

A decentralized polling application built with React and Waku Protocol SDK v0.0.35, demonstrating real-time messaging and data persistence in a peer-to-peer network.

## 🏗️ Architecture

This template uses a clean, production-ready architecture suitable for decentralized applications:

```
src/
├── components/          # React UI components
├── hooks/              # Custom React hooks for business logic
├── services/           # Core Waku protocol services
│   ├── protocols/      # Protocol-specific implementations
│   │   ├── ReliableChannelService.ts  # Real-time messaging
│   │   └── StoreService.ts            # Historical data
│   ├── DataService.ts  # Main orchestrator
│   ├── WakuService.ts  # Node management
│   └── *.ts           # Supporting services
└── utils/             # Utility functions
```

## 🚀 Key Features

- **Real-time Messaging**: Using Waku's ReliableChannel for instant poll/vote updates
- **Historical Data**: Store protocol integration for data persistence
- **Error Resilience**: Graceful handling of Store protocol errors
- **Identity Management**: Secp256k1 key generation and management
- **TypeScript**: Full type safety with Protocol Buffers

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript + Create React App
- **Messaging**: Waku Protocol SDK v0.0.35
- **Serialization**: Protocol Buffers (protobuf)
- **Crypto**: Secp256k1 for identity management
- **Styling**: CSS3 with modern flexbox layouts

## 📋 Core Services

### DataService (Main Orchestrator)
Central service that provides a unified API for all Waku operations:
- Poll and vote publishing
- Real-time subscriptions
- Historical data loading

### ReliableChannelService
Handles all real-time messaging using Waku's ReliableChannel:
- Dynamic content topics per message type
- Message buffering for timing issues
- Store protocol error handling
- Event-driven architecture

### StoreService
Manages historical data retrieval:
- Loads past polls and votes from the network
- Graceful fallback when Store protocol is unavailable
- Data validation and filtering

### WakuService
Low-level Waku node management:
- Node initialization and connection
- Peer discovery and management
- Protocol readiness monitoring

## 🔧 Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## 📝 Usage Example

```typescript
// Initialize the app
const { dataService, isReady } = useWaku();
const { polls, createPoll } = usePolls(dataService);
const { submitVote, getVoteResults } = useVotes(dataService, userPublicKey);

// Create a poll
await createPoll("What's your favorite color?", ["Red", "Blue", "Green"]);

// Vote on a poll
await submitVote(pollId, optionIndex);

// Get results
const results = getVoteResults(pollId);
```

## 🌐 Network Configuration

The app connects to Waku's test network by default. Content topics follow this pattern:
- Polls: `/polling-app/1/polls/messages`
- Votes: `/polling-app/1/votes/messages`

## 🔒 Security Considerations

- Private keys are generated locally and never transmitted
- All messages are signed using secp256k1
- Store protocol errors are handled gracefully without exposing sensitive information
- No central servers or trusted third parties required

## 🧪 Error Handling

The app includes comprehensive error handling:
- Store protocol failures (graceful degradation)
- Network connectivity issues
- Message validation and filtering
- React error boundaries for UI stability

## 📦 Message Format

Messages use Protocol Buffers for efficient serialization:

```protobuf
// Poll message
message PollData {
  string id = 1;
  string question = 2;
  repeated string options = 3;
  string createdBy = 4;
  uint64 timestamp = 5;
}

// Vote message
message VoteData {
  string pollId = 1;
  uint32 optionIndex = 2;
  string voterPublicKey = 3;
  string signature = 4;
  uint64 timestamp = 5;
}
```

## 🎯 Template Usage

This codebase serves as a production-ready template for building decentralized applications with Waku.

**To build this template from scratch**, follow the step-by-step guide in [`docs/workshops/INITIAL_PROMPT.md`](docs/workshops/INITIAL_PROMPT.md).

Key patterns include:

1. **Service Layer Architecture**: Clean separation between UI and protocol logic
2. **Hook-based State Management**: React hooks for component-level state
3. **Error Boundaries**: Graceful error handling and recovery
4. **TypeScript Integration**: Full type safety across the application
5. **Protocol Abstraction**: Easy-to-use APIs hiding Waku complexity

---

⭐ **If you found this template helpful, please give us a star!** It helps others discover this project and motivates us to keep improving it.
