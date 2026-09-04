// Cross-tab and in-window real-time synchronization channel
export type SyncEvent = 
  | { type: 'CATALOGUE_UPDATED'; timestamp: number }
  | { type: 'SETTINGS_UPDATED'; timestamp: number }
  | { type: 'CATEGORIES_UPDATED'; timestamp: number }
  | { type: 'PROMOS_UPDATED'; timestamp: number };

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel('matilda_sync_channel');
  }
} catch (e) {
  // BroadcastChannel fallback if not supported
}

export function broadcastSync(event: SyncEvent) {
  try {
    if (channel) {
      channel.postMessage(event);
    }
  } catch (e) {}

  if (typeof window !== 'undefined') {
    if (event.type === 'CATALOGUE_UPDATED') {
      window.dispatchEvent(new CustomEvent('matilda-catalogue-updated', { detail: event }));
    } else if (event.type === 'SETTINGS_UPDATED') {
      window.dispatchEvent(new CustomEvent('matilda-settings-updated', { detail: event }));
    } else if (event.type === 'CATEGORIES_UPDATED') {
      window.dispatchEvent(new CustomEvent('matilda-categories-updated', { detail: event }));
      window.dispatchEvent(new CustomEvent('matilda-catalogue-updated', { detail: event }));
    } else if (event.type === 'PROMOS_UPDATED') {
      window.dispatchEvent(new CustomEvent('matilda-promos-updated', { detail: event }));
    }
  }
}

export function subscribeToSync(onEvent: (event: SyncEvent) => void): () => void {
  const channelHandler = (msg: MessageEvent) => {
    if (msg?.data && msg.data.type) {
      onEvent(msg.data);
    }
  };

  const windowHandler = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom?.detail) {
      onEvent(custom.detail);
    } else {
      if (e.type === 'matilda-catalogue-updated') onEvent({ type: 'CATALOGUE_UPDATED', timestamp: Date.now() });
      if (e.type === 'matilda-settings-updated') onEvent({ type: 'SETTINGS_UPDATED', timestamp: Date.now() });
      if (e.type === 'matilda-categories-updated') onEvent({ type: 'CATEGORIES_UPDATED', timestamp: Date.now() });
      if (e.type === 'matilda-promos-updated') onEvent({ type: 'PROMOS_UPDATED', timestamp: Date.now() });
    }
  };

  if (channel) {
    channel.addEventListener('message', channelHandler);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('matilda-catalogue-updated', windowHandler);
    window.addEventListener('matilda-settings-updated', windowHandler);
    window.addEventListener('matilda-categories-updated', windowHandler);
    window.addEventListener('matilda-promos-updated', windowHandler);
  }

  return () => {
    if (channel) {
      channel.removeEventListener('message', channelHandler);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('matilda-catalogue-updated', windowHandler);
      window.removeEventListener('matilda-settings-updated', windowHandler);
      window.removeEventListener('matilda-categories-updated', windowHandler);
      window.removeEventListener('matilda-promos-updated', windowHandler);
    }
  };
}
