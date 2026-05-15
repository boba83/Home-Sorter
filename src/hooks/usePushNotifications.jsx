import { useEffect, useState } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const sendNotification = (title, body, options = {}) => {
    if (permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
    setTimeout(() => n.close(), 6000);
    return n;
  };

  return { permission, requestPermission, sendNotification };
}

// Parsuje @pomeni iz teksta komentara i vraca niz emailova/imena
export function parseMentions(text, users = []) {
  const mentionRegex = /@(\S+)/g;
  const matches = [...text.matchAll(mentionRegex)].map(m => m[1].toLowerCase());
  return users.filter(u =>
    matches.some(m =>
      u.email.toLowerCase().includes(m) ||
      (u.full_name || '').toLowerCase().replace(' ', '').includes(m)
    )
  );
}