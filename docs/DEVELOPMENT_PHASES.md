# DecenVote Development Phases

This document outlines the iterative development phases for building the DecenVote decentralized polling application. Each phase focuses on core functionality while maintaining simplicity and beginner-friendliness.

> **📌 Note**: This document incorporates essential improvements identified in [`DECENVOTE_ESSENTIAL_IMPROVEMENTS.md`](./DECENVOTE_ESSENTIAL_IMPROVEMENTS.md). Critical improvements are marked with **[CRITICAL]**.

## **Phase 0: Context and Understanding** 📚

**Goal**: Establish complete understanding of project requirements and Waku fundamentals

### Tasks:
- Review project goals and technical requirements
- Understand Waku protocol components and their roles
- Familiarize with decentralized architecture concepts

### Required Documentation:
- 📄 [`docs/CONTEXT.md`](./CONTEXT.md) - Complete project overview and technical requirements
- 📄 [`docs/WAKU_CONCEPTS.md`](./WAKU_CONCEPTS.md) - Waku protocol fundamentals and usage patterns

### Deliverables:
- Clear understanding of DecenVote's purpose and functionality
- Knowledge of which Waku protocols to use and when
- Foundation for making informed architectural decisions

---

## **Phase 1: Project Foundation** ⚙️

**Goal**: Set up development environment and project structure

### Tasks:
1. Initialize Vite + React + TypeScript project with proper configuration
2. Install and configure Waku dependencies (@waku/sdk)
3. Create organized folder structure (components, hooks, services, utils)

### Required Documentation:
- 📄 [`docs/DEVELOPMENT_SETUP.md`](./DEVELOPMENT_SETUP.md) - Complete setup instructions and configuration

### Deliverables:
- Working development environment
- Proper TypeScript configuration
- Organized project structure ready for development
- All Waku dependencies properly installed and configured

---

## **Phase 2: Waku Integration Foundation** 🔗

**Goal**: Establish core Waku connectivity and identity system

### Tasks:
1. Create basic WakuService with Light Node initialization and proper peer connection:
   - Use `waitForRemotePeer` with all three protocols (LightPush, Filter, Store)
   - Implement cleanup method to prevent memory leaks
   - Add basic subscription management
2. Implement identity system for generating and managing cryptographic keys
3. Set up main App component with WakuProvider and basic layout structure

### Required Documentation:
- 📄 [`docs/WAKU_IMPLEMENTATION_GUIDE.md`](./WAKU_IMPLEMENTATION_GUIDE.md) - Waku service implementation patterns
- 📄 [`docs/IDENTITY_SYSTEM.md`](./IDENTITY_SYSTEM.md) - Cryptographic identity management
- 📄 [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) - Application structure and component organization

### Deliverables:
- Functional Waku Light Node connection with proper peer waiting
- Cleanup logic implemented to prevent memory leaks
- Secure identity generation and storage system
- Basic app structure with Waku provider integration
- Visual connection status indicator (🟢 Connected, 🟡 Connecting, 🔴 Disconnected)

---

## **Phase 3: Message Protocols Setup** 📡 ✅

**Goal**: Implement Waku protocols for message publishing and subscription

### Tasks:
1. Define Protobuf schemas for polls and votes (using "Data" suffix), create encoders/decoders:
   - Add message validation to prevent crashes from invalid payloads
2. Implement Store Protocol integration for loading historical data
3. Implement Filter Protocol integration for real-time message subscriptions:
   - Include proper subscription management to avoid duplicates
4. Create DataService for centralized protocol operations

### Required Documentation:
- 📄 [`docs/WAKU_IMPLEMENTATION_GUIDE.md`](./WAKU_IMPLEMENTATION_GUIDE.md) - Protocol implementation details
- 📄 [`docs/REAL_TIME_SYNC.md`](./REAL_TIME_SYNC.md) - Store and Filter protocol usage patterns
- 📄 [`docs/phases-explanations/PHASE_3_USAGE_EXAMPLES.md`](./phases-explanations/PHASE_3_USAGE_EXAMPLES.md) - Usage examples and integration guide

### Implementation Files:
- ✅ `src/services/ProtobufSchemas.ts` - PollData and VoteData schemas with TypeScript interfaces
- ✅ `src/services/DataService.ts` - Orchestrator that provides unified API for all protocols
- ✅ `src/services/protocols/LightPushService.ts` - Handles message publishing (Light Push protocol)
- ✅ `src/services/protocols/StoreService.ts` - Handles historical data loading (Store protocol)
- ✅ `src/services/protocols/FilterService.ts` - Handles real-time subscriptions (Filter protocol)

### Deliverables:
- ✅ Working message serialization/deserialization with validation
- ✅ Message validation logic for all incoming payloads (simple null checks)
- ✅ Historical data loading capability (Store Protocol)
- ✅ Real-time message subscription system with proper cleanup (Filter Protocol)
- ✅ Content topic configuration (`/decenvote/1/polls/proto`, `/decenvote/1/votes/proto`)
- ✅ Publishing capability with Light Push protocol
- ✅ Utility functions for creating poll/vote data with defaults

---

## **Phase 4: Core Poll Functionality** 🗳️

**Goal**: Implement poll creation and display features using DataService

### Tasks:
1. Create PollCreation component with form validation:
   - Use `dataService.publishPoll()` for publishing
   - Use `createPollDataWithDefaults()` helper from Phase 3
   - Integrate with IdentityService for creator identification
2. Develop PollList and PollCard components with real-time updates:
   - Display polls from `dataService.loadHistoricalPolls()`
   - Subscribe to new polls with `dataService.subscribeToPolls()`
   - Show poll metadata (creator, timestamp, options)
3. Add minimal, clean CSS styling following design principles

### Required Documentation:
- 📄 [`docs/COMPONENT_STRUCTURE.md`](./COMPONENT_STRUCTURE.md) - Component design patterns and structure
- 📄 [`docs/STATE_MANAGEMENT.md`](./STATE_MANAGEMENT.md) - React state management patterns
- 📄 [`docs/phases-explanations/PHASE_3_USAGE_EXAMPLES.md`](./phases-explanations/PHASE_3_USAGE_EXAMPLES.md) - DataService usage patterns

### Key Integration Points:
- Use `DataService` methods for all Waku operations
- Leverage `IPollData` interface from ProtobufSchemas
- Handle loading states while fetching historical data
- Implement duplicate detection (avoid showing same poll twice)

### Deliverables:
- Functional poll creation interface using DataService
- Poll list display with real-time updates via Filter subscriptions
- Clean, beginner-friendly UI styling
- Form validation and error handling
- Loading states for async operations

---

## **Phase 5: Voting System** ✅

**Goal**: Implement voting interface and results display with deduplication

### Tasks:
1. Create VoteInterface component with voting buttons:
   - Use `dataService.publishVote()` for submitting votes
   - Use `createVoteDataWithDefaults()` helper from Phase 3
   - Integrate with IdentityService for voter identification
   - Check if user already voted before allowing vote submission
2. Implement VoteResults component with real-time calculation:
   - Load votes with `dataService.loadHistoricalVotes()`
   - Subscribe to new votes with `dataService.subscribeToVotes()`
   - Calculate vote counts per option
   - Display results with progress bars and percentages
3. **[CRITICAL]** Add vote deduplication logic to ensure data integrity:
   - Deduplicate by `pollId + voterPublicKey` (as shown in Phase 3 examples)
   - Keep only the first vote per user per poll
   - Prevent UI from allowing duplicate voting

### Required Documentation:
- 📄 [`docs/VOTING_LOGIC.md`](./VOTING_LOGIC.md) - Voting mechanics and validation rules
- 📄 [`docs/COMPONENT_STRUCTURE.md`](./COMPONENT_STRUCTURE.md) - UI component patterns
- 📄 [`docs/IDENTITY_SYSTEM.md`](./IDENTITY_SYSTEM.md) - Identity-based vote validation
- 📄 [`docs/phases-explanations/PHASE_3_USAGE_EXAMPLES.md`](./phases-explanations/PHASE_3_USAGE_EXAMPLES.md) - Vote publishing and subscription patterns

### Key Integration Points:
- Use `DataService` methods for publishing and subscribing to votes
- Leverage `IVoteData` interface from ProtobufSchemas
- Implement client-side deduplication (example in Phase 3 docs)
- Use IdentityService to check if current user has voted
- Display voting status (not voted, voted, loading)

### Deliverables:
- Interactive voting interface using DataService
- Real-time vote count updates via Filter subscriptions
- Results visualization with progress bars and percentages
- **Vote deduplication system implemented (data integrity)**
- User voting status tracking (disable vote button if already voted)
- Vote count aggregation logic

---

## **Phase 6: Final Integration & Polish** ✨

**Goal**: Complete application with custom hooks, status monitoring, and comprehensive testing

### Tasks:
1. Create custom React hooks for centralized state management:
   - `useDataService` - Wrapper around DataService with cleanup
   - `usePolls` - Manages polls state (loading, subscriptions, deduplication)
   - `useVotes` - Manages votes state (loading, subscriptions, deduplication)
   - `useVoting` - Handles vote submission logic
   - Reference the example hook in Phase 3 documentation
2. Enhance Header and Footer components:
   - Show Waku connection status from WakuService
   - Display user identity from IdentityService
   - Add error notifications
3. Conduct comprehensive integration testing of all features:
   - Test poll creation → real-time updates
   - Test voting → deduplication → results
   - Test cleanup → reconnection

### Required Documentation:
- 📄 [`docs/COMPONENT_STRUCTURE.md`](./COMPONENT_STRUCTURE.md) - Status component patterns
- 📄 [`docs/STATE_MANAGEMENT.md`](./STATE_MANAGEMENT.md) - Custom hooks implementation
- 📄 [`docs/phases-explanations/PHASE_3_USAGE_EXAMPLES.md`](./phases-explanations/PHASE_3_USAGE_EXAMPLES.md) - Complete hook example (usePolls)
- All previous documentation for integration testing

### Key Integration Points:
- Use DataService as single source for all Waku protocol operations
- Centralize state management in custom hooks
- Ensure proper cleanup in useEffect hooks
- Handle loading states and errors gracefully
- Reference Phase 3 hook example for patterns

### Deliverables:
- Complete application with status monitoring
- Reusable custom hooks following Phase 3 patterns
- Error handling and loading states throughout UI
- Comprehensive feature testing (polls, votes, subscriptions)
- Basic reconnection handling via WakuService
- Ready-to-demo application with clean architecture

---

## **Development Guidelines**

### Core Principles:
- **Simplicity First**: Minimal dependencies, clear code structure
- **Beginner Friendly**: Well-commented, easy to understand
- **Demo Optimized**: Features can be demonstrated incrementally
- **Core Functionality Focus**: No over-engineering or unnecessary complexity

### File Organization:
```
src/
├── components/         # React UI components
│   ├── PollCreation.tsx
│   ├── PollList.tsx
│   ├── VoteInterface.tsx
│   └── ConnectionStatus.tsx
├── hooks/             # Custom React hooks
│   ├── useWaku.ts
│   ├── usePolls.ts       # (Phase 6)
│   └── useVotes.ts       # (Phase 6)
├── services/          # Waku integration services
│   ├── WakuService.ts           # ✅ Phase 2: Waku Light Node
│   ├── IdentityService.ts       # ✅ Phase 2: Identity management
│   ├── ProtobufSchemas.ts       # ✅ Phase 3: Message schemas
│   ├── DataService.ts           # ✅ Phase 3: Protocol orchestrator
│   └── protocols/               # ✅ Phase 3: Protocol implementations
│       ├── LightPushService.ts  # Publishing polls/votes
│       ├── StoreService.ts      # Loading historical data
│       └── FilterService.ts     # Real-time subscriptions
├── utils/             # Utility functions
├── styles/            # CSS styling
├── App.tsx            # Main application component
└── main.tsx           # React entry point
```

### Testing Approach:
- Test each phase incrementally
- Verify Waku protocols work independently and together
- Ensure real-time updates function properly
- Validate error handling and edge cases

**Phase 3 Specific Tests**:
  - Test `dataService.publishPoll()` and verify via Store query
  - Test `dataService.loadHistoricalPolls()` returns expected data
  - Test `dataService.subscribeToPolls()` receives real-time updates
  - Verify message validation rejects invalid payloads
  - Confirm encoders/decoders work correctly with Protobuf schemas

**Critical Tests (Phase 5+)**:
  - Verify cleanup prevents memory leaks (open/close app multiple times)
  - Test vote deduplication (try voting multiple times on same poll)
  - Confirm message validation handles malformed data gracefully
  - Test subscription recovery after network disconnection

### Success Criteria:
Each phase should result in a working, demonstrable increment that builds upon previous phases while maintaining application stability and user experience.