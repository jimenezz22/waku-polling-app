/**
 * IdentityService - Manages cryptographic identities for DecenVote
 *
 * This service provides:
 * - Anonymous but unique voter identities
 * - Cryptographic key generation and management
 * - Secure local storage of private keys
 * - Identity verification and validation
 */

import { generatePrivateKey, getPublicKey } from "@waku/message-encryption";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";

export interface Identity {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  privateKeyHex: string;
  publicKeyHex: string;
  created: number;
}

export interface StoredIdentityData {
  privateKeyHex: string;
  publicKeyHex: string;
  created: number;
  version: string;
}

/**
 * Secure storage management for identity data
 */
export class IdentityStorage {
  private static readonly STORAGE_KEY = 'decenvote_identity';
  private static readonly VERSION = '1.0';

  /**
   * Store identity securely in localStorage
   */
  static store(identity: Identity): void {
    const storageData: StoredIdentityData = {
      privateKeyHex: identity.privateKeyHex,
      publicKeyHex: identity.publicKeyHex,
      created: identity.created,
      version: this.VERSION
    };

    try {
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(storageData)
      );
      console.log('✅ Identity stored successfully');
    } catch (error) {
      console.error('❌ Failed to store identity:', error);
      throw new Error('Identity storage failed');
    }
  }

  /**
   * Load identity from localStorage
   */
  static load(): Identity | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const data: StoredIdentityData = JSON.parse(stored);

      // Verify data format
      if (!data.privateKeyHex || !data.publicKeyHex || !data.created) {
        console.warn('⚠️ Invalid stored identity data');
        return null;
      }

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
      console.error('❌ Failed to load identity:', error);
      return null;
    }
  }

  /**
   * Clear stored identity
   */
  static clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ Identity storage cleared');
  }

  /**
   * Check if identity exists in storage
   */
  static exists(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
}

/**
 * Main identity management service
 */
export class IdentityService {
  private identity: Identity | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize or create identity
   */
  private initialize(): Identity {
    // Try to load existing identity
    this.identity = IdentityStorage.load();

    if (!this.identity) {
      // Generate new identity if none exists
      this.identity = this.generateIdentity();
      IdentityStorage.store(this.identity);
      console.log('🆔 New identity created');
    } else {
      console.log('📥 Existing identity loaded');

      // Verify identity integrity
      if (!this.verify()) {
        console.warn('⚠️ Identity verification failed, generating new one');
        this.identity = this.generateIdentity();
        IdentityStorage.store(this.identity);
      }
    }

    return this.identity;
  }

  /**
   * Generate a new cryptographic identity
   */
  private generateIdentity(): Identity {
    // Generate ECDSA private key (256-bit)
    const privateKey = generatePrivateKey();

    // Derive public key from private key
    const publicKey = getPublicKey(privateKey);

    const identity: Identity = {
      privateKey,
      publicKey,
      privateKeyHex: bytesToHex(privateKey),
      publicKeyHex: bytesToHex(publicKey),
      created: Date.now()
    };

    console.log('🔑 Generated new identity:', {
      publicKey: identity.publicKeyHex.slice(0, 16) + '...',
      created: new Date(identity.created).toISOString()
    });

    return identity;
  }

  /**
   * Get current identity
   */
  getIdentity(): Identity | null {
    return this.identity;
  }

  /**
   * Get public key (voter ID) as hex string
   */
  getPublicKey(): string | null {
    return this.identity?.publicKeyHex || null;
  }

  /**
   * Get truncated public key for display
   */
  getDisplayId(length: number = 16): string {
    if (!this.identity) {
      return 'No Identity';
    }

    const publicKey = this.identity.publicKeyHex;
    return publicKey.length > length
      ? `${publicKey.slice(0, length)}...`
      : publicKey;
  }

  /**
   * Get private key for signing operations
   */
  getPrivateKey(): Uint8Array | null {
    return this.identity?.privateKey || null;
  }

  /**
   * Reset identity (create new one)
   */
  reset(): Identity {
    IdentityStorage.clear();
    this.identity = this.generateIdentity();
    IdentityStorage.store(this.identity);
    console.log('🔄 Identity reset');
    return this.identity;
  }

  /**
   * Verify identity integrity
   */
  verify(): boolean {
    if (!this.identity) {
      return false;
    }

    try {
      // Verify that public key matches private key
      const derivedPublicKey = getPublicKey(this.identity.privateKey);
      const derivedHex = bytesToHex(derivedPublicKey);

      const isValid = derivedHex === this.identity.publicKeyHex;

      if (isValid) {
        console.log('✅ Identity verification successful');
      } else {
        console.error('❌ Identity verification failed - key mismatch');
      }

      return isValid;
    } catch (error) {
      console.error('❌ Identity verification failed:', error);
      return false;
    }
  }

  /**
   * Get identity age in milliseconds
   */
  getAge(): number {
    if (!this.identity) {
      return 0;
    }
    return Date.now() - this.identity.created;
  }

  /**
   * Get human-readable identity age
   */
  getAgeString(): string {
    const age = this.getAge();

    if (age < 60000) { // Less than 1 minute
      return 'Just created';
    } else if (age < 3600000) { // Less than 1 hour
      return `${Math.floor(age / 60000)} minutes ago`;
    } else if (age < 86400000) { // Less than 1 day
      return `${Math.floor(age / 3600000)} hours ago`;
    } else {
      return `${Math.floor(age / 86400000)} days ago`;
    }
  }

  /**
   * Export identity data (for backup purposes)
   * WARNING: This exports the private key!
   */
  exportIdentity(): StoredIdentityData | null {
    if (!this.identity) {
      return null;
    }

    return {
      privateKeyHex: this.identity.privateKeyHex,
      publicKeyHex: this.identity.publicKeyHex,
      created: this.identity.created,
      version: '1.0'
    };
  }

  /**
   * Import identity data (restore from backup)
   */
  importIdentity(data: StoredIdentityData): boolean {
    try {
      const privateKey = hexToBytes(data.privateKeyHex);
      const publicKey = hexToBytes(data.publicKeyHex);

      // Verify key pair consistency
      const derivedPublicKey = getPublicKey(privateKey);
      const derivedHex = bytesToHex(derivedPublicKey);

      if (derivedHex !== data.publicKeyHex) {
        console.error('❌ Invalid key pair in import data');
        return false;
      }

      this.identity = {
        privateKey,
        publicKey,
        privateKeyHex: data.privateKeyHex,
        publicKeyHex: data.publicKeyHex,
        created: data.created
      };

      IdentityStorage.store(this.identity);
      console.log('✅ Identity imported successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to import identity:', error);
      return false;
    }
  }

  /**
   * Check if this identity has voted on a specific poll
   * (This is a helper method - actual vote tracking happens in voting service)
   */
  hasVotedOnPoll(pollId: string, votes: any[]): boolean {
    if (!this.identity) {
      return false;
    }

    return votes.some(vote =>
      vote.pollId === pollId &&
      vote.voterPublicKey === this.identity!.publicKeyHex
    );
  }
}

/**
 * Security utilities for identity management
 */
export class IdentitySecurity {
  /**
   * Check if we're in a secure context
   */
  static isSecureContext(): boolean {
    return window.isSecureContext || window.location.protocol === 'https:';
  }

  /**
   * Validate context and warn about security issues
   */
  static validateContext(): boolean {
    if (!this.isSecureContext()) {
      console.warn('⚠️ DecenVote should be used over HTTPS in production for security');
      return false;
    }
    return true;
  }

  /**
   * Generate secure random values
   */
  static secureRandom(length: number): Uint8Array {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return array;
  }

  /**
   * Clear sensitive data from memory (limited effectiveness in JS)
   */
  static clearSensitiveData(data: any): void {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        if (key.includes('private') || key.includes('secret')) {
          delete data[key];
        }
      });
    }
  }
}

// Export singleton instance for simple usage
export const identityService = new IdentityService();

export default IdentityService;