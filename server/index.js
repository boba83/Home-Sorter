import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { PrismaClient } from '@prisma/client';
import {
  serializeUser,
  serializeHouse,
  serializeRoom,
  serializeColumn,
  serializeTask,
  houseFromBody,
  roomFromBody,
  taskFromBody,
} from './lib/serialize.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Niste ulogovani' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ message: 'Neispravan token' });
  }
}

function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Samo admin' });
  }
  next();
}

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
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email i lozinka su obavezni' });
  }
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Pogrešan email ili lozinka' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: serializeUser(user) });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ message: 'Korisnik ne postoji' });
  res.json(serializeUser(user));
});

app.put('/api/auth/me', authMiddleware, async (req, res) => {
  const data = {};
  if (req.body.full_name != null) data.fullName = req.body.full_name;
  if (req.body.profile_image != null) data.profileImage = req.body.profile_image;
  const user = await prisma.user.update({ where: { id: req.userId }, data });
  res.json(serializeUser(user));
});

// ——— Houses ———
app.get('/api/houses', authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.id) where.id = req.query.id;
  const houses = await prisma.house.findMany({
    where,
    orderBy: parseSort(req.query.sort, ['createdAt', 'name']),
  });
  res.json(houses.map(serializeHouse));
});

app.post('/api/houses', authMiddleware, async (req, res) => {
  const house = await prisma.house.create({ data: houseFromBody(req.body) });
  res.status(201).json(serializeHouse(house));
});

app.put('/api/houses/:id', authMiddleware, async (req, res) => {
  const house = await prisma.house.update({
    where: { id: req.params.id },
    data: houseFromBody(req.body),
  });
  res.json(serializeHouse(house));
});

app.delete('/api/houses/:id', authMiddleware, async (req, res) => {
  await prisma.house.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— Rooms ———
app.get('/api/rooms', authMiddleware, async (req, res) => {
  const where = {};
  if (req.query.house_id) where.houseId = req.query.house_id;
  if (req.query.id) where.id = req.query.id;
  const rooms = await prisma.room.findMany({
    where,
    orderBy: parseSort(req.query.sort, ['createdAt']),
  });
  res.json(rooms.map(serializeRoom));
});

app.post('/api/rooms', authMiddleware, async (req, res) => {
  const room = await prisma.room.create({ data: roomFromBody(req.body) });
  res.status(201).json(serializeRoom(room));
});

app.post('/api/rooms/bulk', authMiddleware, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const created = [];
  for (const item of items) {
    const room = await prisma.room.create({ data: roomFromBody(item) });
    created.push(serializeRoom(room));
  }
  res.status(201).json(created);
});

app.put('/api/rooms/:id', authMiddleware, async (req, res) => {
  const data = roomFromBody(req.body);
  const room = await prisma.room.update({ where: { id: req.params.id }, data });
  res.json(serializeRoom(room));
});

app.delete('/api/rooms/:id', authMiddleware, async (req, res) => {
  await prisma.room.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— Columns ———
app.get('/api/columns', authMiddleware, async (req, res) => {
  const columns = await prisma.column.findMany({
    orderBy: parseSort(req.query.sort || 'order', ['order']),
  });
  res.json(columns.map(serializeColumn));
});

app.post('/api/columns', authMiddleware, async (req, res) => {
  const col = await prisma.column.create({
    data: { name: req.body.name, order: req.body.order ?? 0 },
  });
  res.status(201).json(serializeColumn(col));
});

app.put('/api/columns/:id', authMiddleware, async (req, res) => {
  const col = await prisma.column.update({
    where: { id: req.params.id },
    data: { name: req.body.name, order: req.body.order },
  });
  res.json(serializeColumn(col));
});

app.delete('/api/columns/:id', authMiddleware, async (req, res) => {
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

app.post('/api/tasks', authMiddleware, async (req, res) => {
  const task = await prisma.task.create({ data: taskFromBody(req.body) });
  res.status(201).json(serializeTask(task));
});

app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: taskFromBody(req.body),
  });
  res.json(serializeTask(task));
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ——— Users (admin) ———
app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: parseSort(req.query.sort, ['createdAt']),
  });
  res.json(users.map(serializeUser));
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  const data = {};
  if (req.body.full_name != null) data.fullName = req.body.full_name;
  if (req.body.role != null) data.role = req.body.role;
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
    const parsed = await pdfParse(req.file.buffer);
    const text = parsed.text || '';
    const entries = parsePdfTextToEntries(text);
    res.json({ status: 'success', output: { entries } });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      status: 'error',
      details: 'PDF nije mogao biti pročitan. Proverite format ili unesite podatke ručno.',
    });
  }
});

function parsePdfTextToEntries(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries = [];
  let currentHouse = 'Nepoznata kuća';

  for (const line of lines) {
    if (/^(kuća|house|objekat)\s*[:#]?\s*/i.test(line)) {
      currentHouse = line.replace(/^(kuća|house|objekat)\s*[:#]?\s*/i, '').trim() || currentHouse;
      continue;
    }
    const roomMatch = line.match(/^(soba|room|apt|apartman)\s*[:#]?\s*(\S+)/i);
    if (roomMatch) {
      entries.push({
        house_name: currentHouse,
        room_number: roomMatch[2],
        room_structure: '',
        number_of_persons: 1,
        occupant_names: [],
        stay_from: '',
        stay_to: '',
        notes: line,
        bus_info: /\b(bus|autobus)\b/i.test(line) ? line : '',
      });
    }
  }

  if (entries.length === 0 && lines.length > 0) {
    entries.push({
      house_name: lines[0].slice(0, 80) || 'Import iz PDF',
      room_number: '1',
      number_of_persons: 1,
      occupant_names: [],
      notes: text.slice(0, 500),
    });
  }
  return entries;
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Home Sorter API: http://localhost:${PORT}`);
});
