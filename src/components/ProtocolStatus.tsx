import React from 'react';
import { useWaku } from '../hooks/useWaku';

/**
 * Component to display the status of different Waku protocols
 * Helps users understand what functionality is available
 */
export const ProtocolStatus: React.FC = () => {
  const { isReady } = useWaku();

  if (!isReady) {
    return null; // Don't show until connected
  }

  return (
    <div className="protocol-status">
      <h3>Network Status</h3>
      <div className="protocol-list">
        <div className="protocol-item">
          <span className="protocol-icon">✅</span>
          <span className="protocol-name">Poll Creation</span>
          <span className="protocol-desc">Ready (LightPush available)</span>
        </div>

        <div className="protocol-item">
          <span className="protocol-icon">✅</span>
          <span className="protocol-name">Real-time Updates</span>
          <span className="protocol-desc">Ready (Filter available)</span>
        </div>

        <div className="protocol-item">
          <span className="protocol-icon">⚠️</span>
          <span className="protocol-name">Historical Data</span>
          <span className="protocol-desc">Not available (Store peers not found)</span>
        </div>
      </div>

      <div className="protocol-note">
        <p><strong>Note:</strong> Historical data will become available once polls are created and shared across the network.</p>
      </div>
    </div>
  );
};

export default ProtocolStatus;