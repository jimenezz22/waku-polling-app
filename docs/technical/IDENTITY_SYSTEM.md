# DecenVote Identity System

## Overview

DecenVote uses Waku's cryptographic identity system to provide **anonymous but unique** voter identification. This enables vote integrity without compromising user privacy.

## Core Concepts

### Anonymous but Unique
- **Anonymous**: No personal information required or stored
- **Unique**: Each identity can only vote once per poll
- **Verifiable**: Votes are cryptographically signed and can be verified
- **Persistent**: Same identity across browser sessions

### Cryptographic Foundation

```
Private Key (secret) → Public Key (voter ID) → Signature (vote proof)
      ↓                      ↓                      ↓
  Stored locally      Sent with votes      Verifies authenticity
```

## Implementation

### Identity Generation

```js
import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";

// Generate a new cryptographic identity
const generateIdentity = () => {
  // Generate ECDSA private key (256-bit)
  const privateKey = generatePrivateKey();

  // Derive public key from private key
  const publicKey = getPublicKey(privateKey);

  return {
    privateKey,        // Uint8Array - keep secret!
    publicKey,         // Uint8Array - public voter ID
    privateKeyHex: bytesToHex(privateKey),  // For storage
    publicKeyHex: bytesToHex(publicKey),    // For display/voting
    created: Date.now()
  };
};

// Example generated identity
const identity = generateIdentity();
console.log({
  publicKey: identity.publicKeyHex,  // "0x04a1b2c3d4..." (voter ID)
  privateKey: "[HIDDEN]"             // Never log the private key!
});
```

### Secure Storage

```js
// Local storage with encryption consideration
class IdentityStorage {
  static STORAGE_KEY = 'decenvote_identity';

  // Store identity securely
  static store(identity) {
    const storageData = {
      privateKeyHex: identity.privateKeyHex,
      publicKeyHex: identity.publicKeyHex,
      created: identity.created,
      version: '1.0'
    };

    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(storageData)
      );
      console.log('Identity stored successfully');
    } catch (error) {
      console.error('Failed to store identity:', error);
      throw new Error('Identity storage failed');
    }
  }

  // Load identity from storage
  static load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const data = JSON.parse(stored);

      // Restore from hex strings
      const privateKey = hexToBytes(data.privateKeyHex);
      const publicKey = hexToBytes(data.publicKeyHex);

      return {
        privateKey,
        publicKey,
        privateKeyHex: data.privateKeyHex,
        publicKeyHex: data.publicKeyHex,
        created: data.created
      };
    } catch (error) {
      console.error('Failed to load identity:', error);
      return null;
    }
  }

  // Clear stored identity
  static clear() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Check if identity exists
  static exists() {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
}
```

### Identity Manager

```js
class IdentityManager {
  constructor() {
    this.identity = null;
    this.initialize();
  }

  // Initialize or create identity
  initialize() {
    // Try to load existing identity
    this.identity = IdentityStorage.load();

    if (!this.identity) {
      // Generate new identity if none exists
      this.identity = generateIdentity();
      IdentityStorage.store(this.identity);
      console.log('New identity created');
    } else {
      console.log('Existing identity loaded');
    }

    return this.identity;
  }

  // Get current identity
  getIdentity() {
    return this.identity;
  }

  // Get public key (voter ID)
  getPublicKey() {
    return this.identity?.publicKeyHex;
  }

  // Get truncated public key for display
  getDisplayId() {
    if (!this.identity) return 'No Identity';
    return `${this.identity.publicKeyHex.slice(0, 16)}...`;
  }

  // Reset identity (create new one)
  reset() {
    IdentityStorage.clear();
    this.identity = generateIdentity();
    IdentityStorage.store(this.identity);
    console.log('Identity reset');
    return this.identity;
  }

  // Verify identity integrity
  verify() {
    if (!this.identity) return false;

    try {
      // Verify that public key matches private key
      const derivedPublicKey = getPublicKey(this.identity.privateKey);
      const derivedHex = bytesToHex(derivedPublicKey);

      return derivedHex === this.identity.publicKeyHex;
    } catch (error) {
      console.error('Identity verification failed:', error);
      return false;
    }
  }
}
```

## Vote Signing

### Signing Votes

```js
import { createEncoder } from "@waku/message-encryption/symmetric";
import { generateSymmetricKey } from "@waku/message-encryption";

class VoteSigner {
  constructor(identity) {
    this.identity = identity;
    // Use a deterministic key for app-wide message encryption
    this.appKey = this.generateAppKey();
  }

  // Generate deterministic symmetric key for the app
  generateAppKey() {
    // In production, use a proper key derivation
    // For demo, we'll use a simple approach
    return generateSymmetricKey();
  }

  // Create encoder for signed votes
  createSignedEncoder(contentTopic) {
    return createEncoder({
      contentTopic: contentTopic,
      symKey: this.appKey,
      sigPrivKey: this.identity.privateKey // Signs with voter's private key
    });
  }

  // Sign a vote message
  async signVote(voteData, node, encoder) {
    try {
      // Create the vote message
      const protoMessage = VoteMessage.create({
        ...voteData,
        voterPublicKey: this.identity.publicKeyHex,
        timestamp: Date.now()
      });

      // Serialize message
      const payload = VoteMessage.encode(protoMessage).finish();

      // Send with signature
      const result = await node.lightPush.send(encoder, { payload });

      if (result.recipients.length > 0) {
        console.log('Vote signed and sent successfully');
        return { success: true, voteData };
      } else {
        throw new Error('Failed to send signed vote');
      }
    } catch (error) {
      console.error('Vote signing failed:', error);
      return { success: false, error: error.message };
    }
  }
}
```

### Signature Verification

```js
import { createDecoder } from "@waku/message-encryption/symmetric";

class VoteVerifier {
  constructor() {
    this.appKey = this.generateAppKey(); // Same key as signer
  }

  generateAppKey() {
    return generateSymmetricKey(); // Same as VoteSigner
  }

  // Create decoder for signed messages
  createSignedDecoder(contentTopic) {
    return createDecoder(contentTopic, this.appKey);
  }

  // Verify a vote message
  verifyVote(wakuMessage) {
    if (!wakuMessage.payload) {
      return { valid: false, reason: 'No payload' };
    }

    try {
      // Decode the vote data
      const voteData = VoteMessage.decode(wakuMessage.payload);

      // Check if message has signature
      if (!wakuMessage.signaturePublicKey) {
        return { valid: false, reason: 'No signature' };
      }

      // Convert claimed public key to bytes
      const claimedPublicKey = hexToBytes(voteData.voterPublicKey);

      // Verify signature matches claimed voter
      const signatureValid = wakuMessage.verifySignature(claimedPublicKey);

      if (signatureValid) {
        return {
          valid: true,
          voteData,
          voterPublicKey: voteData.voterPublicKey
        };
      } else {
        return {
          valid: false,
          reason: 'Signature verification failed'
        };
      }
    } catch (error) {
      return {
        valid: false,
        reason: `Verification error: ${error.message}`
      };
    }
  }
}
```

## React Integration

### Identity Hook

```jsx
// Custom hook for identity management
function useIdentity() {
  const [identity, setIdentity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const identityManager = new IdentityManager();
    const userIdentity = identityManager.getIdentity();

    setIdentity(userIdentity);
    setIsLoading(false);
  }, []);

  const resetIdentity = useCallback(() => {
    const identityManager = new IdentityManager();
    const newIdentity = identityManager.reset();
    setIdentity(newIdentity);
  }, []);

  return {
    identity,
    isLoading,
    resetIdentity,
    publicKey: identity?.publicKeyHex,
    displayId: identity ? `${identity.publicKeyHex.slice(0, 16)}...` : 'Loading...'
  };
}
```

### Identity Component

```jsx
function IdentityCard() {
  const { identity, displayId, resetIdentity } = useIdentity();
  const [showFullKey, setShowFullKey] = useState(false);

  if (!identity) {
    return <div>Loading identity...</div>;
  }

  return (
    <div className="identity-card">
      <h3>Your Voter Identity</h3>

      <div className="identity-info">
        <label>Voter ID:</label>
        <code className="voter-id">
          {showFullKey ? identity.publicKeyHex : displayId}
        </code>
        <button
          onClick={() => setShowFullKey(!showFullKey)}
          className="toggle-key"
        >
          {showFullKey ? 'Hide' : 'Show Full'}
        </button>
      </div>

      <div className="identity-actions">
        <button
          onClick={resetIdentity}
          className="reset-identity"
          title="Generate new identity (you'll lose access to previous votes)"
        >
          Generate New Identity
        </button>
      </div>

      <div className="identity-note">
        <small>
          This identity is stored locally and allows you to vote anonymously.
          Keep this browser/device to maintain the same identity.
        </small>
      </div>
    </div>
  );
}
```

## Security Considerations

### Private Key Protection

```js
// Security best practices
class SecurityManager {
  // Check if we're in a secure context
  static isSecureContext() {
    return window.isSecureContext || location.protocol === 'https:';
  }

  // Warn about insecure contexts
  static validateContext() {
    if (!this.isSecureContext()) {
      console.warn('⚠️ DecenVote should be used over HTTPS in production');
      return false;
    }
    return true;
  }

  // Clear sensitive data from memory (limited effectiveness in JS)
  static clearSensitiveData(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        if (key.includes('private') || key.includes('secret')) {
          delete data[key];
        }
      });
    }
  }

  // Generate secure random values
  static secureRandom(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }
}
```

### Advanced Storage (Production)

```js
// For production apps, consider using SubtleCrypto
class SecureIdentityStorage {
  static async storeWithEncryption(identity, userPassword) {
    try {
      // Derive key from user password
      const key = await this.deriveKey(userPassword);

      // Encrypt private key
      const encryptedData = await this.encrypt(
        identity.privateKeyHex,
        key
      );

      // Store encrypted data
      localStorage.setItem('decenvote_identity_secure', JSON.stringify({
        encryptedPrivateKey: encryptedData,
        publicKeyHex: identity.publicKeyHex,
        created: identity.created
      }));

    } catch (error) {
      console.error('Secure storage failed:', error);
      throw error;
    }
  }

  static async loadWithDecryption(userPassword) {
    try {
      const stored = localStorage.getItem('decenvote_identity_secure');
      if (!stored) return null;

      const data = JSON.parse(stored);
      const key = await this.deriveKey(userPassword);

      const privateKeyHex = await this.decrypt(
        data.encryptedPrivateKey,
        key
      );

      return {
        privateKey: hexToBytes(privateKeyHex),
        publicKey: hexToBytes(data.publicKeyHex),
        privateKeyHex,
        publicKeyHex: data.publicKeyHex,
        created: data.created
      };
    } catch (error) {
      console.error('Secure loading failed:', error);
      return null;
    }
  }

  static async deriveKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('decenvote-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(text, key) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(text)
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
  }

  static async decrypt(encryptedData, key) {
    const iv = new Uint8Array(encryptedData.iv);
    const data = new Uint8Array(encryptedData.data);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decrypted);
  }
}
```

## Demo Talking Points

### For Live Coding Session

1. **"No Registration Required"**
   - Show identity generation in browser console
   - Demonstrate that public key ≠ personal information

2. **"Anonymous but Unique"**
   - Same public key = same voter
   - No way to trace back to real identity
   - Cryptographically impossible to forge votes

3. **"Persistent Across Sessions"**
   - Close/reopen browser → same identity
   - Clear localStorage → new identity (different voter)

4. **"Cryptographic Integrity"**
   - Show signature verification in network tab
   - Demonstrate failed verification with wrong key

### Key Benefits to Highlight

- **Privacy**: No personal data stored or transmitted
- **Security**: Cryptographic signatures prevent vote forgery
- **Simplicity**: No account creation or login flow
- **Decentralized**: No central authority controlling identities

This identity system provides the foundation for secure, anonymous voting while maintaining the ability to prevent double-voting and verify vote authenticity.