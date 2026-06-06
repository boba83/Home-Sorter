import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TASK_COMMENT_UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'task-comments');

const ID_RE = /^tcf_[a-f0-9]{32}$/;

export function isValidAttachmentId(id) {
  return typeof id === 'string' && ID_RE.test(id);
}

export async function ensureTaskCommentUploadRoot() {
  await fs.mkdir(TASK_COMMENT_UPLOAD_ROOT, { recursive: true });
}

export function sanitizeFilename(name) {
  const base = path.basename(String(name || 'file').trim()) || 'file';
  return base.replace(/[^\w.\- ()[\]čćžšđČĆŽŠĐ]/gi, '_').slice(0, 180);
}

function binPath(id) {
  return path.join(TASK_COMMENT_UPLOAD_ROOT, id);
}

function metaPath(id) {
  return path.join(TASK_COMMENT_UPLOAD_ROOT, `${id}.meta.json`);
}

/**
 * @returns {{ id: string, originalName: string, mimeType: string, size: number, taskId: string, uploadedBy: string }}
 */
export async function saveTaskCommentAttachment(buffer, { taskId, userId, originalName, mimeType }) {
  await ensureTaskCommentUploadRoot();
  const id = `tcf_${crypto.randomBytes(16).toString('hex')}`;
  const safeName = sanitizeFilename(originalName);
  const meta = {
    id,
    taskId,
    uploadedBy: userId,
    originalName: safeName,
    mimeType: mimeType && String(mimeType).trim() ? String(mimeType).trim() : 'application/octet-stream',
    size: buffer.length,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(binPath(id), buffer);
  await fs.writeFile(metaPath(id), JSON.stringify(meta), 'utf8');
  return meta;
}

export async function readTaskCommentMeta(id) {
  if (!isValidAttachmentId(id)) return null;
  try {
    const raw = await fs.readFile(metaPath(id), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resolveTaskCommentBinPath(id) {
  if (!isValidAttachmentId(id)) return null;
  const abs = path.normalize(binPath(id));
  const root = path.normalize(TASK_COMMENT_UPLOAD_ROOT);
  if (!abs.startsWith(root)) return null;
  return abs;
}

export async function deleteTaskCommentAttachment(id) {
  if (!isValidAttachmentId(id)) return false;
  try {
    await fs.unlink(binPath(id));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  try {
    await fs.unlink(metaPath(id));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  return true;
}
