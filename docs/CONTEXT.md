# DecenVote: Decentralized Polling App - Implementation Context

## Application Overview
A real-time decentralized polling/voting application that demonstrates multiple Waku protocols working together without requiring centralized servers or user registration.

## Core Functionality
**Poll Creation**: Users create polls with custom questions and multiple choice options
**Anonymous Voting**: Users vote on polls using cryptographically unique but anonymous identities
**Real-time Results**: Vote counts update instantly across all connected clients
**Persistent History**: Polls and votes persist when users disconnect and reconnect

## Technical Architecture

### Message Structure
**Poll Messages**:
```
{
  id: string,
  question: string,
  options: string[],
  createdBy: string (public key),
  timestamp: number
}
```

**Vote Messages**:
```
{
  pollId: string,
  optionIndex: number,
  voterPublicKey: string,
  signature: string,
  timestamp: number
}
```

### Waku Protocol Integration

**Light Push Protocol**:
- Publishes new polls to `/decenvote/1/polls/proto` topic
- Sends votes to `/decenvote/1/votes/proto` topic
- Enables publishing without maintaining full-time network connection

**Filter Protocol**:
- Subscribes to receive new polls and votes in real-time
- Filters messages by content topics
- Enables lightweight client participation

**Store Protocol**:
- Retrieves historical polls when users reconnect
- Fetches past votes to calculate current totals
- Provides persistence without centralized database

**Waku Identity System**:
- Generates unique cryptographic key pairs for each user
- Uses public keys as anonymous but unique voter identifiers
- Signs votes to prevent forgery while maintaining privacy
- Prevents duplicate voting through public key tracking

### Content Topic Structure
- **Polls Topic**: `/decenvote/1/polls/proto` - All poll creation messages
- **Votes Topic**: `/decenvote/1/votes/proto` - All vote submission messages

Single topics for each message type rather than per-poll topics for efficiency and Waku optimization.

### Data Flow
1. User creates poll → Publish via Light Push to polls topic
2. Connected clients receive poll via Filter subscription
3. User votes on poll → Sign vote with Waku identity, publish via Light Push
4. All clients receive vote via Filter, update local vote counts
5. New users joining → Query Store protocol for historical polls and votes
6. Vote deduplication → Check if public key already voted on specific poll

### Identity and Privacy
**Anonymous but Unique**: Waku identity provides pseudonymous identification without personal information
**Vote Integrity**: Cryptographic signatures prevent vote forgery
**No Registration**: Users automatically get identities without signup process
**Local Storage**: Private keys stored locally in browser storage

### MVP Components
**Poll Creation Interface**: Form with question input and dynamic option fields
**Poll Display**: List of active polls with voting buttons
**Results Visualization**: Real-time vote counts and percentages
**Network Status**: Connection indicator and peer count

### Demo Timeline (30 minutes)
- Minutes 1-5: Problem explanation and app setup
- Minutes 6-12: Waku integration (Light Node, protocols)
- Minutes 13-20: Poll creation and publishing
- Minutes 21-27: Voting mechanism and real-time updates
- Minutes 28-30: Identity system explanation and value demonstration

### Key Technical Decisions
**Storage Strategy**: Waku Store for persistence, no external database
**Identity Management**: Waku native identity, abstracted from users
**Message Validation**: Cryptographic signatures for vote integrity
**UI Framework**: React for demonstration
**Deployment**: Static hosting possible due to serverless architecture

### Post-Demo Value
The completed application serves as a starter template demonstrating:
- Multi-protocol Waku integration patterns
- Identity management in decentralized apps
- Real-time data synchronization without servers
- Production-ready error handling and security practices

This context provides the foundation for implementing a comprehensive example of Waku's decentralized communication capabilities in a practical, interactive application.