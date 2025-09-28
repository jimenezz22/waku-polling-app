import { useState, useEffect } from 'react';
import { wakuService, WakuStatus } from '../services/WakuService';
import { DataService } from '../services/DataService';

/**
 * Custom hook for managing Waku connection and DataService
 * Provides connection status and centralized data service instance
 *
 * @returns {Object} Waku state and services
 * @returns {WakuStatus} status - Current connection status
 * @returns {boolean} isConnected - Whether connected to Waku network
 * @returns {boolean} isReady - Whether ready to send/receive messages
 * @returns {DataService | null} dataService - DataService instance when connected
 * @returns {Function} reconnect - Manual reconnection function
 *
 * @example
 * ```tsx
 * const { status, isConnected, dataService, reconnect } = useWaku();
 *
 * if (!isConnected) {
 *   return <div>Connecting to Waku network...</div>;
 * }
 * ```
 */
export const useWaku = () => {
  const [status, setStatus] = useState<WakuStatus>({
    connected: false,
    peerCount: 0,
    syncComplete: false,
    error: null
  });
  const [dataService, setDataService] = useState<DataService | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initWaku = async () => {
      try {
        setIsInitializing(true);

        // Initialize Waku if not already done
        if (!wakuService.checkIsInitialized()) {
          await wakuService.initialize();
        }

        setStatus(wakuService.getStatus());

        // Create DataService once Waku is ready
        if (wakuService.isReady()) {
          const service = new DataService(wakuService);
          setDataService(service);
        }
      } catch (error) {
        console.error('Failed to initialize Waku:', error);
        setStatus(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Connection failed'
        }));
      } finally {
        setIsInitializing(false);
      }
    };

    initWaku();

    // Subscribe to status updates
    const unsubscribe = wakuService.onStatusChange((newStatus) => {
      setStatus(newStatus);

      // Create DataService when connection becomes ready
      if (newStatus.connected && newStatus.syncComplete && !dataService) {
        const service = new DataService(wakuService);
        setDataService(service);
      }
    });

    return () => {
      unsubscribe();
      // Cleanup on unmount
      wakuService.cleanup().catch((error) => {
        console.error('Failed to cleanup Waku service:', error);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reconnect = async () => {
    try {
      setStatus(prev => ({ ...prev, error: null }));
      await wakuService.reconnect();
      setStatus(wakuService.getStatus());
    } catch (error) {
      console.error('Reconnection failed:', error);
      setStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Reconnection failed'
      }));
    }
  };

  return {
    status,
    isConnected: status.connected,
    isReady: status.connected && status.syncComplete,
    isInitializing,
    dataService,
    reconnect
  };
};

export default useWaku;