# DecenVote: Decentralized Polling App - Implementation Context

## Application Overview
A real-time decentralized polling/voting application that demonstrates **Waku SDK 0.0.35** with **ReliableChannel** for bidirectional communication. The app operates without centralized servers or user registration, showcasing true peer-to-peer functionality.

## Core Functionality
**Poll Creation**: Users create polls with custom questions and multiple choice options
**Anonymous Voting**: Users vote on polls using cryptographically unique but anonymous identities
**Real-time Results**: Vote counts update instantly across all connected clients via ReliableChannel
**Persistent History**: Polls and votes persist using Store protocol with graceful degradation
**Data Integrity**: Comprehensive validation and deduplication ensure vote accuracy

## Technical Architecture

### Data Structure (Using "Data" suffix for clarity)
**Poll Data**:
```typescript
interface IPollData {
  id: string;              // Unique poll identifier
  question: string;        // Poll question
  options: string[];       // Array of voting options (min 2)
  createdBy: string;       // Creator's public key
  timestamp: number;       // Creation timestamp
}
```

**Vote Data**:
```typescript
interface IVoteData {
  pollId: string;          // Reference to poll
  optionIndex: number;     // Selected option (0-based index)
  voterPublicKey: string;  // Voter's public key (for deduplication)
  signature: string;       // Cryptographic signature
  timestamp: number;       // Vote timestamp
}
```

### Waku Protocol Integration (SDK 0.0.35)

**ReliableChannel Protocol**:
- **Real-time bidirectional communication** for polls and votes
- **Automatic message buffering** for early-arriving data
- **Content topics**:
  - `/polling-app/1/polls/messages` - Real-time poll distribution
  - `/polling-app/1/votes/messages` - Real-time vote submission
- **Error resilience**: Graceful handling of connection issues
- **Message deduplication**: Prevents duplicate data processing

**Store Protocol**:
- **Historical data retrieval** when users reconnect
- **Content topics**:
  - `/decenvote/1/polls/proto` - Historical polls
  - `/decenvote/1/votes/proto` - Historical votes
- **Graceful degradation**: App works without Store peers
- **Validation**: All historical data is validated before use

### Modular Architecture

**Core Services**:
```
WakuService (Light Node) → Core Waku integration
├── WakuConfig → Centralized configuration
├── IdentityService → Cryptographic key management
└── DataService (Orchestrator) → Unified API
    ├── ReliableChannelService → Real-time communication
    │   ├── ChannelManager → Channel lifecycle
    │   ├── DataProcessor → Data processing & buffering
    │   └── StoreErrorPatcher → Error handling
    └── StoreService → Historical data loading
```

**Validation & Configuration**:
- **DataValidator**: Centralized validation for all data types
- **WakuConfig**: External configuration for timeouts, peers, topics
- **Type Safety**: Full TypeScript interfaces and validation

### Key Features

**Real-time Synchronization**:
- Instant poll creation notifications via ReliableChannel
- Real-time vote updates with immediate count changes
- Automatic reconnection and state recovery

**Data Integrity**:
- Vote deduplication by `pollId + voterPublicKey`
- Comprehensive validation for all incoming data
- Error handling that maintains app functionality

**Decentralized Architecture**:
- No central server required
- Peer-to-peer message distribution
- Cryptographic identity without registration
- Works offline with real-time sync when reconnected

**User Experience**:
- Clean, responsive React interface
- Loading states for async operations
- Error notifications for network issues
- Connection status indicators

## Network Topology

```
User A (Browser) ←→ ReliableChannel ←→ Waku Network ←→ ReliableChannel ←→ User B (Browser)
                          ↓                                      ↓
                    Store Protocol                         Store Protocol
                          ↓                                      ↓
                   Historical Polls/Votes                Historical Polls/Votes
```

**Benefits**:
- **No single point of failure**: Fully distributed
- **Censorship resistant**: No central authority
- **Privacy preserving**: Cryptographic identities
- **Scalable**: P2P architecture scales naturally
- **Resilient**: Works with partial network connectivity

## Development Approach

**Phase-based Development**:
1. **Foundation**: Waku integration and configuration
2. **Data Layer**: Validation, schemas, and protocols
3. **Communication**: ReliableChannel and Store integration
4. **UI Layer**: React components and hooks
5. **Features**: Voting system with deduplication
6. **Polish**: Testing, optimization, and monitoring

**Technology Stack**:
- **Frontend**: React + TypeScript
- **Communication**: Waku SDK 0.0.35 with ReliableChannel
- **State Management**: Custom React hooks
- **Validation**: Centralized DataValidator
- **Configuration**: External WakuConfig module
- **Build**: Create React App with TypeScript

**Code Organization**:
- **Modular services**: Clear separation of concerns
- **Centralized configuration**: Easy environment management
- **Comprehensive validation**: Data integrity throughout
- **Custom hooks**: Reusable state management
- **Type safety**: Full TypeScript coverage

## Success Metrics

**Functional Requirements**:
- ✅ Users can create polls with multiple options
- ✅ Users can vote on polls with immediate feedback
- ✅ Real-time synchronization across all connected clients
- ✅ Historical data loads when users reconnect
- ✅ Vote deduplication prevents multiple votes per user
- ✅ App works without central server infrastructure

**Technical Requirements**:
- ✅ Waku SDK 0.0.35 integration with ReliableChannel
- ✅ Graceful error handling and network resilience
- ✅ Memory leak prevention with proper cleanup
- ✅ Modular architecture for maintainability
- ✅ Comprehensive validation and type safety
- ✅ Production-ready error handling

**Educational Requirements**:
- ✅ Clear code structure for learning purposes
- ✅ Well-documented APIs and integration patterns
- ✅ Beginner-friendly examples and explanations
- ✅ Step-by-step development phases
- ✅ Template suitable for other Waku applications

This context provides the foundation for understanding DecenVote's implementation, guiding developers through the technical decisions and architectural choices that make this decentralized polling application both functional and educational.