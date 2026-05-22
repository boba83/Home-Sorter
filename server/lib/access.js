import { displayFullName } from './serialize.js';

function normName(s) {
  return String(s || '').trim().toLocaleLowerCase();
}

/** Ista logika kao na klijentu: odgovorna osoba vs ime korisnika. */
function userMatchesResponsiblePerson(user, responsiblePerson) {
  if (!user || !responsiblePerson?.trim()) return false;
  const rp = normName(responsiblePerson);
  const variants = new Set();
  const dn = displayFullName(user);
  if (dn) variants.add(normName(dn));
  const fl = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fl) variants.add(normName(fl));
  if (user.fullName?.trim()) variants.add(normName(user.fullName));
  for (const v of variants) {
    if (v && v === rp) return true;
  }
  return false;
}

export const ROLES = ['admin', 'user', 'viewer'];

export function isAdmin(role) {
  return String(role || '').toLowerCase() === 'admin';
}

export function isViewer(role) {
  return String(role || '').toLowerCase() === 'viewer';
}

export function hasAllHousesAccess(role, canAccessAllHouses) {
  return isAdmin(role) || Boolean(canAccessAllHouses);
}

export function canUseTasks(role) {
  return role === 'admin' || role === 'user';
}

export function canEditTasks(role) {
  return canUseTasks(role);
}

export async function loadUserAccess(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canAccessAllHouses: true },
  });
  return {
    role: user?.role ?? 'user',
    canAccessAllHouses: Boolean(user?.canAccessAllHouses),
  };
}

/** @deprecated use loadUserAccess */
export async function loadUserRole(prisma, userId) {
  const access = await loadUserAccess(prisma, userId);
  return access.role;
}

export async function accessibleHouseIds(prisma, userId, role, canAccessAllHouses = false) {
  if (hasAllHousesAccess(role, canAccessAllHouses)) return null;
  const rows = await prisma.houseMember.findMany({
    where: { userId },
    select: { houseId: true },
  });
  const byMember = rows.map((r) => r.houseId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, firstName: true, lastName: true, email: true },
  });

  const withResponsible = await prisma.house.findMany({
    where: { responsiblePerson: { not: null } },
    select: { id: true, responsiblePerson: true },
  });
  const byResponsible = withResponsible
    .filter((h) => userMatchesResponsiblePerson(user, h.responsiblePerson))
    .map((h) => h.id);

  return [...new Set([...byMember, ...byResponsible])];
}

export async function houseWhereForUser(prisma, userId, role, canAccessAllHouses = false) {
  const ids = await accessibleHouseIds(prisma, userId, role, canAccessAllHouses);
  if (ids === null) return {};
  if (!ids.length) return { id: '__no_access__' };
  return { id: { in: ids } };
}

export async function canAccessHouse(prisma, userId, role, houseId, canAccessAllHouses = false) {
  if (hasAllHousesAccess(role, canAccessAllHouses)) return true;
  const member = await prisma.houseMember.findUnique({
    where: { houseId_userId: { houseId, userId } },
  });
  if (member) return true;
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { responsiblePerson: true },
  });
  if (!house?.responsiblePerson?.trim()) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, firstName: true, lastName: true, email: true },
  });
  return userMatchesResponsiblePerson(user, house.responsiblePerson);
}

export async function canEditHouse(prisma, userId, role, houseId, canAccessAllHouses = false) {
  if (isAdmin(role)) return true;
  if (isViewer(role)) return false;
  if (canAccessAllHouses) return true;
  return canAccessHouse(prisma, userId, role, houseId, false);
}

export async function setHouseMembers(prisma, houseId, userIds) {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean))];
  await prisma.houseMember.deleteMany({ where: { houseId } });
  if (uniqueIds.length) {
    await prisma.houseMember.createMany({
      data: uniqueIds.map((userId) => ({ houseId, userId })),
    });
    const primary = await prisma.user.findUnique({ where: { id: uniqueIds[0] } });
    const name = primary ? displayFullName(primary) || primary.email : null;
    await prisma.house.update({
      where: { id: houseId },
      data: { responsiblePerson: name },
    });
  } else {
    await prisma.house.update({
      where: { id: houseId },
      data: { responsiblePerson: null },
    });
  }
}

/** Korisnici za koje sme da se planira dežurstvo (članovi kuća koje korisnik vidi; admin / sve kuće → svi članovi). */
export async function getDutyPoolUserIds(prisma, userId, role, canAccessAllHouses = false) {
  if (isViewer(role)) return [];
  if (isAdmin(role) || hasAllHousesAccess(role, canAccessAllHouses)) {
    const rows = await prisma.houseMember.findMany({
      distinct: ['userId'],
      select: { userId: true },
    });
    const ids = new Set(rows.map((r) => r.userId));
    if (ids.size === 0) {
      const fallback = await prisma.user.findMany({
        where: { role: { in: ['admin', 'user'] } },
        select: { id: true },
      });
      return fallback.map((u) => u.id);
    }
    return [...ids];
  }
  const houseIds = await accessibleHouseIds(prisma, userId, role, canAccessAllHouses);
  if (!houseIds?.length) {
    return [userId];
  }
  const rows = await prisma.houseMember.findMany({
    where: { houseId: { in: houseIds } },
    distinct: ['userId'],
    select: { userId: true },
  });
  const s = new Set(rows.map((r) => r.userId));
  s.add(userId);
  return [...s];
}
