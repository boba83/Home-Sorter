import crypto from 'crypto';

const CHARS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Čitljiva privremena lozinka (bez 0/O, 1/l/I) */
export function generateTemporaryPassword(length = 10) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CHARS[bytes[i] % CHARS.length];
  }
  return out;
}

export function validatePasswordStrength(password) {
  const p = String(password || '');
  if (p.length < 6) return 'Lozinka mora imati najmanje 6 karaktera';
  return null;
}
