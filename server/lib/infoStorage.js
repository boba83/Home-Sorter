import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const INFO_UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'info');

export function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file').trim()) || 'file';
  return base.replace(/[^\w.\- ()[\]čćžšđČĆŽŠĐ]/gi, '_').slice(0, 180);
}

export async function ensureInfoRoot() {
  await fs.mkdir(INFO_UPLOAD_ROOT, { recursive: true });
}

export async function saveInfoFile(buffer, folderId, originalName) {
  await ensureInfoRoot();
  const dir = path.join(INFO_UPLOAD_ROOT, folderId);
  await fs.mkdir(dir, { recursive: true });
  const safe = sanitizeFilename(originalName);
  const storedName = `${Date.now()}-${safe}`;
  const abs = path.join(dir, storedName);
  await fs.writeFile(abs, buffer);
  return path.join(folderId, storedName).replace(/\\/g, '/');
}

export async function removeStoredFile(storedPath) {
  if (!storedPath) return;
  const abs = path.join(INFO_UPLOAD_ROOT, storedPath);
  try {
    await fs.unlink(abs);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

export function resolveStoredPath(storedPath) {
  const abs = path.join(INFO_UPLOAD_ROOT, storedPath);
  const normalized = path.normalize(abs);
  if (!normalized.startsWith(path.normalize(INFO_UPLOAD_ROOT))) {
    throw new Error('Invalid path');
  }
  return normalized;
}
