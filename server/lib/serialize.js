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

export function serializeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    role: u.role,
    profile_image: u.profileImage,
    created_date: u.createdAt?.toISOString?.() ?? u.createdAt,
    updated_date: u.updatedAt?.toISOString?.() ?? u.updatedAt,
  };
}

export function serializeHouse(h) {
  return {
    id: h.id,
    name: h.name,
    address: h.address,
    total_rooms: h.totalRooms,
    total_capacity: h.totalCapacity,
    responsible_person: h.responsiblePerson,
    location: h.location,
    created_date: h.createdAt?.toISOString?.() ?? h.createdAt,
    updated_date: h.updatedAt?.toISOString?.() ?? h.updatedAt,
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
  return {
    title: body.title,
    description: body.description,
    columnId: body.column_id,
    order: body.order,
    startDate: body.start_date,
    dueDate: body.due_date,
    labels: JSON.stringify(body.labels ?? []),
    assignedUsers: JSON.stringify(body.assigned_users ?? []),
    images: JSON.stringify(body.images ?? []),
    cardColor: body.card_color,
    epicTitle: body.epic_title,
    checklists: JSON.stringify(body.checklists ?? []),
    comments: JSON.stringify(body.comments ?? []),
  };
}
