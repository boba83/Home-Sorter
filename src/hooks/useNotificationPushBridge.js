import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';

const PUSH_SEEN_KEY = 'hs_push_seen_notification_ids';

function loadSeenIds() {
  try {
    const raw = sessionStorage.getItem(PUSH_SEEN_KEY);
    return new Set(Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveSeenIds(set) {
  const arr = [...set].slice(-300);
  sessionStorage.setItem(PUSH_SEEN_KEY, JSON.stringify(arr));
}

/** Označi postojeće kao viđene da se pri uključivanju ne pošalje stari spam. */
export async function markExistingNotificationsAsSeenForPush() {
  const items = await api.notifications.list();
  const seen = loadSeenIds();
  for (const n of items) seen.add(n.id);
  saveSeenIds(seen);
}

/**
 * Kad je dozvola za Notification uključena, prikazuje sistemski popup
 * za nove nepročitane (radi dok je sajt otvoren u browseru / PWA).
 */
export function useNotificationPushBridge(enabled) {
  const seenRef = useRef(loadSeenIds());
  const canUse =
    enabled && typeof window !== 'undefined' && 'Notification' in window;

  const pushEnabled = canUse && Notification.permission === 'granted';

  const { data: items = [] } = useQuery({
    queryKey: ['notifications', 'push-bridge'],
    queryFn: () => api.notifications.list(),
    refetchInterval: pushEnabled ? 20000 : false,
    enabled: pushEnabled,
  });

  useEffect(() => {
    if (!pushEnabled || !items.length) return;

    let changed = false;
    for (const n of items) {
      if (n.read || seenRef.current.has(n.id)) continue;
      seenRef.current.add(n.id);
      changed = true;
      try {
        const notification = new Notification(n.title || 'Home Sorter', {
          body: n.message || '',
          tag: `hs-notif-${n.id}`,
          renotify: true,
        });
        notification.onclick = () => {
          window.focus();
          window.location.assign('/TaskManager');
          notification.close();
        };
      } catch {
        /* ignore — npr. zabranjeno u iframe */
      }
    }
    if (changed) saveSeenIds(seenRef.current);
  }, [items, pushEnabled]);
}
