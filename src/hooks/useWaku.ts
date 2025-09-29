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

  // Add window cleanup listener
  useEffect(() => {
    const handleWindowClose = () => {
      console.log('🚪 Window closing - cleaning up Waku');
      wakuService.cleanup().catch((error) => {
        console.error('Failed to cleanup on window close:', error);
      });
    };

    window.addEventListener('beforeunload', handleWindowClose);

    return () => {
      window.removeEventListener('beforeunload', handleWindowClose);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const initWaku = async () => {
      try {
        setIsInitializing(true);

        // Initialize Waku if not already done
        if (!wakuService.checkIsInitialized() && mounted) {
          await wakuService.initialize();
        }

        setStatus(wakuService.getStatus());

        // Create DataService once Waku is ready (only if we don't have one)
        if (wakuService.isReady() && !dataService) {
          console.log('🔗 Creating initial DataService');
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

      // Create DataService when connection becomes ready (only once)
      if (newStatus.connected && newStatus.syncComplete && !dataService && wakuService.isReady()) {
        console.log('🔗 Creating DataService from status change');
        const service = new DataService(wakuService);
        setDataService(service);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      // Don't cleanup Waku on component unmount in development
      // React StrictMode causes double mounting/unmounting
      // Only cleanup when the entire app unmounts (window close)
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