# DecenVote Architecture

## Overview

DecenVote is a **minimal, beginner-friendly** decentralized voting application built with **React + Vite + Waku**. The architecture prioritizes simplicity and clear separation of concerns to demonstrate Waku protocols without overwhelming complexity.

## Design Principles

### 1. Simplicity First
- **Minimal dependencies**: Only essential packages (React, Vite, Waku, Protobuf)
- **No state management libraries**: Pure React hooks + Waku as data layer
- **No UI frameworks**: Simple CSS for clear demonstration
- **Single responsibility**: Each component has one clear purpose

### 2. Beginner Friendly
- **Clear naming**: Components and functions have descriptive names
- **Linear flow**: Predictable data flow from Waku → React → UI
- **Minimal abstractions**: Direct use of Waku APIs where possible
- **Extensive comments**: Code is self-documenting

### 3. Demo Optimized
- **Live coding friendly**: Easy to explain and modify during presentation
- **Visible network activity**: Clear feedback on Waku operations
- **Progressive enhancement**: Features can be added incrementally
- **Error resilience**: Graceful handling of network issues

## Application Structure

```
decenvote/
├── public/                     # Static assets
├── src/
│   ├── components/            # React components
│   │   ├── layout/           # Layout components
│   │   ├── polls/            # Poll-related components
│   │   └── voting/           # Voting components
│   ├── hooks/                # Custom React hooks
│   ├── services/             # Waku integration services
│   ├── utils/                # Utility functions
│   ├── styles/               # CSS files
│   ├── App.jsx               # Main app component
│   └── main.jsx              # React entry point
├── package.json              # Dependencies
└── vite.config.js           # Vite configuration
```

## Core Components

### 1. App Layer
```
App.jsx
├── WakuProvider (Waku node setup)
├── IdentityProvider (User identity)
├── Layout
    ├── Header (Connection status, user identity)
    ├── Main (Poll creation + Poll list)
    └── Footer (Sync status)
```

### 2. Feature Components
```
PollCreationForm
├── Question input
├── Options list (dynamic)
└── Submit button

PollList
├── PollCard (for each poll)
    ├── Poll question
    ├── Voting options
    ├── Results display
    └── Vote button/status

IdentityCard
├── Public key display
├── Identity status
└── Reset option (dev tool)
```

### 3. Infrastructure Components
```
WakuStatus
├── Connection indicator
├── Peer count
└── Sync status

ErrorBoundary
├── Error display
├── Retry options
└── Fallback UI
```

## Data Flow Architecture

### 1. Waku → React Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Waku Network   │ →  │  React Hooks    │ →  │  UI Components  │
│                 │    │                 │    │                 │
│ Store + Filter  │    │ useState/Effect │    │   Render Data   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Step-by-step:**
1. **Waku Store**: Loads historical polls/votes on app start
2. **Waku Filter**: Receives new polls/votes in real-time
3. **React hooks**: Process and merge Waku data
4. **React state**: Holds processed data (polls, votes, UI state)
5. **Components**: Render data and handle user interactions

### 2. User → Waku Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  User Action    │ →  │ React Handler   │ →  │  Waku Network   │
│                 │    │                 │    │                 │
│ Create/Vote     │    │ Process + Send  │    │ Light Push      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

**Step-by-step:**
1. **User interacts**: Creates poll or casts vote
2. **React handler**: Validates input and creates message
3. **Protobuf encoding**: Serializes data for network
4. **Waku Light Push**: Sends message to network
5. **Network propagation**: Other peers receive via Filter

## User Experience Flow

### 1. First-Time User Journey

```
1. App loads → "Connecting to Waku network..."
2. Connection established → Generate identity automatically
3. Load historical data → "Loading existing polls..."
4. App ready → Show polls + creation form
5. Identity displayed → "You are voter: 0x1234..."
```

### 2. Creating a Poll

```
1. User types question → Validation in real-time
2. User adds options → Dynamic option fields
3. User submits → "Publishing poll..."
4. Waku confirms → "Poll created successfully!"
5. Poll appears → In local list immediately
6. Network sync → Other users see it via Filter
```

### 3. Voting Process

```
1. User sees poll → Options displayed as buttons
2. User clicks option → "Casting vote..."
3. Waku confirms → "Vote recorded!"
4. UI updates → Button disabled, shows user's choice
5. Results update → Real-time count changes
6. Network sync → Other users see updated results
```

## State Management Strategy

### React State Structure

```jsx
// App-level state
const [appState, setAppState] = useState({
  // Waku data (derived from network)
  polls: [],           // All polls from Store + Filter
  votes: [],           // All votes from Store + Filter

  // User state
  identity: null,      // User's cryptographic identity

  // UI state
  isLoading: true,     // App initialization status
  isCreatingPoll: false, // Poll creation in progress
  votingStates: {},    // Per-poll voting status

  // Network state
  wakuStatus: {
    connected: false,
    peerCount: 0,
    syncComplete: false
  },

  // Error state
  errors: []
});
```

### State Update Patterns

```jsx
// Pattern 1: Waku data updates (immutable)
const addNewPoll = (newPoll) => {
  setAppState(prev => ({
    ...prev,
    polls: [...prev.polls, newPoll].sort((a, b) => b.timestamp - a.timestamp)
  }));
};

// Pattern 2: UI state updates
const setVotingState = (pollId, state) => {
  setAppState(prev => ({
    ...prev,
    votingStates: {
      ...prev.votingStates,
      [pollId]: state
    }
  }));
};

// Pattern 3: Error handling
const addError = (error) => {
  setAppState(prev => ({
    ...prev,
    errors: [...prev.errors.slice(-4), error] // Keep last 5 errors
  }));
};
```

## Service Layer Architecture

### Waku Services

```jsx
// services/WakuService.js
class WakuService {
  constructor() {
    this.node = null;
    this.isInitialized = false;
  }

  async initialize() {
    // Create Light Node
    // Setup Store queries
    // Setup Filter subscriptions
    // Return initialized node
  }

  async publishPoll(pollData) {
    // Validate poll data
    // Encode with Protobuf
    // Send via Light Push
    // Return result
  }

  async castVote(voteData) {
    // Validate vote data
    // Encode with Protobuf
    // Send via Light Push
    // Return result
  }
}
```

### Identity Service

```jsx
// services/IdentityService.js
class IdentityService {
  static generateIdentity() {
    // Generate cryptographic keys
    // Return identity object
  }

  static storeIdentity(identity) {
    // Save to localStorage
  }

  static loadIdentity() {
    // Load from localStorage
    // Return identity or null
  }
}
```

## Network Architecture

### Waku Protocol Usage

```
┌─────────────────┐
│   Light Node    │ ← App runs this (minimal resources)
└─────────────────┘
         │
         ├── Light Push Protocol ← Publish polls/votes
         ├── Filter Protocol    ← Real-time subscriptions
         └── Store Protocol     ← Load historical data
```

### Content Topics

```
/decenvote/1/polls/proto  ← All poll creation messages
/decenvote/1/votes/proto  ← All vote casting messages
```

**Why this design:**
- **Simple**: Only 2 topics, easy to understand
- **Efficient**: Waku can optimize for fewer topics
- **Scalable**: No per-poll topics needed

### Message Flow

```
Poll Creation:
User Input → Validation → Protobuf → Light Push → Network → Other peers via Filter

Vote Casting:
User Click → Validation → Identity Check → Protobuf → Light Push → Network → Real-time updates
```

## Deployment Architecture

### Development Build
```bash
npm run dev  # Vite dev server with hot reload
```

### Production Build
```bash
npm run build    # Static files in dist/
npm run preview  # Preview production build
```

### Hosting Options
- **Static hosting**: Netlify, Vercel, GitHub Pages
- **IPFS**: Fully decentralized hosting
- **Local serving**: For demos and testing

## Error Handling Strategy

### Network Errors
```jsx
// Graceful degradation
if (!wakuConnected) {
  return <OfflineMode data={cachedData} />;
}
```

### User Errors
```jsx
// Clear feedback
if (votingError) {
  return <ErrorMessage error={votingError} onRetry={retryVote} />;
}
```

### Development Errors
```jsx
// Error boundaries with fallbacks
<ErrorBoundary fallback={<DevErrorDisplay />}>
  <App />
</ErrorBoundary>
```

## Performance Considerations

### Bundle Size
- **Minimal dependencies**: Only essential packages
- **Tree shaking**: Vite automatically removes unused code
- **Code splitting**: Dynamic imports for large features (if needed)

### Runtime Performance
- **React optimization**: `useMemo` and `useCallback` for expensive operations
- **Waku efficiency**: Proper subscription management
- **Memory management**: Cleanup on component unmount

### Network Efficiency
- **Message deduplication**: Prevent processing same message twice
- **Selective updates**: Only update UI when data actually changes
- **Connection pooling**: Reuse Waku connections

This architecture ensures DecenVote remains simple, educational, and demo-friendly while showcasing the power of decentralized protocols through Waku.