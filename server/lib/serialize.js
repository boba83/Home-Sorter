function parseJsonArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function displayFullName(u) {
  if (!u) return '';
  const fromParts = [u.firstName, u.lastName].filter((p) => p && String(p).trim()).join(' ').trim();
  return fromParts || u.fullName || '';
}

/** Polja iz API tela → Prisma (sinhronizuje fullName sa imenom + prezimenom) */
export function userUpdateFromBody(body, existing = null) {
  const data = {};
  if (body.profile_image != null) data.profileImage = body.profile_image;
  if (body.role != null && ['admin', 'user', 'viewer'].includes(body.role)) {
    data.role = body.role;
  }
  if (body.can_access_all_houses !== undefined) {
    data.canAccessAllHouses = Boolean(body.can_access_all_houses);
  }

  let firstName = existing?.firstName ?? '';
  let lastName = existing?.lastName ?? '';

  if (body.first_name !== undefined) {
    data.firstName = body.first_name ? String(body.first_name).trim() : null;
    firstName = data.firstName ?? '';
  }
  if (body.last_name !== undefined) {
    data.lastName = body.last_name ? String(body.last_name).trim() : null;
    lastName = data.lastName ?? '';
  }
  if (body.full_name != null && body.first_name === undefined && body.last_name === undefined) {
    data.fullName = String(body.full_name).trim();
  }

  if (body.first_name !== undefined || body.last_name !== undefined) {
    const combined = [firstName, lastName].filter(Boolean).join(' ').trim();
    if (combined) data.fullName = combined;
    else if (existing?.fullName) data.fullName = existing.fullName;
  }

  return data;
}

const PROFILE_IMAGE_INLINE_MAX = 4096;

export function serializeUser(u, { includeProfileImage = false, hasProfileImage } = {}) {
  if (!u) return null;
  const hasProfile = hasProfileImage ?? Boolean(u.profileImage);
  const payload = {
    id: u.id,
    email: u.email,
    first_name: u.firstName ?? '',
    last_name: u.lastName ?? '',
    full_name: displayFullName(u),
    role: u.role,
    can_access_all_houses: Boolean(u.canAccessAllHouses),
    has_profile_image: hasProfile,
    created_date: u.createdAt?.toISOString?.() ?? u.createdAt,
    updated_date: u.updatedAt?.toISOString?.() ?? u.updatedAt,
  };
  if (includeProfileImage && u.profileImage) {
    const img = u.profileImage;
    payload.profile_image =
      img.length <= PROFILE_IMAGE_INLINE_MAX ? img : null;
  }
  return payload;
}

export const userAuthSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  fullName: true,
  role: true,
  canAccessAllHouses: true,
  createdAt: true,
  updatedAt: true,
};

export async function userHasProfileImage(prisma, userId) {
  const rows = await prisma.$queryRaw`
    SELECT CASE
      WHEN profileImage IS NOT NULL AND length(profileImage) > 0 THEN 1
      ELSE 0
    END AS hasImg
    FROM User
    WHERE id = ${userId}
  `;
  return Boolean(Number(rows[0]?.hasImg));
}

export function serializeHouse(h) {
  const memberIds =
    h.members?.map((m) => m.userId) ??
    (h.member_user_ids ? h.member_user_ids : []);
  return {
    id: h.id,
    name: h.name,
    address: h.address,
    total_rooms: h.totalRooms,
    total_capacity: h.totalCapacity,
    responsible_person: h.responsiblePerson,
    location: h.location,
    member_user_ids: memberIds,
    created_date: h.createdAt?.toISOString?.() ?? h.createdAt,
    updated_date: h.updatedAt?.toISOString?.() ?? h.updatedAt,
  };
}

export function serializeInvite(inv, appUrl) {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    token: inv.token,
    invite_url: `${appUrl}/accept-invite?token=${inv.token}`,
    expires_at: inv.expiresAt?.toISOString?.() ?? inv.expiresAt,
    accepted_at: inv.acceptedAt?.toISOString?.() ?? inv.acceptedAt,
    created_date: inv.createdAt?.toISOString?.() ?? inv.createdAt,
    pending: !inv.acceptedAt,
  };
}

export function serializeRoom(r) {
  return {
    id: r.id,
    house_id: r.houseId,
    house_name: r.houseName,
    room_number: r.roomNumber,
    room_structure: r.roomStructure,
    capacity: r.capacity,
    current_occupants: r.currentOccupants,
    occupant_names: parseJsonArray(r.occupantNames),
    notes: r.notes,
    notes_updated_at: r.notesUpdatedAt?.toISOString?.() ?? r.notesUpdatedAt,
    excursion: r.excursion,
    excursion_updated_at: r.excursionUpdatedAt?.toISOString?.() ?? r.excursionUpdatedAt,
    visit: r.visit,
    visit_updated_at: r.visitUpdatedAt?.toISOString?.() ?? r.visitUpdatedAt,
    stay_from: r.stayFrom,
    stay_to: r.stayTo,
    contact_phone: r.contactPhone,
    bus: r.bus,
    tax_paid: r.taxPaid,
    created_date: r.createdAt?.toISOString?.() ?? r.createdAt,
    updated_date: r.updatedAt?.toISOString?.() ?? r.updatedAt,
  };
}

export function serializeColumn(c) {
  return {
    id: c.id,
    name: c.name,
    order: c.order,
    created_date: c.createdAt?.toISOString?.() ?? c.createdAt,
    updated_date: c.updatedAt?.toISOString?.() ?? c.updatedAt,
  };
}

export function serializeTask(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    column_id: t.columnId,
    order: t.order,
    start_date: t.startDate,
    due_date: t.dueDate,
    labels: parseJsonArray(t.labels),
    assigned_users: parseJsonArray(t.assignedUsers),
    images: parseJsonArray(t.images),
    card_color: t.cardColor,
    epic_title: t.epicTitle,
    checklists: parseJsonArray(t.checklists),
    comments: parseJsonArray(t.comments),
    created_date: t.createdAt?.toISOString?.() ?? t.createdAt,
    updated_date: t.updatedAt?.toISOString?.() ?? t.updatedAt,
  };
}

export function roomFromBody(body) {
  return {
    houseId: body.house_id,
    houseName: body.house_name,
    roomNumber: body.room_number,
    roomStructure: body.room_structure,
    capacity: body.capacity,
    currentOccupants: body.current_occupants,
    occupantNames: JSON.stringify(body.occupant_names ?? []),
    notes: body.notes,
    notesUpdatedAt: body.notes_updated_at ? new Date(body.notes_updated_at) : undefined,
    excursion: body.excursion,
    excursionUpdatedAt: body.excursion_updated_at ? new Date(body.excursion_updated_at) : undefined,
    visit: body.visit,
    visitUpdatedAt: body.visit_updated_at ? new Date(body.visit_updated_at) : undefined,
    stayFrom: body.stay_from,
    stayTo: body.stay_to,
    contactPhone: body.contact_phone ?? undefined,
    bus: body.bus ?? false,
    taxPaid: body.tax_paid ?? false,
  };
}

export function houseFromBody(body) {
  return {
    name: body.name,
    address: body.address,
    totalRooms: body.total_rooms,
    totalCapacity: body.total_capacity,
    responsiblePerson: body.responsible_person,
    location: body.location,
  };
}

export function taskFromBody(body) {
  const data = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description;
  if (body.column_id !== undefined) data.columnId = body.column_id;
  if (body.order !== undefined) data.order = body.order;
  if (body.start_date !== undefined) data.startDate = body.start_date;
  if (body.due_date !== undefined) data.dueDate = body.due_date;
  if (body.labels !== undefined) data.labels = JSON.stringify(body.labels ?? []);
  if (body.assigned_users !== undefined) data.assignedUsers = JSON.stringify(body.assigned_users ?? []);
  if (body.images !== undefined) data.images = JSON.stringify(body.images ?? []);
  if (body.card_color !== undefined) data.cardColor = body.card_color;
  if (body.epic_title !== undefined) data.epicTitle = body.epic_title;
  if (body.checklists !== undefined) data.checklists = JSON.stringify(body.checklists ?? []);
  if (body.comments !== undefined) data.comments = JSON.stringify(body.comments ?? []);
  return data;
}

export function serializeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    severity: n.severity,
    task_id: n.taskId,
    title: n.title,
    message: n.message,
    read: n.read,
    created_date: n.createdAt?.toISOString?.() ?? n.createdAt,
  };
}
