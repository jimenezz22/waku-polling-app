/**
 * StoreErrorPatcher - Handles Store protocol error suppression for ReliableChannel
 *
 * This utility patches ReliableChannel instances to gracefully handle Store protocol
 * errors, preventing them from breaking the application when Store peers are unavailable.
 * The app continues to work with real-time data even without historical data access.
 */

export class StoreErrorPatcher {
  /**
   * Apply Store error suppression patches to a ReliableChannel instance
   * @param reliableChannel - The ReliableChannel instance to patch
   */
  static patchChannel(reliableChannel: any): void {
    if (!reliableChannel) {
      console.warn("⚠️ No reliable channel provided for patching");
      return;
    }

    // Patch the MissingMessageRetriever to handle Store errors gracefully
    this.patchMissingMessageRetriever(reliableChannel);
  }

  /**
   * Patch the MissingMessageRetriever component to suppress Store errors
   */
  private static patchMissingMessageRetriever(reliableChannel: any): void {
    if (!reliableChannel.missingMessageRetriever) {
      return;
    }

    console.log('🔧 Patching MissingMessageRetriever to handle Store errors gracefully');

    // Patch the _retrieve method to handle Store errors gracefully
    if (reliableChannel.missingMessageRetriever._retrieve) {
      const original_retrieve = reliableChannel.missingMessageRetriever._retrieve.bind(
        reliableChannel.missingMessageRetriever
      );

      reliableChannel.missingMessageRetriever._retrieve = async function* (...args: any[]) {
        try {
          // Try the original retrieve method
          const iterator = original_retrieve(...args);
          for await (const item of iterator) {
            yield item;
          }
        } catch (error: any) {
          if (StoreErrorPatcher.isStoreError(error)) {
            console.warn('⚠️ Store protocol error suppressed in _retrieve:', error);
            // Return empty iterator instead of throwing
            return;
          }
          // Re-throw non-Store errors
          throw error;
        }
      };
    }

    // Patch the main retrieveMissingMessage method
    const originalRetrieveMissingMessage = reliableChannel.missingMessageRetriever.retrieveMissingMessage.bind(
      reliableChannel.missingMessageRetriever
    );

    reliableChannel.missingMessageRetriever.retrieveMissingMessage = async (...args: any[]) => {
      try {
        return await originalRetrieveMissingMessage(...args);
      } catch (error: any) {
        if (StoreErrorPatcher.isStoreError(error)) {
          console.warn('⚠️ Store protocol error suppressed in retrieveMissingMessage:', error);
          // Return empty array instead of throwing
          return [];
        }
        // Re-throw non-Store errors
        throw error;
      }
    };
  }

  /**
   * Check if an error is Store protocol related
   */
  private static isStoreError(error: any): boolean {
    const errorStr = error?.toString?.() || String(error);

    return errorStr.includes('No peers available to query') ||
           errorStr.includes('Store') ||
           errorStr.includes('store') ||
           errorStr.includes('is not a function or its return value is not async iterable');
  }

  /**
   * Setup event listeners with Store error handling
   * @param reliableChannel - The ReliableChannel instance
   * @param channelId - The channel identifier for logging
   * @param onError - Optional error callback for non-Store errors
   */
  static setupErrorHandling(
    reliableChannel: any,
    channelId: string,
    onError?: (error: Error) => void
  ): void {
    // Handle Store protocol errors gracefully
    reliableChannel.addEventListener("error", (event: any) => {
      const error = event.detail || event.error || 'Unknown error';

      if (this.isStoreError(error)) {
        console.warn(`⚠️ Store protocol error in ${channelId} - continuing without historical data`);
        // Don't propagate Store errors to prevent UI disruption
        return;
      }

      // For non-Store errors, call the error callback if provided
      console.error(`ReliableChannel error for ${channelId}:`, error);
      onError?.(new Error(`ReliableChannel error for ${channelId}: ${error}`));
    });

    // Handle missing message retriever errors (Store-related)
    reliableChannel.addEventListener("missing-message-retriever-error", () => {
      console.warn(`⚠️ MissingMessageRetriever error for ${channelId} (handled gracefully)`);
      // These are Store-related, so don't propagate to UI
    });
  }
}

export default StoreErrorPatcher;