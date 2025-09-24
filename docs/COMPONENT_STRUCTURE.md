# DecenVote Component Structure

## Component Philosophy

**Keep it Simple:**
- One component = one responsibility
- Minimal props
- Clear naming
- No over-abstraction

## Main Component Tree

```
App.jsx
├── Header.jsx (Connection status + Identity)
├── PollCreation.jsx (Create new polls)
├── PollList.jsx (List all polls)
│   └── PollCard.jsx (Individual poll)
│       └── VoteInterface.jsx (Voting buttons)
│       └── VoteResults.jsx (Results display)
└── Footer.jsx (Sync status)
```

## Core Components

### 1. App.jsx (Main Container)

```jsx
// App.jsx
import { LightNodeProvider } from '@waku/react';
import Header from './components/Header';
import PollCreation from './components/PollCreation';
import PollList from './components/PollList';
import Footer from './components/Footer';
import './App.css';

function App() {
  return (
    <LightNodeProvider options={{ defaultBootstrap: true }}>
      <div className="app">
        <Header />
        <main className="container">
          <PollCreation />
          <PollList />
        </main>
        <Footer />
      </div>
    </LightNodeProvider>
  );
}

export default App;
```

### 2. Header.jsx (Status Bar)

```jsx
// components/Header.jsx
import { useWaku } from '@waku/react';
import { useIdentity } from '../hooks/useIdentity';

function Header() {
  const { node, isLoading } = useWaku();
  const { identity } = useIdentity();

  return (
    <header className="header">
      <h1>DecenVote</h1>
      <div className="status">
        <span className={`connection ${node ? 'connected' : 'disconnected'}`}>
          {isLoading ? '⏳ Connecting...' : node ? '✅ Connected' : '❌ Disconnected'}
        </span>
        {identity && (
          <span className="identity">
            Voter: {identity.publicKeyHex.slice(0, 10)}...
          </span>
        )}
      </div>
    </header>
  );
}

export default Header;
```

### 3. PollCreation.jsx (Create Polls)

```jsx
// components/PollCreation.jsx
import { useState } from 'react';
import { useLightPush } from '@waku/react';
import { useIdentity } from '../hooks/useIdentity';

function PollCreation() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isCreating, setIsCreating] = useState(false);
  const { push } = useLightPush({ encoder: pollEncoder });
  const { identity } = useIdentity();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!push || !identity) return;

    setIsCreating(true);

    const pollData = {
      id: `poll_${Date.now()}`,
      question,
      options: options.filter(o => o.trim()),
      createdBy: identity.publicKeyHex,
      timestamp: Date.now()
    };

    // Create and send poll
    await createPoll(pollData, push);

    // Reset form
    setQuestion('');
    setOptions(['', '']);
    setIsCreating(false);
  };

  const addOption = () => setOptions([...options, '']);
  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  return (
    <div className="poll-creation">
      <h2>Create a Poll</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask a question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />

        {options.map((option, index) => (
          <input
            key={index}
            type="text"
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(e) => updateOption(index, e.target.value)}
            required
          />
        ))}

        <button type="button" onClick={addOption}>
          + Add Option
        </button>

        <button type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Create Poll'}
        </button>
      </form>
    </div>
  );
}

export default PollCreation;
```

### 4. PollList.jsx (Display Polls)

```jsx
// components/PollList.jsx
import { usePolls } from '../hooks/usePolls';
import PollCard from './PollCard';

function PollList() {
  const { polls, isLoading } = usePolls();

  if (isLoading) {
    return <div className="loading">Loading polls...</div>;
  }

  if (polls.length === 0) {
    return <div className="empty">No polls yet. Create the first one!</div>;
  }

  return (
    <div className="poll-list">
      <h2>Active Polls</h2>
      {polls.map((poll) => (
        <PollCard key={poll.id} poll={poll} />
      ))}
    </div>
  );
}

export default PollList;
```

### 5. PollCard.jsx (Individual Poll)

```jsx
// components/PollCard.jsx
import { useState } from 'react';
import VoteInterface from './VoteInterface';
import VoteResults from './VoteResults';
import { useVotes } from '../hooks/useVotes';

function PollCard({ poll }) {
  const [showResults, setShowResults] = useState(false);
  const { votes, hasVoted } = useVotes(poll.id);
  const userVoted = hasVoted(poll.id);

  return (
    <div className="poll-card">
      <h3>{poll.question}</h3>

      {!userVoted ? (
        <VoteInterface poll={poll} />
      ) : (
        <div className="voted-status">
          ✅ You voted
        </div>
      )}

      <button onClick={() => setShowResults(!showResults)}>
        {showResults ? 'Hide' : 'Show'} Results ({votes.length} votes)
      </button>

      {showResults && <VoteResults poll={poll} votes={votes} />}
    </div>
  );
}

export default PollCard;
```

### 6. VoteInterface.jsx (Voting Buttons)

```jsx
// components/VoteInterface.jsx
import { useState } from 'react';
import { useVoting } from '../hooks/useVoting';

function VoteInterface({ poll }) {
  const [isVoting, setIsVoting] = useState(false);
  const { castVote } = useVoting();

  const handleVote = async (optionIndex) => {
    setIsVoting(true);
    await castVote(poll.id, optionIndex);
    setIsVoting(false);
  };

  return (
    <div className="vote-interface">
      {poll.options.map((option, index) => (
        <button
          key={index}
          onClick={() => handleVote(index)}
          disabled={isVoting}
          className="vote-option"
        >
          {option}
        </button>
      ))}
      {isVoting && <span>Casting vote...</span>}
    </div>
  );
}

export default VoteInterface;
```

### 7. VoteResults.jsx (Results Display)

```jsx
// components/VoteResults.jsx
function VoteResults({ poll, votes }) {
  const calculateResults = () => {
    const counts = poll.options.map(() => 0);

    votes.forEach(vote => {
      if (vote.optionIndex < counts.length) {
        counts[vote.optionIndex]++;
      }
    });

    const total = votes.length;

    return poll.options.map((option, index) => ({
      option,
      count: counts[index],
      percentage: total > 0 ? Math.round((counts[index] / total) * 100) : 0
    }));
  };

  const results = calculateResults();

  return (
    <div className="vote-results">
      {results.map((result, index) => (
        <div key={index} className="result-item">
          <span>{result.option}</span>
          <div className="result-bar">
            <div
              className="result-fill"
              style={{ width: `${result.percentage}%` }}
            />
          </div>
          <span>{result.count} ({result.percentage}%)</span>
        </div>
      ))}
    </div>
  );
}

export default VoteResults;
```

### 8. Footer.jsx (Sync Status)

```jsx
// components/Footer.jsx
function Footer() {
  return (
    <footer className="footer">
      <span>Powered by Waku Network</span>
      <span>Fully decentralized • No servers required</span>
    </footer>
  );
}

export default Footer;
```

## Custom Hooks

### useIdentity.js

```jsx
// hooks/useIdentity.js
import { useState, useEffect } from 'react';
import { generatePrivateKey, getPublicKey } from '@waku/message-encryption';
import { bytesToHex } from '@waku/utils/bytes';

export function useIdentity() {
  const [identity, setIdentity] = useState(null);

  useEffect(() => {
    // Load or create identity
    let stored = localStorage.getItem('decenvote_identity');

    if (!stored) {
      const privateKey = generatePrivateKey();
      const publicKey = getPublicKey(privateKey);

      const newIdentity = {
        privateKey,
        publicKey,
        publicKeyHex: bytesToHex(publicKey)
      };

      localStorage.setItem('decenvote_identity', bytesToHex(privateKey));
      setIdentity(newIdentity);
    } else {
      // Restore from storage
      const privateKey = hexToBytes(stored);
      const publicKey = getPublicKey(privateKey);

      setIdentity({
        privateKey,
        publicKey,
        publicKeyHex: bytesToHex(publicKey)
      });
    }
  }, []);

  return { identity };
}
```

### usePolls.js

```jsx
// hooks/usePolls.js
import { useEffect, useState } from 'react';
import { useFilterMessages, useStoreMessages } from '@waku/react';
import { createDecoder } from '@waku/sdk';

const pollDecoder = createDecoder('/decenvote/1/polls/proto');

export function usePolls() {
  const [polls, setPolls] = useState([]);
  const { messages: livePolls } = useFilterMessages({ decoder: pollDecoder });
  const { messages: historicalPolls } = useStoreMessages({ decoder: pollDecoder });

  useEffect(() => {
    // Merge historical and live polls
    const allPolls = [...historicalPolls, ...livePolls];
    const uniquePolls = deduplicatePolls(allPolls);
    setPolls(uniquePolls);
  }, [historicalPolls, livePolls]);

  return {
    polls,
    isLoading: historicalPolls.length === 0 && livePolls.length === 0
  };
}
```

### useVoting.js

```jsx
// hooks/useVoting.js
import { useLightPush } from '@waku/react';
import { createEncoder } from '@waku/sdk';
import { useIdentity } from './useIdentity';

const voteEncoder = createEncoder({ contentTopic: '/decenvote/1/votes/proto' });

export function useVoting() {
  const { push } = useLightPush({ encoder: voteEncoder });
  const { identity } = useIdentity();

  const castVote = async (pollId, optionIndex) => {
    if (!push || !identity) return;

    const voteData = {
      pollId,
      optionIndex,
      voterPublicKey: identity.publicKeyHex,
      timestamp: Date.now()
    };

    // Send vote via Waku
    const result = await push({ payload: encodeVote(voteData) });
    return result;
  };

  return { castVote };
}
```

## Simple Styling

### App.css

```css
/* Keep it minimal and clean */
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: system-ui, -apple-system, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
  border-bottom: 2px solid #eee;
}

.connection.connected {
  color: green;
}

.connection.disconnected {
  color: red;
}

.poll-card {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.vote-option {
  display: block;
  width: 100%;
  padding: 10px;
  margin: 5px 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.vote-option:hover {
  background: #f0f0f0;
}

.result-bar {
  background: #eee;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
}

.result-fill {
  background: #4CAF50;
  height: 100%;
  transition: width 0.3s;
}
```

## Component Guidelines

### Do's ✅
- Keep components under 100 lines
- Use clear, descriptive names
- One component per file
- Pass minimal props
- Handle loading and error states

### Don'ts ❌
- Over-engineer with unnecessary abstractions
- Create deeply nested component trees
- Use complex state management
- Add dependencies without clear need
- Optimize prematurely

This structure keeps DecenVote simple, understandable, and perfect for live coding demonstrations!