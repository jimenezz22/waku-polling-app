# DecenVote — Initial Prompt for LLM's

**Goal:** Build a decentralized voting application named **DecenVote** using **Waku SDK v0.0.35** with **ReliableChannel**.

## Instructions

Follow **exactly** the documentation at `docs/workshops/DEVELOPMENT_PHASES.md` to implement the application **phase by phase**:

### Phases

0. **Phase 0:** Analyze the context. 
1. **Phase 1:** Initial project setup — React with TypeScript
2. **Phase 2:** Integration of `WakuService` and `IdentityService`
3. **Phase 3:** Implementation of `ReliableChannelService` and data protocols
4. **Phase 4:** Creation of UI components and state hooks
5. **Phase 5:** Voting logic and validation

Start with **Phase 0** and advance **sequentially**. **Ask me for confirmation before proceeding to each new phase.**

## Architecture 

Use exactly the modular architecture documented in `docs/technical/ARCHITECTURE.md`

* `WakuConfig` — centralized configuration
* `DataValidator` — data validation
* `DataProcessor` — automatic buffering/processing
* `ReliableChannelService` — bidirectional communication
* `StoreService` — historical data storage with graceful degradation

## Implementation

Implement according to the patterns and guidelines in:

* `docs/technical/WAKU_IMPLEMENTATION_GUIDE.md`
* `docs/technical/REAL_TIME_SYNC.md`
