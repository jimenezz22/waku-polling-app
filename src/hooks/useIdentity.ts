import { useState, useEffect } from 'react';
import { identityService, Identity } from '../services/IdentityService';

/**
 * Custom hook for managing user identity
 * Provides access to the current user's cryptographic identity
 *
 * @returns {Object} Identity state
 * @returns {Identity | null} identity - Current user identity
 * @returns {string} publicKey - Shortened public key for display
 * @returns {string} fullPublicKey - Full public key hex string
 *
 * @example
 * ```tsx
 * const { identity, publicKey, fullPublicKey } = useIdentity();
 *
 * return <div>Your ID: {publicKey}</div>;
 * ```
 */
export const useIdentity = () => {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    const userIdentity = identityService.getIdentity();
    setIdentity(userIdentity);
  }, []);

  const publicKey = identity?.publicKeyHex
    ? `${identity.publicKeyHex.substring(0, 16)}...`
    : '';

  return {
    identity,
    publicKey,
    fullPublicKey: identity?.publicKeyHex || ''
  };
};

export default useIdentity;