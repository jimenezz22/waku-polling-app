/**
 * ConnectionStatus Component
 *
 * Visual indicator for Waku network connection status
 * Shows different states: Connecting, Connected, Disconnected
 * Displays peer count when connected
 */

import React, { useEffect, useState } from 'react';
import { wakuService, WakuStatus } from '../services/WakuService';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ className = '' }) => {
  const [status, setStatus] = useState<WakuStatus>(wakuService.getStatus());

  useEffect(() => {
    // Update status every 2 seconds
    const interval = setInterval(() => {
      setStatus(wakuService.getStatus());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Determine status color and text
  const getStatusDisplay = () => {
    if (!status.connected && status.error) {
      return {
        icon: '🔴',
        text: 'Disconnected',
        className: 'status-disconnected',
        details: status.error
      };
    }

    if (!status.connected) {
      return {
        icon: '🟡',
        text: 'Connecting...',
        className: 'status-connecting',
        details: 'Establishing connection to Waku network'
      };
    }

    return {
      icon: '🟢',
      text: 'Connected',
      className: 'status-connected',
      details: `${status.peerCount} ${status.peerCount === 1 ? 'peer' : 'peers'}`
    };
  };

  const displayInfo = getStatusDisplay();

  return (
    <div className={`connection-status ${displayInfo.className} ${className}`}>
      <span className="status-icon" title={displayInfo.details}>
        {displayInfo.icon}
      </span>
      <span className="status-text">
        {displayInfo.text}
      </span>
      {status.connected && status.peerCount > 0 && (
        <span className="peer-count">
          ({status.peerCount} {status.peerCount === 1 ? 'peer' : 'peers'})
        </span>
      )}
    </div>
  );
};


export default ConnectionStatus;