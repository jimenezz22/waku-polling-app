# DecenVote Architecture

## Overview

DecenVote is a **production-ready, modular** decentralized polling application built with **React + TypeScript + Waku SDK 0.0.35**. The architecture emphasizes **separation of concerns**, **scalability**, and **maintainability** while demonstrating best practices for Waku protocol integration.

## Design Principles

### 1. Modular Architecture
- **Separation of concerns**: Each module has a single, well-defined responsibility
- **Centralized configuration**: All settings managed through WakuConfig
- **Dependency injection**: Services can be easily tested and replaced
- **Clear interfaces**: TypeScript ensures type safety across modules

### 2. Real-time First
- **ReliableChannel**: Primary protocol for bidirectional communication
- **Store fallback**: Graceful degradation when Store protocol unavailable
- **Data validation**: Comprehensive validation at all layers
- **Error resilience**: Robust error handling and recovery

### 3. Developer Experience
- **Type safety**: Full TypeScript coverage with strict typing
- **Centralized validation**: DataValidator ensures data integrity
- **Hot reload**: Instant feedback during development
- **Extensive documentation**: Clear examples and integration patterns

### 4. Production Ready
- **Memory leak prevention**: Proper cleanup and resource management
- **Performance optimization**: Efficient React patterns and Waku usage
- **Error monitoring**: Comprehensive error handling and logging
- **Scalable structure**: Easy to extend with additional features

## Application Structure

```
waku-polling-app/
├── public/                          # Static assets
├── src/
│   ├── components/                  # React UI components
│   │   ├── PollCreation.tsx        # Poll creation form
│   │   ├── PollList.tsx            # Poll list display
│   │   ├── PollCard.tsx            # Individual poll component
│   │   ├── VoteInterface.tsx       # Voting interface
│   │   ├── VoteResults.tsx         # Vote count display
│   │   └── ConnectionStatus.tsx    # Network status indicator
│   ├── hooks/                      # Custom React hooks
│   │   ├── usePolls.ts            # Poll state management
│   │   ├── useVotes.ts            # Vote state management
│   │   └── useIdentity.ts         # Identity state management
│   ├── services/                   # Modular service layer
│   │   ├── config/
│   │   │   └── WakuConfig.ts      # Centralized configuration
│   │   ├── validators/
│   │   │   └── DataValidator.ts   # Data validation logic
│   │   ├── channels/
│   │   │   ├── ChannelManager.ts  # Channel lifecycle management
│   │   │   └── DataProcessor.ts   # Data processing and buffering
│   │   ├── utils/
│   │   │   └── StoreErrorPatcher.ts # Store error handling
│   │   ├── protocols/
│   │   │   ├── ReliableChannelService.ts # Real-time communication
│   │   │   └── StoreService.ts           # Historical data
│   │   ├── WakuService.ts         # Core Waku Light Node
│   │   ├── IdentityService.ts     # Identity management
│   │   ├── ProtobufSchemas.ts     # Data type definitions
│   │   └── DataService.ts         # Unified API orchestrator
│   ├── utils/                      # Utility functions
│   ├── styles/                     # CSS styling
│   ├── App.tsx                     # Main application component
│   └── index.tsx                   # React entry point
├── docs/                           # Organized documentation
│   ├── core/                      # Core concepts
│   ├── guides/                    # Development guides
│   ├── technical/                 # Technical documentation
│   └── workshops/                 # Workshop materials
├── craco.config.js                # Craco configuration for Waku
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies and scripts
```

## Service Layer Architecture

### Core Service Hierarchy

```
DataService (Unified API)
├── ReliableChannelService (Real-time communication)
│   ├── ChannelManager (Channel lifecycle)
│   ├── DataProcessor (Data processing & buffering)
│   └── StoreErrorPatcher (Error handling)
└── StoreService (Historical data)

WakuService (Foundation)
├── WakuConfig (Configuration)
├── IdentityService (Cryptographic identity)
└── DataValidator (Centralized validation)
```

### Service Responsibilities

**DataService** (Orchestrator):
- Unified API for all data operations
- Coordinates between ReliableChannel and Store protocols
- Provides simple interface for React components
- Handles service lifecycle and cleanup

**ReliableChannelService** (Real-time Communication):
- Manages bidirectional data flow via ReliableChannel
- Publishing polls and votes
- Real-time subscriptions with automatic buffering
- Error handling and Store protocol integration

**ChannelManager** (Channel Lifecycle):
- Creates and manages ReliableChannel instances
- Dynamic content topic configuration
- Channel state management and cleanup
- Sender ID generation and tracking

**DataProcessor** (Data Processing):
- Processes incoming data from ReliableChannel
- Automatic data buffering for early arrivals
- Callback management and data distribution
- Deduplication and validation integration

**StoreErrorPatcher** (Error Handling):
- Patches Store protocol errors in ReliableChannel
- Graceful degradation when Store peers unavailable
- Error classification and handling strategies
- Maintains app functionality during network issues

**StoreService** (Historical Data):
- Loads historical polls and votes
- Generic data loading with validation
- Configurable routing information
- Graceful handling of Store protocol unavailability

**WakuService** (Foundation):
- Core Waku Light Node integration
- Peer connection and management
- Status monitoring and health checks
- Cleanup and resource management

**DataValidator** (Validation):
- Centralized validation for all data types
- Type-safe validation functions
- Batch validation utilities
- Consistent error reporting

**WakuConfig** (Configuration):
- External configuration management
- Protocol timeouts and settings
- Content topic definitions
- Bootstrap peer configuration

## Data Flow Architecture

### Real-time Data Flow (ReliableChannel)

```
User Action → React Component → DataService → ReliableChannelService
    ↓
ChannelManager → ReliableChannel → Waku Network
    ↓
Peer Devices ← ReliableChannel ← Waku Network
    ↓
DataProcessor → DataValidator → React Hook → UI Update
```

### Historical Data Flow (Store Protocol)

```
App Initialization → DataService → StoreService
    ↓
Store Query → Waku Network → Historical Data
    ↓
DataValidator → React Hook → UI Population
```

### Error Handling Flow

```
Network Error → StoreErrorPatcher → Error Classification
    ↓
├── Store Error → Graceful Degradation (Continue with real-time only)
└── Critical Error → Error Callback → UI Notification
```

## Component Architecture

### React Component Hierarchy

```
App
├── Header (Connection status, Identity display)
├── PollCreation (Form with validation)
├── PollList
│   └── PollCard (Individual poll display)
│       └── VoteInterface (Voting buttons)
│           └── VoteResults (Real-time results)
└── Footer (Status information)
```

### Custom Hook Integration

```
usePolls (Poll management)
├── Loads historical polls via DataService
├── Manages real-time poll subscriptions
├── Handles poll creation and validation
└── Provides loading states and error handling

useVotes (Vote management)
├── Loads historical votes via DataService
├── Manages real-time vote subscriptions
├── Handles vote submission and deduplication
└── Calculates and updates vote counts

useIdentity (Identity management)
├── Generates and stores cryptographic identity
├── Provides identity state and validation
└── Handles identity persistence
```

## Data Architecture

### Data Types and Validation

```typescript
// Core data interfaces
interface IPollData {
  id: string;
  question: string;
  options: string[];
  createdBy: string;
  timestamp: number;
}

interface IVoteData {
  pollId: string;
  optionIndex: number;
  voterPublicKey: string;
  signature: string;
  timestamp: number;
}

// Validation functions
DataValidator.validatePoll(poll: IPollData): boolean
DataValidator.validateVote(vote: IVoteData): boolean
```

### Content Topic Strategy

**ReliableChannel Topics** (Real-time):
- `/polling-app/1/polls/messages` - Live poll distribution
- `/polling-app/1/votes/messages` - Live vote submission

**Store Protocol Topics** (Historical):
- `/decenvote/1/polls/proto` - Historical poll storage
- `/decenvote/1/votes/proto` - Historical vote storage

**Separation Benefits**:
- Optimized protocols for different use cases
- Clear separation between real-time and historical data
- Independent scaling and configuration

## Configuration Architecture

### Centralized Configuration (WakuConfig)

```typescript
export class WakuConfig {
  static readonly NODE = {
    defaultBootstrap: true,
    bootstrapPeers: [...],
    connectionTimeout: 45000,
    reconnectDelay: 3000,
    maxReconnectAttempts: 3
  };

  static readonly CONTENT_TOPICS = {
    polls: "/decenvote/1/polls/proto",
    votes: "/decenvote/1/votes/proto"
  };

  static readonly PROTOCOL_TIMEOUTS = {
    lightPush: 15000,
    filter: 10000,
    store: 10000
  };
}
```

**Benefits**:
- Single source of truth for all settings
- Easy environment-specific configuration
- Type-safe configuration access
- Clear documentation of all settings

## Network Architecture

### Peer-to-Peer Communication

```
User A ←→ ReliableChannel ←→ Waku Network ←→ ReliableChannel ←→ User B
    ↓                                                ↓
Store Protocol ←→ Historical Data ←→ Store Protocol
```

**Characteristics**:
- **Decentralized**: No central server required
- **Resilient**: Works with partial network connectivity
- **Real-time**: Instant synchronization via ReliableChannel
- **Persistent**: Historical data via Store protocol
- **Graceful**: Degrades gracefully when protocols unavailable

## Security Architecture

### Identity Management

**Local Identity Generation**:
- Cryptographic key pairs generated locally
- No central registration or authentication
- Privacy-preserving pseudonymous identities
- Persistent across browser sessions

**Vote Integrity**:
- Cryptographic signatures for all votes
- Deduplication by `pollId + voterPublicKey`
- Client-side and server-side validation
- Immutable vote records

### Data Validation

**Multi-layer Validation**:
1. **TypeScript**: Compile-time type checking
2. **DataValidator**: Runtime data validation
3. **Protocol-level**: Waku protocol validation
4. **UI-level**: Form validation and error handling

## Performance Architecture

### Optimization Strategies

**React Optimization**:
- Custom hooks for efficient state management
- Memoization for expensive operations
- Efficient re-render patterns
- Component lifecycle optimization

**Waku Optimization**:
- Efficient subscription management
- Connection pooling and reuse
- Automatic cleanup and resource management
- Configurable timeouts and retries

**Memory Management**:
- Proper cleanup in useEffect hooks
- Service lifecycle management
- Subscription cleanup on unmount
- Garbage collection friendly patterns

## Deployment Architecture

### Build Configuration

**Development**:
- Hot reload with Craco
- TypeScript type checking
- Source maps for debugging
- Waku debug logging

**Production**:
- Optimized React build
- Code splitting and lazy loading
- Asset optimization
- Error monitoring integration

This architecture provides a solid foundation for building scalable, maintainable decentralized applications with Waku while maintaining code clarity and educational value.