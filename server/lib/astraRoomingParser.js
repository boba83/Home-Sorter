/**
 * Parsiranje ASTRA / sličnih rooming list PDF-ova.
 */

const SEX_ALT = 'MR|MRS|CHD|INF|MS|MISS|DR';
/** Sobe: 4, 101, B3, A1, A 1 (PDF često razdvoji slovo i broj) */
const ROOM = '[A-Za-z]\\s*\\d{1,3}|[A-Za-z]\\d{1,3}|\\d{1,4}[A-Za-z]?';
const VOUCHER_IN_LINE = /\d{4,}\/\d{2,}/;

const PRIMARY_GUEST = new RegExp(
  `^\\d+\\s+(${SEX_ALT})\\s+(.+?)\\s+(\\d+\\/\\d{2,})\\s+(\\S+)\\s+(${ROOM})\\s+(.+)$`,
  'i',
);

const PRIMARY_NO_VOUCHER = new RegExp(
  `^\\d+\\s+(${SEX_ALT})\\s+(.+?)\\s+(${ROOM})\\s+(.+)$`,
  'i',
);

const CONTINUATION = new RegExp(`^\\d+\\s+(${SEX_ALT})\\s+(.+)$`, 'i');
const PHONE_TAIL = /(\d{2,3}\/\d{6,})\s*$/;
const SKIP_NAME = /^(?:---+|X{3,})/i;
const SKIP_LINE =
  /^(?:STRANA:|ROOMING|PTA\d|DATUM|VREME|No\s+Sex|SUBAGENT|PAGE\s+\d|─+)/i;

function normalizePdfLine(raw) {
  let line = String(raw || '')
    .replace(/\u00A0/g, ' ')
    .trim();
  line = line.replace(/^\d{1,4}\s+(?=Hotel\b)/i, '');
  line = line.replace(/^\d{1,4}\s+(?=(?:Kuća|Kuca|Villa|Vila|Objekat|Object)\b)/i, '');
  return line.replace(/\s+/g, ' ').trim();
}

function isValidHotelName(name) {
  if (!name || name.length < 2) return false;
  if (/TOTAL|\/ADT\b|ROOMS\s*:/i.test(name)) return false;
  if (/^\d+\s*\/\s*ADT/i.test(name)) return false;
  return true;
}

function cleanHotelName(raw) {
  if (!raw) return '';
  let name = raw.replace(/\s+/g, ' ').trim();
  const cut = name.match(/\b(?:ARR|DEP)\s*:/i);
  if (cut) name = name.slice(0, cut.index).trim();
  const date = name.match(/\b\d{1,2}\.\d{1,2}\.\d{4}\b/);
  if (date) name = name.slice(0, date.index).trim();
  return name;
}

/** Samo pravi "Hotel:" na početku reda — NE "TOTAL-HOTEL:" */
function extractHotelFromLine(line) {
  if (!line || SKIP_LINE.test(line) || /^TOTAL/i.test(line)) return null;

  if (/^Hotel\s*\.+\s*:?\s*$/i.test(line) || /^Hotel\s*:?\s*$/i.test(line)) {
    return '__PENDING__';
  }

  const startLabel = line.match(
    /^(?:Hotel|Kuća|Kuca|Objekat|Object|Villa|Vila)\s*\.{0,3}\s*:?\s*(.+)$/i,
  );
  if (startLabel) {
    const name = cleanHotelName(startLabel[1]);
    if (isValidHotelName(name)) return name;
  }
  return null;
}

function looksLikeStandaloneHotelTitle(line) {
  if (line.length < 2 || line.length > 120) return false;
  if (SKIP_LINE.test(line) || /^TOTAL/i.test(line)) return false;
  if (/TOTAL|ROOMS\s*:|\/ADT/i.test(line)) return false;
  if (/^\d+\s/.test(line)) return false;
  if (PRIMARY_GUEST.test(line) || PRIMARY_NO_VOUCHER.test(line)) return false;
  if (CONTINUATION.test(line)) return false;
  if (/^(MR|MRS|CHD|INF|MS|MISS|DR)\b/i.test(line)) return false;
  if (/^(ARR|DEP|Hotel|Kuća|No\s+Sex)\b/i.test(line)) return false;
  if (!/[A-Za-zŠĐČĆŽ]/.test(line)) return false;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(line)) return false;
  return true;
}

function guessCapacityFromStructure(structure) {
  if (!structure) return null;
  const s = structure.toUpperCase();
  const plus = s.match(/1\/(\d+)\s*\+\s*(\d+)/);
  if (plus) return Math.max(1, parseInt(plus[1], 10) + parseInt(plus[2], 10));
  const range = s.match(/1\/(\d+)\s*-\s*(\d+)/);
  if (range) return Math.max(1, parseInt(range[2], 10));
  const m = s.match(/1\/(\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return null;
}

function splitStructureAgencyBus(rest) {
  let bus_info = '';
  let t = rest.trim();
  if (/\b(?:BUS\s+PAK|AUTOBUS)\b/i.test(t)) {
    bus_info = /\bBUS\s+PAK\b/i.test(t) ? 'BUS PAK' : 'AUTOBUS';
    t = t.replace(/\s*(?:BUS\s+PAK|AUTOBUS)\s*/gi, ' ').trim();
  }

  const travelTail = t.match(/\s+[A-Za-zŠĐČĆŽšđčćž]+\s+TRAVEL(?:\s+D\.O\.O\.)?$/i);
  if (travelTail && travelTail.index > 0) {
    return {
      structure: t.slice(0, travelTail.index).trim(),
      agency: t.slice(travelTail.index).trim(),
      bus_info: bus_info || (/\bBUS\b/i.test(t) ? 'BUS' : ''),
    };
  }

  const chunks = t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (
      last.length > 6 &&
      /\b(TRAVEL|TURS|D\.O\.O\.|PARADISO|HOLIDAY|CLUB|START|ROMANOV|DOMINO|GLOBO|ECO|ANDRIJATIC|SUBAGENT|DREAM\s+LAND)\b/i.test(
        last,
      )
    ) {
      return {
        structure: chunks.slice(0, -1).join(' '),
        agency: last,
        bus_info,
      };
    }
  }
  return { structure: t.replace(/\s+/g, ' ').trim(), agency: '', bus_info };
}

function extractPhoneAndRest(tail) {
  const m = tail.trim().match(PHONE_TAIL);
  if (!m) return { phone: '', rest: tail.trim() };
  return { phone: m[1], rest: tail.slice(0, m.index).trim() };
}

function formatOccupant(sex, namePart) {
  return `${sex.toUpperCase()} ${namePart.replace(/\s+/g, ' ').trim()}`.trim();
}

function cleanGuestName(namePart) {
  return namePart
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+\d{1,2}\s*DA\s*$/i, '')
    .trim();
}

function normalizeRoomNumber(raw) {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/([A-Za-z])\s+(\d)/g, '$1$2')
    .toUpperCase();
}

function parsePrimaryGuestLine(line) {
  const withVoucher = line.match(PRIMARY_GUEST);
  if (withVoucher) {
    return {
      sex: withVoucher[1],
      name: withVoucher[2],
      roomNo: normalizeRoomNumber(withVoucher[5]),
      tail: withVoucher[6],
    };
  }
  if (VOUCHER_IN_LINE.test(line)) return null;
  const noVoucher = line.match(PRIMARY_NO_VOUCHER);
  if (noVoucher) {
    return {
      sex: noVoucher[1],
      name: noVoucher[2],
      roomNo: normalizeRoomNumber(noVoucher[3]),
      tail: noVoucher[4],
    };
  }
  return null;
}

function isContinuationLine(line) {
  if (!CONTINUATION.test(line)) return false;
  if (parsePrimaryGuestLine(line)) return false;
  const cm = line.match(CONTINUATION);
  const tail = (cm[2] || '').trim();
  if (!tail || /^\d+\s*\/\s*\d+/.test(tail)) return false;
  return true;
}

function entryFromBuffer(buf, currentHotel, stayFrom, stayTo, defaultLocation) {
  const cap = guessCapacityFromStructure(buf.structure) ?? Math.max(buf.occupants.length, 1);
  return {
    house_name: currentHotel,
    room_number: buf.roomNumber,
    room_structure: buf.structure,
    stay_from: stayFrom,
    stay_to: stayTo,
    occupant_names: [...buf.occupants],
    number_of_persons: buf.occupants.length,
    capacity: cap,
    notes: [buf.agency].filter(Boolean).join(' ').trim(),
    contact_phone: buf.phone || '',
    bus_info: buf.bus_info || '',
    location: defaultLocation || null,
  };
}

export function parseAstraRoomingListLines(rawLines, defaultLocation) {
  const entries = [];
  const hotelsSeen = new Set();
  let currentHotel = '';
  let stayFrom = '';
  let stayTo = '';
  let pendingHotel = false;
  let buf = null;

  const flush = () => {
    if (!buf || buf.occupants.length === 0) return;
    entries.push(entryFromBuffer(buf, currentHotel, stayFrom, stayTo, defaultLocation));
    buf = null;
  };

  const setHotel = (name) => {
    const n = cleanHotelName(name);
    if (!isValidHotelName(n)) return;
    if (currentHotel && n.toLowerCase() === currentHotel.toLowerCase()) {
      pendingHotel = false;
      return;
    }
    flush();
    pendingHotel = false;
    currentHotel = n;
    hotelsSeen.add(n);
  };

  const lines = rawLines.map(normalizePdfLine).filter((l) => l.length > 0);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';

    if (!line) continue;
    if (SKIP_LINE.test(line)) continue;

    if (/^TOTAL/i.test(line)) {
      flush();
      pendingHotel = false;
      continue;
    }

    if (pendingHotel) {
      if (/^ARR:/i.test(line) || /^DEP:/i.test(line)) {
        pendingHotel = false;
      } else if (looksLikeStandaloneHotelTitle(line)) {
        setHotel(line);
        continue;
      }
    }

    const hotelExtracted = extractHotelFromLine(line);
    if (hotelExtracted === '__PENDING__') {
      pendingHotel = true;
      continue;
    }
    if (hotelExtracted) {
      setHotel(hotelExtracted);
      continue;
    }

    const arr = line.match(/^ARR:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (arr) {
      stayFrom = arr[1];
      continue;
    }
    const dep = line.match(/^DEP:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (dep) {
      stayTo = dep[1];
      continue;
    }

    if (!currentHotel && looksLikeStandaloneHotelTitle(line)) {
      if (/^ARR:/i.test(nextLine) || /^DEP:/i.test(nextLine)) {
        setHotel(line);
        continue;
      }
    }

    if (!currentHotel) continue;

    const primary = parsePrimaryGuestLine(line);
    if (primary) {
      flush();
      const sex = primary.sex.toUpperCase();
      const namePart = cleanGuestName(primary.name);
      if (SKIP_NAME.test(namePart) || SKIP_NAME.test(namePart.split(/\s+/)[0] || '')) continue;

      const { phone, rest } = extractPhoneAndRest(primary.tail);
      const { structure, agency, bus_info } = splitStructureAgencyBus(rest);
      buf = {
        roomNumber: normalizeRoomNumber(primary.roomNo),
        structure,
        occupants: [formatOccupant(sex, namePart)],
        phone,
        agency,
        bus_info,
      };
      continue;
    }

    if (isContinuationLine(line) && buf) {
      const cm = line.match(CONTINUATION);
      const sex = cm[1].toUpperCase();
      let namePart = cleanGuestName(cm[2]);
      namePart = namePart.replace(/\s+(?:BUS\s+PAK|AUTOBUS)\s*$/i, '').trim();
      if (SKIP_NAME.test(namePart) || SKIP_NAME.test(namePart.split(/\s+/)[0] || '')) continue;
      buf.occupants.push(formatOccupant(sex, namePart));
    }
  }

  flush();

  const roomCountByHotel = new Map();
  for (const e of entries) {
    roomCountByHotel.set(e.house_name, (roomCountByHotel.get(e.house_name) || 0) + 1);
  }
  const hotels = [...hotelsSeen].filter(isValidHotelName);
  const hotelsMissingRooms = hotels.filter((h) => !roomCountByHotel.get(h));

  return { entries, hotels, hotelsMissingRooms };
}

export function scanHotelNamesInText(text) {
  const found = new Set();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = normalizePdfLine(raw);
    const h = extractHotelFromLine(line);
    if (h && h !== '__PENDING__' && isValidHotelName(h)) found.add(h);
  }
  return [...found];
}

export function looksLikeAstraRoomingList(text) {
  const t = String(text || '');
  if (/\bROOMING\s+LIST\b/i.test(t) && /\bHotel\s*:/i.test(t)) return true;
  if (/(?:^|\n)\s*Hotel\s*\.{0,3}\s*:?\s*\S/im.test(t) && /\bARR:\s*\d{1,2}\.\d{1,2}\.\d{4}/i.test(t)) {
    return true;
  }
  if (/\bNo\s+Sex\b/i.test(t) && /\b(MR|MRS)\b.+\d{4,}\/\d{2}/im.test(t)) return true;
  return false;
}

/** Podeli spojene PDF redove (retko, ali pomaže kad pdf-parse spoji kolone) */
export function splitPdfTextToLines(text) {
  const raw = String(text || '').split(/\r?\n/);
  const out = [];
  for (let rawLine of raw) {
    let line = rawLine.replace(/\u00A0/g, ' ').trim();
    if (!line) continue;
    const parts = line.split(/(?=\s*\d+\s+(?:MR|MRS|CHD|INF|MS|MISS|DR)\s+)/i);
    if (parts.length > 1) {
      for (const p of parts) {
        const t = p.trim();
        if (t) out.push(t);
      }
    } else {
      out.push(line);
    }
  }
  return out;
}
