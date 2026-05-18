import { displayFullName } from './serialize.js';

export const ROLES = ['admin', 'user', 'viewer'];

export function isAdmin(role) {
  return role === 'admin';
}

export function isViewer(role) {
  return role === 'viewer';
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
  return rows.map((r) => r.houseId);
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
  return Boolean(member);
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
