import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import {
  serializeUser,
  userAuthSelect,
  userHasProfileImage,
  userUpdateFromBody,
  serializeHouse,
  serializeRoom,
  serializeColumn,
  serializeTask,
  houseFromBody,
  roomFromBody,
  taskFromBody,
  serializeNotification,
  serializeInvite,
  serializeExcursion,
  excursionFromBody,
  displayFullName,
  serializeDutyShift,
  dutyShiftFromBody,
  validateDutyShiftPayload,
  serializeRoomDutyShift,
  roomDutyShiftFromBody,
  validateRoomDutyShiftPayload,
  normalizeDutyTimeHm,
} from './lib/serialize.js';
import {
  EXCURSION_THEMES,
  EXCURSION_ICONS,
  normalizeExcursionTheme,
  normalizeExcursionIcon,
} from './lib/excursionThemes.js';
import {
  looksLikeAstraRoomingList,
  parseAstraRoomingListLines,
  scanHotelNamesInText,
  splitPdfTextToLines,
} from './lib/astraRoomingParser.js';
import { notifyOnTaskCreated, notifyOnTaskUpdated } from './lib/taskNotifications.js';
import { sendInviteEmail, isMailConfigured } from './lib/mail.js';
import { generateTemporaryPassword, validatePasswordStrength } from './lib/password.js';
import {
  ROLES,
  isAdmin,
  isViewer,
  canEditTasks,
  loadUserAccess,
  hasAllHousesAccess,
  houseWhereForUser,
  accessibleHouseIds,
  canAccessHouse,
  canEditHouse,
  setHouseMembers,
  getDutyPoolUserIds,
} from './lib/access.js';
import { serializeInfoFolder, serializeInfoFile } from './lib/serializeInfo.js';
import { saveInfoFile, removeStoredFile, resolveStoredPath } from './lib/infoStorage.js';
import { normalizeInfoFolderColor } from './lib/infoColors.js';

const prisma = new PrismaClient();
const app = express();
app.set('etag', false);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// API ne sme ići u browser keš (304 + prazan body ruši fetch().json())
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const infoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Niste ulogovani' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    const access = await loadUserAccess(prisma, payload.sub);
    req.userRole = access.role;
    req.userCanAccessAllHouses = access.canAccessAllHouses;
    next();
  } catch {
    return res.status(401).json({ message: 'Neispravan token' });
  }
}

function adminOnly(req, res, next) {
  if (!isAdmin(req.userRole)) {
    return res.status(403).json({ message: 'Samo admin' });
  }
  next();
}

function editorOnly(req, res, next) {
  if (!canEditTasks(req.userRole)) {
    return res.status(403).json({ message: 'Nemate dozvolu za izmenu' });
  }
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function purgeFolderTreeFromDisk(prismaClient, folderId) {
  const children = await prismaClient.infoFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  for (const child of children) {
    await purgeFolderTreeFromDisk(prismaClient, child.id);
  }
  const files = await prismaClient.infoFile.findMany({ where: { folderId } });
  for (const file of files) {
    await removeStoredFile(file.storedPath);
  }
}

async function getFolderBreadcrumb(prismaClient, folderId) {
  const trail = [];
  let currentId = folderId;
  while (currentId) {
    const folder = await prismaClient.infoFolder.findUnique({ where: { id: currentId } });
    if (!folder) break;
    trail.unshift(serializeInfoFolder(folder));
    currentId = folder.parentId;
  }
  return trail;
}

async function loadInfoFolder(folderId) {
  return prisma.infoFolder.findUnique({ where: { id: folderId } });
}

function normalizeParentId(raw) {
  if (raw == null || raw === '' || raw === 'null' || raw === 'root') return null;
  return String(raw);
}

function appBaseUrl(req) {
  return process.env.APP_URL || req.get('origin') || 'http://localhost:5173';
}

const houseIncludeMembers = { members: { select: { userId: true } } };

function parseSort(sortParam, allowed) {
  if (!sortParam) return { createdAt: 'desc' };
  const desc = String(sortParam).startsWith('-');
  const field = desc ? String(sortParam).slice(1) : String(sortParam);
  const map = {
    created_date: 'createdAt',
    updated_date: 'updatedAt',
    order: 'order',
    name: 'name',
  };
  const prismaField = map[field] || (allowed.includes(field) ? field : 'createdAt');
  return { [prismaField]: desc ? 'desc' : 'asc' };
}

// ——— Auth ———
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email i lozinka su obavezni' });
  }
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { ...userAuthSelect, passwordHash: true },
  });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Pogrešan email ili lozinka' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  const hasProfile = await userHasProfileImage(prisma, user.id);
  res.json({ token, user: serializeUser(user, { hasProfileImage: hasProfile }) });
}));

app.get('/api/auth/me', authMiddleware, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: userAuthSelect,
  });
  if (!user) return res.status(401).json({ message: 'Korisnik ne postoji' });
  const hasProfile = await userHasProfileImage(prisma, user.id);
  res.json(serializeUser(user, { hasProfileImage: hasProfile }));
}));

app.get('/api/auth/me/profile-image', authMiddleware, asyncRoute(async (req, res) => {
  const row = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { profileImage: true },
  });
  if (!row) return res.status(401).json({ message: 'Korisnik ne postoji' });
  res.json({ profile_image: row.profileImage ?? null });
}));

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!existing) return res.status(401).json({ message: 'Korisnik ne postoji' });

  const data = userUpdateFromBody(req.body, existing);

  if (req.body.new_password != null && String(req.body.new_password).trim() !== '') {
    const newPassword = String(req.body.new_password);
    const strength = validatePasswordStrength(newPassword);
    if (strength) return res.status(400).json({ message: strength });
    const current = req.body.current_password;
    if (!current) {
      return res.status(400).json({ message: 'Unesite trenutnu lozinku' });
    }
    if (!(await bcrypt.compare(String(current), existing.passwordHash))) {
      return res.status(401).json({ message: 'Trenutna lozinka nije ispravna' });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json(serializeUser(user));
});

// ——— Houses ———
app.get('/api/houses', authMiddleware, async (req, res) => {
  const scope = await houseWhereForUser(
    prisma,
    req.userId,
    req.userRole,
    req.userCanAccessAllHouses,
  );
  const where = { ...scope };
  if (req.query.id) {
    const requestedId = String(req.query.id);
    if (where.id === '__no_access__') {
      return res.json([]);
    }
    if (where.id && typeof where.id === 'object' && Array.isArray(where.id.in)) {
      if (!where.id.in.includes(requestedId)) {
        return res.json([]);
      }
    }
    where.id = requestedId;
  }
  if (req.query.location) where.location = req.query.location;
  const houses = await prisma.house.findMany({
    where,
    include: houseIncludeMembers,
    orderBy: parseSort(req.query.sort, ['createdAt', 'name']),
  });
  res.json(houses.map(serializeHouse));
});

app.post('/api/houses', authMiddleware, editorOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ message: 'Unesite naziv kuće' });
  const house = await prisma.house.create({
    data: houseFromBody({
      ...req.body,
      name,
      total_rooms: 0,
      total_capacity: 0,
    }),
  });
  const full = await prisma.house.findUnique({
    where: { id: house.id },
    include: houseIncludeMembers,
  });
  res.status(201).json(serializeHouse(full));
});

app.put('/api/houses/:id', authMiddleware, async (req, res) => {
  if (
    !(await canEditHouse(
      prisma,
      req.userId,
      req.userRole,
      req.params.id,
      req.userCanAccessAllHouses,
    ))
  ) {
    return res.status(403).json({ message: 'Nemate dozvolu za izmenu ove kuće' });
  }
  const house = await prisma.house.update({
    where: { id: req.params.id },
    data: houseFromBody(req.body),
    include: houseIncludeMembers,
  });
  res.json(serializeHouse(house));
});

app.put('/api/houses/:id/members', authMiddleware, adminOnly, async (req, res) => {
  const house = await prisma.house.findUnique({ where: { id: req.params.id } });
  if (!house) return res.status(404).json({ message: 'Kuća nije pronađena' });
  const userIds = Array.isArray(req.body.user_ids) ? req.body.user_ids : [];
  await setHouseMembers(prisma, req.params.id, userIds);
  const full = await prisma.house.findUnique({
    where: { id: req.params.id },
    include: houseIncludeMembers,
  });
  res.json(serializeHouse(full));
});

app.delete('/api/houses/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await prisma.house.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ message: 'Kuća nije pronađena' });
    }
    console.error(e);
    res.status(500).json({ message: 'Brisanje kuće nije uspelo' });
  }
});

async function roomAccessGuard(req, res, houseId) {
  if (
    !(await canAccessHouse(
      prisma,
      req.userId,
      req.userRole,
      houseId,
      req.userCanAccessAllHouses,
    ))
  ) {
    res.status(403).json({ message: 'Nemate pristup ovoj kući' });
    return false;
  }
  return true;
}

async function roomEditGuard(req, res, houseId) {
  if (
    !(await canEditHouse(
      prisma,
      req.userId,
      req.userRole,
      houseId,
      req.userCanAccessAllHouses,
    ))
  ) {
    res.status(403).json({ message: 'Nemate dozvolu za izmenu' });
    return false;
  }
  return true;
}

// ——— Rooms ———
app.get('/api/rooms', authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.house_id) where.houseId = req.query.house_id;
  if (req.query.id) where.id = req.query.id;
  if (!hasAllHousesAccess(req.userRole, req.userCanAccessAllHouses)) {
    const houseIdsRaw = await accessibleHouseIds(
      prisma,
      req.userId,
      req.userRole,
      req.userCanAccessAllHouses,
    );
    const houseIds = Array.isArray(houseIdsRaw) ? houseIdsRaw.filter(Boolean) : [];
    if (houseIds.length === 0) return res.json([]);
    const qHouse = req.query.house_id != null ? String(req.query.house_id) : '';
    where.houseId = qHouse
      ? houseIds.some((id) => String(id) === qHouse)
        ? qHouse
        : '__none__'
      : { in: houseIds };
  }
  const rooms = await prisma.room.findMany({
    where,
    orderBy: parseSort(req.query.sort, ['createdAt']),
  });
  res.json(rooms.map(serializeRoom));
});

async function refreshHouseTotals(houseId) {
  const rooms = await prisma.room.findMany({ where: { houseId } });
  await prisma.house.update({
    where: { id: houseId },
    data: {
      totalRooms: rooms.length,
      totalCapacity: rooms.reduce((s, r) => s + (r.capacity || 0), 0),
    },
  });
}

app.post('/api/rooms', authMiddleware, async (req, res) => {
  const houseId = req.body.house_id;
  if (!houseId || !(await roomEditGuard(req, res, houseId))) return;
  const room = await prisma.room.create({ data: roomFromBody(req.body) });
  await refreshHouseTotals(houseId);
  res.status(201).json(serializeRoom(room));
});

app.post('/api/rooms/bulk', authMiddleware, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const created = [];
  for (const item of items) {
    if (!(await roomEditGuard(req, res, item.house_id))) return;
    const room = await prisma.room.create({ data: roomFromBody(item) });
    created.push(serializeRoom(room));
  }
  res.status(201).json(created);
});

app.put('/api/rooms/:id', authMiddleware, async (req, res) => {
  const existing = await prisma.room.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Soba nije pronađena' });
  if (!(await roomEditGuard(req, res, existing.houseId))) return;
  const data = roomFromBody(req.body);
  const room = await prisma.room.update({ where: { id: req.params.id }, data });
  res.json(serializeRoom(room));
});

app.delete('/api/rooms/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const existing = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Soba nije pronađena' });
    const houseId = existing.houseId;
    await prisma.room.delete({ where: { id: req.params.id } });
    await refreshHouseTotals(houseId);
    res.status(204).end();
  } catch (e) {
    if (e.code === 'P2025') {
      return res.status(404).json({ message: 'Soba nije pronađena' });
    }
    console.error(e);
    res.status(500).json({ message: 'Brisanje sobe nije uspelo' });
  }
});

// ——— Columns ———
app.get('/api/columns', authMiddleware, async (req, res) => {
  const columns = await prisma.column.findMany({
    orderBy: parseSort(req.query.sort || 'order', ['order']),
  });
  res.json(columns.map(serializeColumn));
});

app.post('/api/columns', authMiddleware, editorOnly, async (req, res) => {
  const col = await prisma.column.create({
    data: { name: req.body.name, order: req.body.order ?? 0 },
  });
  res.status(201).json(serializeColumn(col));
});

app.put('/api/columns/:id', authMiddleware, editorOnly, async (req, res) => {
  const col = await prisma.column.update({
    where: { id: req.params.id },
    data: { name: req.body.name, order: req.body.order },
  });
  res.json(serializeColumn(col));
});

app.delete('/api/columns/:id', authMiddleware, editorOnly, async (req, res) => {
  await prisma.task.deleteMany({ where: { columnId: req.params.id } });
  await prisma.column.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— Tasks ———
app.get('/api/tasks', authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.column_id) where.columnId = req.query.column_id;
  const tasks = await prisma.task.findMany({
    where,
    orderBy: parseSort(req.query.sort || 'order', ['order']),
  });
  res.json(tasks.map(serializeTask));
});

app.post('/api/tasks', authMiddleware, editorOnly, async (req, res) => {
  const task = await prisma.task.create({ data: taskFromBody(req.body) });
  try {
    await notifyOnTaskCreated(prisma, task, req.userId);
  } catch (e) {
    console.error('notifyOnTaskCreated', e);
  }
  res.status(201).json(serializeTask(task));
});

app.put('/api/tasks/:id', authMiddleware, editorOnly, async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Zadatak nije pronađen' });
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: taskFromBody(req.body),
  });
  try {
    await notifyOnTaskUpdated(prisma, existing, task, req.userId, req.body);
  } catch (e) {
    console.error('notifyOnTaskUpdated', e);
  }
  res.json(serializeTask(task));
});

// ——— Notifications ———
app.get('/api/notifications', authMiddleware, async (req, res) => {
  const where = { userId: req.userId };
  if (req.query.unread === 'true') where.read = false;
  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(req.query.limit) || 50, 100),
  });
  res.json(items.map(serializeNotification));
});

app.get('/api/notifications/unread-count', authMiddleware, async (req, res) => {
  const where = { userId: req.userId, read: false };
  const count = await prisma.notification.count({ where });
  const urgent_count = await prisma.notification.count({
    where: { ...where, severity: 'urgent' },
  });
  res.json({ count, urgent_count });
});

app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  const n = await prisma.notification.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!n) return res.status(404).json({ message: 'Notifikacija nije pronađena' });
  const updated = await prisma.notification.update({
    where: { id: n.id },
    data: { read: true },
  });
  res.json(serializeNotification(updated));
});

app.delete('/api/tasks/:id', authMiddleware, editorOnly, async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— Invites ———
app.get('/api/invites/preview/:token', async (req, res) => {
  const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
  if (!invite || invite.acceptedAt) {
    return res.status(404).json({ message: 'Pozivnica nije važeća' });
  }
  if (invite.expiresAt < new Date()) {
    return res.status(410).json({ message: 'Pozivnica je istekla' });
  }
  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return res.status(409).json({ message: 'Korisnik sa ovim emailom već postoji' });
  }
  res.json({ email: invite.email, role: invite.role });
});

app.post('/api/invites/accept/:token', async (req, res) => {
  const { password, first_name, last_name } = req.body || {};
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'Lozinka mora imati najmanje 6 karaktera' });
  }
  const invite = await prisma.invite.findUnique({ where: { token: req.params.token } });
  if (!invite || invite.acceptedAt) {
    return res.status(404).json({ message: 'Pozivnica nije važeća' });
  }
  if (invite.expiresAt < new Date()) {
    return res.status(410).json({ message: 'Pozivnica je istekla' });
  }
  const email = invite.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'Nalog već postoji — prijavite se' });
  }
  const firstName = first_name ? String(first_name).trim() : null;
  const lastName = last_name ? String(last_name).trim() : null;
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      firstName,
      lastName,
      role: ROLES.includes(invite.role) ? invite.role : 'user',
    },
  });
  await prisma.invite.update({
    where: { id: invite.id },
    data: { acceptedAt: new Date() },
  });
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: serializeUser(user) });
});

app.get('/api/invites', authMiddleware, adminOnly, async (req, res) => {
  const invites = await prisma.invite.findMany({
    where: { acceptedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  const base = appBaseUrl(req);
  res.json(invites.map((inv) => serializeInvite(inv, base)));
});

app.post('/api/invites', authMiddleware, adminOnly, async (req, res) => {
  const email = String(req.body?.email || '')
    .toLowerCase()
    .trim();
  const role = ROLES.includes(req.body?.role) ? req.body.role : 'user';
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Unesite ispravan email' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'Korisnik već postoji' });
  }
  await prisma.invite.deleteMany({ where: { email, acceptedAt: null } });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.invite.create({
    data: {
      email,
      role,
      token: crypto.randomBytes(32).toString('hex'),
      invitedBy: req.userId,
      expiresAt,
    },
  });
  const base = appBaseUrl(req);
  const payload = serializeInvite(invite, base);
  const inviter = await prisma.user.findUnique({ where: { id: req.userId } });
  const emailResult = await sendInviteEmail({
    to: email,
    inviteUrl: payload.invite_url,
    role,
    inviterName: displayFullName(inviter) || inviter?.email || 'Admin',
  });
  res.status(201).json({
    ...payload,
    email_sent: emailResult.sent,
    email_error: emailResult.reason || null,
    mail_configured: isMailConfigured(),
  });
});

app.get('/api/invites/mail-status', authMiddleware, adminOnly, (_req, res) => {
  res.json({ configured: isMailConfigured() });
});

app.delete('/api/invites/:id', authMiddleware, adminOnly, async (req, res) => {
  await prisma.invite.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});

// ——— Users (admin) ———
app.get('/api/users/assignable', authMiddleware, async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { in: ['admin', 'user'] } },
    orderBy: { fullName: 'asc' },
    select: userAuthSelect,
  });
  res.json(users.map((u) => serializeUser(u)));
});

app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: parseSort(req.query.sort, ['createdAt']),
    select: userAuthSelect,
  });
  res.json(users.map((u) => serializeUser(u)));
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const email = String(req.body?.email || '')
    .toLowerCase()
    .trim();
  const role = ROLES.includes(req.body?.role) ? req.body.role : 'user';
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Unesite ispravan email' });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ message: 'Korisnik sa ovim emailom već postoji' });
  }

  const temporaryPassword = generateTemporaryPassword();
  const firstName = req.body.first_name ? String(req.body.first_name).trim() : null;
  const lastName = req.body.last_name ? String(req.body.last_name).trim() : null;
  const fullName =
    [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0];

  const createData = userUpdateFromBody(req.body);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      fullName,
      firstName,
      lastName,
      role,
      ...createData,
    },
  });

  await prisma.invite.deleteMany({ where: { email } }).catch(() => {});

  res.status(201).json({
    user: serializeUser(user),
    temporary_password: temporaryPassword,
  });
});

app.patch('/api/users/:id/password', authMiddleware, adminOnly, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Korisnik nije pronađen' });

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id: existing.id },
    data: { passwordHash: await bcrypt.hash(temporaryPassword, 10) },
  });

  res.json({
    user: serializeUser(existing),
    temporary_password: temporaryPassword,
  });
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Korisnik nije pronađen' });
  const data = userUpdateFromBody(req.body, existing);
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(serializeUser(user));
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— PDF import (bez Base44 AI — osnovno parsiranje teksta) ———
app.post('/api/import/pdf', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
  try {
    const pdfData = await pdfParse(req.file.buffer);
    const text = pdfData.text || '';
    const importData = parsePdfTextToEntries(text);
    res.json({
      status: 'success',
      output: {
        entries: importData.entries,
        location: importData.location,
        hotels: importData.hotels,
        hotelsMissingRooms: importData.hotelsMissingRooms,
        parseMode: importData.parseMode,
        warnings: importData.warnings,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      status: 'error',
      details: 'PDF nije mogao biti pročitan. Proverite format ili unesite podatke ručno.',
    });
  }
});

/** Datumi iz PDF preview-a (dd.mm → pun datum za ovu godinu) */
function normalizeImportDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{1,2}\.\d{1,2}$/.test(s)) {
    const [day, month] = s.split('.');
    const year = new Date().getFullYear();
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return s;
}

/** Atomski uvoz kuća + soba (izbegava delimičan upis ako bulk na klijentu pukne) */
app.post('/api/import/commit', authMiddleware, editorOnly, async (req, res) => {
  const { location: locRaw, entries: entriesRaw } = req.body || {};
  const location =
    locRaw != null && String(locRaw).trim() !== '' ? String(locRaw).trim() : null;
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];
  if (entries.length === 0) {
    return res.status(400).json({ message: 'Nema redova za import' });
  }
  try {
    const houseNamesForImport = [
      ...new Set(
        entries.map((e) => (e.house_name || 'Unknown House').trim() || 'Unknown House'),
      ),
    ];
    const summary = await prisma.$transaction(async (tx) => {
      const houseIdByName = new Map();
      const grouped = new Map();
      const houseKey = (name) =>
        (name || 'Unknown House').replace(/\s+/g, ' ').trim().toLowerCase() || 'unknown house';

      for (const e of entries) {
        const hn = (e.house_name || 'Unknown House').trim() || 'Unknown House';
        const key = houseKey(hn);
        if (!grouped.has(key)) grouped.set(key, { displayName: hn, rooms: [] });
        grouped.get(key).rooms.push(e);
      }

      for (const [, { displayName: houseName, rooms: roomGroup }] of grouped) {
        const totalCapacity = roomGroup.reduce(
          (sum, r) => sum + (Number(r.number_of_persons) || 0),
          0
        );
        let house = await findHouseForImport(tx, houseName, location);
        if (!house) {
          house = await tx.house.create({
            data: houseFromBody({
              name: houseName.replace(/\s+/g, ' ').trim(),
              location: location || roomGroup[0]?.location || null,
              total_rooms: roomGroup.length,
              total_capacity: totalCapacity,
            }),
          });
        } else {
          house = await tx.house.update({
            where: { id: house.id },
            data: {
              totalRooms: (house.totalRooms ?? 0) + roomGroup.length,
              totalCapacity: (house.totalCapacity ?? 0) + totalCapacity,
            },
          });
        }
        houseIdByName.set(houseKey(houseName), house.id);
      }

      let roomsCreated = 0;
      for (const entry of entries) {
        const houseName = (entry.house_name || 'Unknown House').trim() || 'Unknown House';
        const houseId = houseIdByName.get(houseKey(houseName));
        if (!houseId) {
          throw new Error(`Nedostaje kuća za: ${houseName}`);
        }
        const hasBus = !!(
          entry.bus_info && /\b(bus|autobus|bus pak)\b/i.test(String(entry.bus_info))
        );
        await tx.room.create({
          data: roomFromBody({
            house_id: houseId,
            house_name: houseName,
            room_number: entry.room_number != null ? String(entry.room_number) : 'N/A',
            room_structure: entry.room_structure || '',
            capacity:
              Number(entry.capacity) ||
              Number(entry.number_of_persons) ||
              (Array.isArray(entry.occupant_names) ? entry.occupant_names.length : 1) ||
              1,
            current_occupants: Array.isArray(entry.occupant_names)
              ? entry.occupant_names.length
              : 0,
            occupant_names: Array.isArray(entry.occupant_names) ? entry.occupant_names : [],
            stay_from: normalizeImportDate(entry.stay_from),
            stay_to: normalizeImportDate(entry.stay_to),
            notes: entry.notes || '',
            contact_phone: entry.contact_phone || undefined,
            contract_number: entry.contract_number || undefined,
            bus: hasBus,
          }),
        });
        roomsCreated += 1;
      }
      return { roomsCreated, houseGroups: grouped.size };
    });

    res.status(201).json({
      ok: true,
      roomsCreated: summary.roomsCreated,
      houseGroups: summary.houseGroups,
      houses: houseNamesForImport,
    });
  } catch (e) {
    console.error(e);
    const raw = String(e?.message || e || '');
    if (/no such column|does not exist|Unknown arg|contractNumber/i.test(raw)) {
      return res.status(500).json({
        message:
          'Baza podataka nije usklađena sa šemom (npr. nedostaje kolona contractNumber). ' +
          'U terminalu u folderu server pokrenite: npx prisma db push — zatim restartujte API.',
      });
    }
    res.status(500).json({
      message: e.message || 'Import nije uspeo. Proverite podatke ili pokušajte ponovo.',
    });
  }
});

const KNOWN_LOCATIONS = [
  'Sarti', 'Sykia', 'Klimataria', 'Kalamitsi', 'Porto Koufo',
  'Toroni', 'Zaliv Simonitiko', 'Neos Marmaras', 'Nikiti',
  'Metamorfosi', 'Psakoudia', 'Nea Plaja',
];

function detectLocationFromText(text) {
  for (const loc of KNOWN_LOCATIONS) {
    if (new RegExp(`\\b${loc.replace(/\s+/g, '\\s+')}\\b`, 'i').test(text)) return loc;
  }
  return null;
}

function parseOccupantNames(rest) {
  if (!rest) return [];
  return rest
    .split(/[,/|]|(?:\s+and\s+)|(?:\s+i\s+)|(?:\s+&\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && !/^\d+$/.test(s) && !/^(bus|autobus)$/i.test(s));
}

function pushEntry(entries, entry) {
  entries.push({
    room_structure: '',
    stay_from: '',
    stay_to: '',
    bus_info: entry.bus_info || '',
    ...entry,
    number_of_persons: entry.number_of_persons ?? Math.max(entry.occupant_names?.length || 0, 1),
  });
}

function parsePdfTextToEntries(text) {
  const lines = splitPdfTextToLines(text)
    .map((l) => l.trim())
    .filter(Boolean);
  const location = detectLocationFromText(text);

  if (looksLikeAstraRoomingList(text)) {
    const parsed = parseAstraRoomingListLines(lines, location);
    const scanned = scanHotelNamesInText(text).filter(
      (h) => h && !/TOTAL|\/ADT\b|ROOMS\s*:/i.test(h),
    );
    const hotelSet = new Set([...parsed.hotels, ...scanned]);
    const roomCount = new Map();
    for (const e of parsed.entries) {
      roomCount.set(e.house_name, (roomCount.get(e.house_name) || 0) + 1);
    }
    const hotels = [...hotelSet];
    const hotelsMissingRooms = parsed.hotelsMissingRooms.filter((h) =>
      hotels.includes(h),
    );
    const warnings = [];
    if (parsed.entries.length === 0) {
      warnings.push('Nijedna soba nije prepoznata — proverite format PDF-a.');
    }
    if (hotelsMissingRooms.length > 0) {
      warnings.push(
        `Kuće bez soba: ${hotelsMissingRooms.join(', ')}`,
      );
    }
    return {
      entries: parsed.entries,
      location,
      hotels,
      hotelsMissingRooms,
      parseMode: 'astra',
      warnings,
    };
  }

  const entries = [];
  let currentHouse = location || 'Import';

  for (const line of lines) {
    const locOnly = KNOWN_LOCATIONS.find((l) => line.toLowerCase() === l.toLowerCase());
    if (locOnly) {
      currentHouse = locOnly;
      continue;
    }

    if (/^(kuća|house|objekat|vila)\s*[:#]?\s*/i.test(line)) {
      currentHouse = line.replace(/^(kuća|house|objekat|vila)\s*[:#]?\s*/i, '').trim() || currentHouse;
      continue;
    }

    const roomMatch = line.match(/^(soba|room|apt|apartman|stan)\s*[:#.]?\s*(\S+)\s*(.*)$/i);
    if (roomMatch) {
      const names = parseOccupantNames(roomMatch[3]);
      pushEntry(entries, {
        house_name: currentHouse,
        room_number: roomMatch[2],
        occupant_names: names,
        notes: line,
        bus_info: /\b(bus|autobus)\b/i.test(line) ? line : '',
      });
      continue;
    }

    const roomStart = line.match(/^(\d{1,4}[A-Za-z]?)\s+(.+)$/);
    if (roomStart) {
      const names = parseOccupantNames(roomStart[2]);
      pushEntry(entries, {
        house_name: currentHouse,
        room_number: roomStart[1],
        occupant_names: names,
        notes: line,
        bus_info: /\b(bus|autobus)\b/i.test(line) ? line : '',
      });
      continue;
    }

    const roomDash = line.match(/^(\d{1,4}[A-Za-z]?)\s*[-–]\s*(.+)$/);
    if (roomDash) {
      const names = parseOccupantNames(roomDash[2]);
      pushEntry(entries, {
        house_name: currentHouse,
        room_number: roomDash[1],
        occupant_names: names,
        notes: line,
        bus_info: /\b(bus|autobus)\b/i.test(line) ? line : '',
      });
      continue;
    }

    const namesOnly = parseOccupantNames(line);
    if (namesOnly.length >= 1 && line.length > 4) {
      pushEntry(entries, {
        house_name: currentHouse,
        room_number: String(entries.filter((e) => e.house_name === currentHouse).length + 1),
        occupant_names: namesOnly,
        notes: line,
        bus_info: /\b(bus|autobus)\b/i.test(line) ? line : '',
      });
    }
  }

  if (entries.length === 0 && lines.length > 0) {
    pushEntry(entries, {
      house_name: location || lines[0].slice(0, 80) || 'Import iz PDF',
      room_number: '1',
      occupant_names: [],
      notes: text.slice(0, 500),
    });
  }

  const hotels = [...new Set(entries.map((e) => e.house_name).filter(Boolean))];
  return {
    entries,
    location,
    hotels,
    hotelsMissingRooms: [],
    parseMode: 'generic',
    warnings: entries.length === 0 ? ['PDF format nije prepoznat kao Astra rooming lista.'] : [],
  };
}

async function findHouseForImport(tx, houseName, location) {
  const normalized = houseName.replace(/\s+/g, ' ').trim();
  const candidates = await tx.house.findMany({
    where: location ? { location } : {},
    select: { id: true, name: true, totalRooms: true, totalCapacity: true, location: true },
  });
  const exact = candidates.find(
    (h) => h.name.replace(/\s+/g, ' ').trim().toLowerCase() === normalized.toLowerCase(),
  );
  if (exact) return exact;
  if (!location) {
    return tx.house.findFirst({ where: { name: normalized } });
  }
  return null;
}

// ——— Bitne informacije (fascikle i fajlovi) ———
app.get('/api/info/browse', authMiddleware, asyncRoute(async (req, res) => {
  const parentId = normalizeParentId(req.query.parent_id);
  const folders = await prisma.infoFolder.findMany({
    where: { parentId },
    orderBy: { name: 'asc' },
  });
  const files = parentId
    ? await prisma.infoFile.findMany({
        where: { folderId: parentId },
        orderBy: { name: 'asc' },
      })
    : [];
  const breadcrumb = parentId ? await getFolderBreadcrumb(prisma, parentId) : [];
  res.json({
    parent_id: parentId,
    breadcrumb,
    folders: folders.map(serializeInfoFolder),
    files: files.map(serializeInfoFile),
  });
}));

app.post('/api/info/folders', authMiddleware, editorOnly, asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const parentId = normalizeParentId(req.body?.parent_id);
  if (!name) return res.status(400).json({ message: 'Unesite naziv fascikle' });
  if (parentId) {
    const parent = await loadInfoFolder(parentId);
    if (!parent) return res.status(404).json({ message: 'Roditeljska fascikla nije pronađena' });
  }

  const duplicate = await prisma.infoFolder.findFirst({
    where: { parentId, name },
  });
  if (duplicate) {
    return res.status(409).json({ message: 'Fascikla sa tim nazivom već postoji' });
  }

  const color = normalizeInfoFolderColor(req.body?.color);
  const folder = await prisma.infoFolder.create({
    data: { name, parentId, color, createdBy: req.userId },
  });
  res.status(201).json(serializeInfoFolder(folder));
}));

app.patch('/api/info/folders/:id', authMiddleware, editorOnly, asyncRoute(async (req, res) => {
  const existing = await prisma.infoFolder.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Fascikla nije pronađena' });

  const data = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'Unesite naziv fascikle' });
    const duplicate = await prisma.infoFolder.findFirst({
      where: {
        parentId: existing.parentId,
        name,
        NOT: { id: existing.id },
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Fascikla sa tim nazivom već postoji' });
    }
    data.name = name;
  }
  if (req.body?.color !== undefined) {
    data.color = normalizeInfoFolderColor(req.body.color);
  }
  if (!Object.keys(data).length) {
    return res.status(400).json({ message: 'Nema izmena' });
  }

  const folder = await prisma.infoFolder.update({
    where: { id: existing.id },
    data,
  });
  res.json(serializeInfoFolder(folder));
}));

app.delete('/api/info/folders/:id', authMiddleware, adminOnly, asyncRoute(async (req, res) => {
  const existing = await prisma.infoFolder.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Fascikla nije pronađena' });

  await purgeFolderTreeFromDisk(prisma, existing.id);
  await prisma.infoFolder.delete({ where: { id: existing.id } });
  res.status(204).end();
}));

app.post(
  '/api/info/files',
  authMiddleware,
  editorOnly,
  infoUpload.single('file'),
  asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Nema fajla' });
    const folderId = String(req.body?.folder_id || '').trim();
    if (!folderId) return res.status(400).json({ message: 'folder_id je obavezan' });
    const folder = await loadInfoFolder(folderId);
    if (!folder) return res.status(404).json({ message: 'Fascikla nije pronađena' });

    const storedPath = await saveInfoFile(req.file.buffer, folderId, req.file.originalname);
    const record = await prisma.infoFile.create({
      data: {
        folderId,
        name: req.file.originalname || 'fajl',
        storedPath,
        mimeType: req.file.mimetype || null,
        sizeBytes: req.file.size,
        uploadedBy: req.userId,
      },
    });
    res.status(201).json(serializeInfoFile(record));
  }),
);

app.get('/api/info/files/:id/download', authMiddleware, asyncRoute(async (req, res) => {
  const record = await prisma.infoFile.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).json({ message: 'Fajl nije pronađen' });

  try {
    const abs = resolveStoredPath(record.storedPath);
    const data = await fs.readFile(abs);
    const inline = req.query.inline === '1' || req.query.inline === 'true';
    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(record.name)}`,
    );
    res.send(data);
  } catch {
    res.status(404).json({ message: 'Fajl nije na disku' });
  }
}));

app.delete('/api/info/files/:id', authMiddleware, adminOnly, asyncRoute(async (req, res) => {
  const record = await prisma.infoFile.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).json({ message: 'Fajl nije pronađen' });

  await removeStoredFile(record.storedPath);
  await prisma.infoFile.delete({ where: { id: record.id } });
  res.status(204).end();
}));

const DEFAULT_EXCURSIONS = [
  { name: 'Robinzon', adlPrice: 36, icon: 'boat', theme: 'cyan', sortOrder: 0 },
  { name: 'Plava laguna', adlPrice: 34, icon: 'boat', theme: 'blue', sortOrder: 1 },
  { name: 'Atos', adlPrice: 29, icon: 'boat', theme: 'violet', sortOrder: 2 },
  { name: 'Sunset', adlPrice: 16, icon: 'boat', theme: 'orange', sortOrder: 3 },
  { name: 'Solun', adlPrice: 30, icon: 'bus', theme: 'emerald', sortOrder: 4 },
];

async function ensureDefaultExcursions() {
  const count = await prisma.excursion.count();
  if (count === 0) {
    await prisma.excursion.createMany({ data: DEFAULT_EXCURSIONS });
  }
}

app.get('/api/excursions', authMiddleware, async (req, res) => {
  await ensureDefaultExcursions();
  const rows = await prisma.excursion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  res.json(rows.map(serializeExcursion));
});

app.post('/api/excursions', authMiddleware, adminOnly, async (req, res) => {
  const body = excursionFromBody(req.body);
  if (!body.name) {
    return res.status(400).json({ message: 'Naziv ekskurzije je obavezan' });
  }
  if (!Number.isFinite(body.adlPrice) || body.adlPrice < 0) {
    return res.status(400).json({ message: 'Cena za odrasle (ADL) mora biti pozitivan broj' });
  }
  body.icon = normalizeExcursionIcon(body.icon ?? req.body.icon);
  body.theme = normalizeExcursionTheme(body.theme ?? req.body.theme);
  const maxOrder = await prisma.excursion.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.excursion.create({
    data: {
      name: body.name,
      adlPrice: body.adlPrice,
      chdPrice: body.chdPrice ?? null,
      icon: body.icon,
      theme: body.theme,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      active: true,
    },
  });
  res.status(201).json(serializeExcursion(created));
});

app.patch('/api/excursions/:id', authMiddleware, adminOnly, async (req, res) => {
  const body = excursionFromBody(req.body);
  if (body.name === '') {
    return res.status(400).json({ message: 'Naziv ne može biti prazan' });
  }
  if (body.adlPrice != null && (!Number.isFinite(body.adlPrice) || body.adlPrice < 0)) {
    return res.status(400).json({ message: 'Cena za odrasle (ADL) mora biti pozitivan broj' });
  }
  if (body.chdPrice != null && (!Number.isFinite(body.chdPrice) || body.chdPrice < 0)) {
    return res.status(400).json({ message: 'Cena za decu (CHD) mora biti pozitivan broj' });
  }
  if (body.theme != null) body.theme = normalizeExcursionTheme(body.theme);
  if (body.icon != null) body.icon = normalizeExcursionIcon(body.icon);
  const updated = await prisma.excursion.update({
    where: { id: req.params.id },
    data: body,
  });
  res.json(serializeExcursion(updated));
});

app.delete('/api/excursions/:id', authMiddleware, adminOnly, async (req, res) => {
  await prisma.excursion.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

app.get('/api/excursions/meta', authMiddleware, adminOnly, (_req, res) => {
  res.json({ themes: EXCURSION_THEMES, icons: EXCURSION_ICONS });
});

const ROOM_DUTY_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/excursion-duties', authMiddleware, async (req, res) => {
  const date = String(req.query.date || '').trim();
  if (!ROOM_DUTY_DATE_RE.test(date)) {
    return res.status(400).json({ message: 'Parametar date (YYYY-MM-DD)' });
  }
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (isViewer(req.userRole) || !pool.length) {
    return res.json({ shifts: [] });
  }
  const rows = await prisma.roomDutyShift.findMany({
    where: { date, userId: { in: pool } },
    orderBy: [{ slotKey: 'asc' }, { startTime: 'asc' }],
    include: { user: { select: userAuthSelect } },
  });
  res.json({ shifts: rows.map((r) => serializeRoomDutyShift(r)) });
});

app.post('/api/excursion-duties', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da menja' });
  }
  const body = roomDutyShiftFromBody(req.body);
  const vmsg = validateRoomDutyShiftPayload(body);
  if (vmsg) return res.status(400).json({ message: vmsg });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(body.userId)) {
    return res.status(403).json({ message: 'Nemate pravo dodele za izabranog korisnika' });
  }
  const row = await prisma.roomDutyShift.create({
    data: {
      date: body.date,
      slotKey: body.slotKey,
      startTime: body.startTime,
      endTime: body.endTime,
      userId: body.userId,
      note: body.note,
      createdBy: req.userId,
    },
    include: { user: { select: userAuthSelect } },
  });
  res.status(201).json(serializeRoomDutyShift(row));
});

app.put('/api/excursion-duties/:id', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da menja' });
  }
  const existing = await prisma.roomDutyShift.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Zapis nije pronađen' });
  const merged = roomDutyShiftFromBody({
    date: req.body.date ?? existing.date,
    slot_key: req.body.slot_key ?? req.body.slotKey ?? existing.slotKey,
    start_time: req.body.start_time ?? req.body.startTime ?? existing.startTime,
    end_time: req.body.end_time ?? req.body.endTime ?? existing.endTime,
    user_id: req.body.user_id ?? req.body.userId ?? existing.userId,
    note: req.body.note !== undefined ? req.body.note : existing.note,
  });
  const vmsg = validateRoomDutyShiftPayload(merged);
  if (vmsg) return res.status(400).json({ message: vmsg });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(existing.userId) || !pool.includes(merged.userId)) {
    return res.status(403).json({ message: 'Nemate pravo izmene ovog zapisa' });
  }
  const row = await prisma.roomDutyShift.update({
    where: { id: existing.id },
    data: {
      date: merged.date,
      slotKey: merged.slotKey,
      startTime: merged.startTime,
      endTime: merged.endTime,
      userId: merged.userId,
      note: merged.note,
    },
    include: { user: { select: userAuthSelect } },
  });
  res.json(serializeRoomDutyShift(row));
});

app.delete('/api/excursion-duties/:id', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da briše' });
  }
  const existing = await prisma.roomDutyShift.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Zapis nije pronađen' });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(existing.userId)) {
    return res.status(403).json({ message: 'Nemate pravo brisanja' });
  }
  await prisma.roomDutyShift.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const DUTY_SHIFT_RANGE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/duty-shifts/eligible-users', authMiddleware, async (req, res) => {
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (isViewer(req.userRole) || !pool.length) {
    return res.json([]);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: pool } },
    orderBy: { fullName: 'asc' },
    select: userAuthSelect,
  });
  res.json(users.map((u) => serializeUser(u)));
});

app.get('/api/duty-shifts', authMiddleware, async (req, res) => {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  if (!DUTY_SHIFT_RANGE_RE.test(from) || !DUTY_SHIFT_RANGE_RE.test(to)) {
    return res.status(400).json({ message: 'Parametri from i to (YYYY-MM-DD) su obavezni' });
  }
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (isViewer(req.userRole) || !pool.length) {
    return res.json([]);
  }
  const shifts = await prisma.dutyShift.findMany({
    where: {
      date: { gte: from, lte: to },
      userId: { in: pool },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    include: { user: { select: userAuthSelect } },
  });
  res.json(shifts.map((row) => serializeDutyShift(row)));
});

app.post('/api/duty-shifts', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da menja raspored' });
  }
  const body = dutyShiftFromBody(req.body);
  const vmsg = validateDutyShiftPayload(body);
  if (vmsg) return res.status(400).json({ message: vmsg });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(body.userId)) {
    return res.status(403).json({ message: 'Nemate pravo dodele za izabranog korisnika' });
  }
  const row = await prisma.dutyShift.create({
    data: {
      date: body.date,
      startTime: body.startTime,
      endTime: body.endTime,
      userId: body.userId,
      note: body.note,
      createdBy: req.userId,
    },
    include: { user: { select: userAuthSelect } },
  });
  res.status(201).json(serializeDutyShift(row));
});

app.put('/api/duty-shifts/:id', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da menja raspored' });
  }
  const existing = await prisma.dutyShift.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Zapis nije pronađen' });
  const merged = dutyShiftFromBody({
    date: req.body.date ?? existing.date,
    start_time: req.body.start_time ?? req.body.startTime ?? existing.startTime,
    end_time: req.body.end_time ?? req.body.endTime ?? existing.endTime,
    user_id: req.body.user_id ?? req.body.userId ?? existing.userId,
    note: req.body.note !== undefined ? req.body.note : existing.note,
  });
  const vmsg = validateDutyShiftPayload(merged);
  if (vmsg) return res.status(400).json({ message: vmsg });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(existing.userId) || !pool.includes(merged.userId)) {
    return res.status(403).json({ message: 'Nemate pravo izmene ovog zapisa' });
  }
  const row = await prisma.dutyShift.update({
    where: { id: existing.id },
    data: {
      date: merged.date,
      startTime: merged.startTime,
      endTime: merged.endTime,
      userId: merged.userId,
      note: merged.note,
    },
    include: { user: { select: userAuthSelect } },
  });
  res.json(serializeDutyShift(row));
});

app.delete('/api/duty-shifts/:id', authMiddleware, async (req, res) => {
  if (isViewer(req.userRole)) {
    return res.status(403).json({ message: 'Pregledač ne može da briše raspored' });
  }
  const existing = await prisma.dutyShift.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Zapis nije pronađen' });
  const pool = await getDutyPoolUserIds(prisma, req.userId, req.userRole, req.userCanAccessAllHouses);
  if (!pool.includes(existing.userId)) {
    return res.status(403).json({ message: 'Nemate pravo brisanja' });
  }
  await prisma.dutyShift.delete({ where: { id: existing.id } });
  res.status(204).end();
});

app.use((err, req, res, _next) => {
  console.error('[API]', req.method, req.path, err);
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'Zapis već postoji' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Nije pronađeno' });
  }
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: err.message || 'Greška servera',
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/', (req, res) => {
  const appUrl = appBaseUrl(req).replace(/\/$/, '');
  res.type('text/plain').send(
    `Home Sorter API radi. Aplikacija: ${appUrl}/login`,
  );
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Home Sorter API: port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} je zauzet (verovatno još radi stari API).\n` +
        `U korenu projekta pokrenite:  npm run ports:free\n` +
        `Zatim ponovo:  npm run dev:all\n`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
