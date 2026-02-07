/**
 * Lightweight event bus for coordinating UI refreshes
 *
 * Usage:
 *   eventBus.emit('ui-refresh');
 *   const unsubscribe = eventBus.subscribe('ui-refresh', callback);
 */

type EventMap = {
  'ui-refresh': void;
};

export const eventBus = {
  /**
   * Emit an event to all subscribers
   */
  emit: <K extends keyof EventMap>(event: K, data?: EventMap[K]) => {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  },

  /**
   * Subscribe to an event
   * Returns an unsubscribe function for cleanup
   */
  subscribe: <K extends keyof EventMap>(
    event: K,
    callback: (data?: EventMap[K]) => void
  ): (() => void) => {
    const handler = (e: Event) => callback((e as CustomEvent).detail);
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  },
};
