/**
 * Parsiranje ASTRA / sličnih rooming list PDF-ova.
 */

import {
  maskCompoundStructurePhrases,
  unmaskCompoundStructurePhrases,
} from './roomingStructureProtect.js';

const SEX_ALT = 'MR|MRS|CHD|INF|MS|MISS|DR';
/** Sobe: 4, 101, B3, A1, A 1, UL9, 11A, 5b, 3-B, 02. (PDF artefakt tačka) */
const ROOM =
  '(?:[A-Za-z]{2,3}\\d{1,3}|[A-Za-z]\\s*\\d{1,3}|[A-Za-z]\\d{1,3}|\\d{1,4}(?:\\s*-\\s*[A-Za-z]{1,2}|[A-Za-z]{1,2})?\\.?)';
const VOUCHER_IN_LINE = /\d{4,}\/\d{2,}/;

const PRIMARY_GUEST = new RegExp(
  `^(\\d+)\\s+(${SEX_ALT})\\s+(.+?)\\s+(\\d+\\/\\d{2,})\\s+(\\S+)\\s+(${ROOM})\\s+(.+)$`,
  'i',
);

const PRIMARY_NO_VOUCHER = new RegExp(
  `^(\\d+)\\s+(${SEX_ALT})\\s+(.+?)\\s+(${ROOM})\\s+(.+)$`,
  'i',
);

const CONTINUATION = new RegExp(`^\\d+\\s+(${SEX_ALT})\\s+(.+)$`, 'i');
/** Beba (0–2): u PDF-u često samo „INF PREZIME Ime“ bez rednog broja u prvoj koloni. */
const STANDALONE_INF = /^\s*INF\s+(.+)$/i;
const PHONE_TAIL = /(\d{2,3}\/\d{6,})\s*$/;
const SKIP_NAME = /^(?:---+|X{3,})/i;
const SKIP_LINE =
  /^(?:STRANA:|ROOMING|PTA\d|DATUM|VREME|No\s+Sex|SUBAGENT|PAGE\s+\d|─+)/i;

function normalizePdfLine(raw) {
  let line = String(raw || '')
    .replace(/\u00A0/g, ' ')
    .trim();
  line = line.replace(/^\d{1,4}\s+(?=Hotel\b)/i, '');
  line = line.replace(/^\d{1,4}\s+(?=House\b)/i, '');
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

  if (/^(?:Hotel|House)\s*\.+\s*:?\s*$/i.test(line) || /^(?:Hotel|House)\s*:?\s*$/i.test(line)) {
    return '__PENDING__';
  }

  const startLabel = line.match(
    /^(?:Hotel|House|Kuća|Kuca|Objekat|Object|Villa|Vila)\s*\.{0,3}\s*:?\s*(.+)$/i,
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
  if (/^(ARR|DEP|Hotel|House|Kuća|No\s+Sex)\b/i.test(line)) return false;
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
  const { masked, tokens } = maskCompoundStructurePhrases(rest);
  const unwrap = (structure, agency, bus_info) => ({
    structure: unmaskCompoundStructurePhrases(structure, tokens),
    agency: unmaskCompoundStructurePhrases(agency || '', tokens),
    bus_info: bus_info || '',
  });

  let bus_info = '';
  let t = masked.trim();
  if (/\b(?:BUS\s+PAK|AUTOBUS)\b/i.test(t)) {
    bus_info = /\bBUS\s+PAK\b/i.test(t) ? 'BUS PAK' : 'AUTOBUS';
    t = t.replace(/\s*(?:BUS\s+PAK|AUTOBUS)\s*/gi, ' ').trim();
  }

  function looksLikeRoomStructure(s) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2) return false;
    if (/^(NA|DA|N\/A)$/i.test(t)) return false;
    return /[\d/]|STUDIO|APP|APT|DUPLEX|APARTMENT|APARTMAN|ROOM|\+{2}/i.test(t);
  }

  // 1) ... TOURIST|TRAVEL + D.O.O. na kraju (i bez reči STUDIO u sredini)
  const dooTail = t.match(
    /^(.+)\s+((?:[A-ZŠĐČĆŽšđčćž][A-Za-zŠĐČĆŽšđčćž0-9.-]*\s+){1,5}(?:TOURIST|TRAVEL)\s+D\.O\.O\.)$/i,
  );
  if (dooTail && dooTail[2].length >= 10 && looksLikeRoomStructure(dooTail[1])) {
    return unwrap(
      dooTail[1].trim(),
      dooTail[2].trim(),
      bus_info || (/\bBUS\b/i.test(t) ? 'BUS' : ''),
    );
  }

  // 2) Posle STUDIO/APP/DUPLEX (strože)
  const dooStudio = t.match(
    /^(.+?\b(?:STUDIO|APP|APT|DUPLEX|\+{2})\b)\s+((?:[A-ZŠĐČĆŽ][A-Za-zŠĐČĆŽ.]+\s+){1,4}(?:TOURIST|TRAVEL)\s+D\.O\.O\.)$/i,
  );
  if (dooStudio && dooStudio[2].length >= 12) {
    return unwrap(
      dooStudio[1].trim(),
      dooStudio[2].trim(),
      bus_info || (/\bBUS\b/i.test(t) ? 'BUS' : ''),
    );
  }

  // 3) Posle STUDIO/APP/DUPLEX: ... TRAVEL (npr. "GLOBO TURS TRAVEL")
  const travelAfterType = t.match(
    /^(.+?\b(?:STUDIO|APP|APT|DUPLEX|\+{2})\b)\s+((?:[A-Za-zŠĐČĆŽšđčćž][A-Za-zŠĐČĆŽšđčćž0-9.-]*\s+){1,5}TRAVEL(?:\s+D\.O\.O\.)?)$/i,
  );
  if (travelAfterType && travelAfterType[2].trim().length > 6) {
    return unwrap(
      travelAfterType[1].trim(),
      travelAfterType[2].trim(),
      bus_info || (/\bBUS\b/i.test(t) ? 'BUS' : ''),
    );
  }

  const travelTail = t.match(/\s+[A-Za-zŠĐČĆŽšđčćž]+\s+TRAVEL(?:\s+D\.O\.O\.)?$/i);
  if (travelTail && travelTail.index > 0) {
    const left = t.slice(0, travelTail.index).trim();
    if (looksLikeRoomStructure(left)) {
      return unwrap(
        left,
        t.slice(travelTail.index).trim(),
        bus_info || (/\bBUS\b/i.test(t) ? 'BUS' : ''),
      );
    }
  }

  const chunks = t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (
      last.length > 6 &&
      /\b(TRAVEL|TURS|D\.O\.O\.|PARADISO|HOLIDAY|CLUB|START|ROMANOV|DOMINO|GLOBO|ECO|ANDRIJATIC|SUBAGENT|DREAM\s+LAND|TOURIST)\b/i.test(
        last,
      )
    ) {
      return unwrap(chunks.slice(0, -1).join(' '), last, bus_info);
    }
  }
  return unwrap(t.replace(/\s+/g, ' ').trim(), '', bus_info);
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
    .replace(/\.+$/, '')
    .replace(/([A-Za-z])\s+(\d)/g, '$1$2')
    .replace(/(\d+)\s*-\s*([A-Za-z]{1,2})\b/gi, '$1-$2')
    .toUpperCase();
}

/**
 * PDF ponekad u koloni Room stoji redni broj gosta umesto broja sobe (npr. gost #6 → Room 6).
 * Astra format: `… ugovor NA <soba> 1/3 STUDIO …` — posle "NA" je pravi broj sobe;
 * tada se NE sme odbaciti čak kad se poklapa sa rednim brojem (npr. gost 3 → soba 3).
 */
function hasExplicitAstraRoomColumn(columnBeforeRoom) {
  return /^NA$/i.test(String(columnBeforeRoom || '').trim());
}

function isPhantomRoomFromLineIndex(lineIdxRaw, roomNoRaw, columnBeforeRoom) {
  if (hasExplicitAstraRoomColumn(columnBeforeRoom)) return false;
  const idx = parseInt(String(lineIdxRaw).trim(), 10);
  const rn = normalizeRoomNumber(roomNoRaw);
  if (!rn || /[A-Za-z]/.test(rn)) return false;
  const n = parseInt(rn, 10);
  if (!Number.isFinite(idx) || !Number.isFinite(n)) return false;
  if (idx !== n) return false;
  return n >= 2 && n < 100;
}

/** Rep posle kolone Room — mora ličiti na strukturu / agenciju / telefon (ne samo „NA 6“ od PDF rednog broja). */
function looksLikePrimaryBookingTail(tail) {
  const t = (tail || '').replace(/\s+/g, ' ').trim();
  if (t.length < 6) return false;
  if (/\b1\s*\/\s*\d/.test(t)) return true;
  if (/\b\d+\s*\/\s*\d+\s*[+\-–]/.test(t)) return true;
  if (/\b(?:STUDIO|DUPLEX|APARTMAN|APARTMENT|APART|APP|APT|SUPERIOR|GALERI)\b/i.test(t)) return true;
  if (/\b\d{2,3}\s*\/\s*\d{6,}\b/.test(t)) return true;
  if (t.length >= 18) return true;
  return false;
}

function mergeAdjacentSameRoom(entries) {
  if (entries.length <= 1) return entries;
  const out = [];
  for (const e of entries) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push({
        ...e,
        occupant_names: Array.isArray(e.occupant_names) ? [...e.occupant_names] : [],
      });
      continue;
    }
    const sameRoomNumber =
      prev.house_name === e.house_name &&
      String(prev.room_number || '').toUpperCase() === String(e.room_number || '').toUpperCase();
    const cPrev = String(prev.contract_number || '').trim();
    const cNext = String(e.contract_number || '').trim();
    const sameContract = cPrev === cNext;
    const mergeableContract = sameContract || !cPrev || !cNext;
    const same = sameRoomNumber && mergeableContract;
    if (same) {
      prev.occupant_names = [...prev.occupant_names, ...e.occupant_names];
      prev.number_of_persons = prev.occupant_names.length;
      prev.capacity = Math.max(prev.capacity || 1, e.capacity || 1);
      if (!(prev.room_structure || '').trim() && (e.room_structure || '').trim()) {
        prev.room_structure = e.room_structure;
      }
      if (!(prev.notes || '').trim() && (e.notes || '').trim()) prev.notes = e.notes;
      if (!(prev.contact_phone || '').trim() && (e.contact_phone || '').trim()) {
        prev.contact_phone = e.contact_phone;
      }
      if (!(prev.bus_info || '').trim() && (e.bus_info || '').trim()) prev.bus_info = e.bus_info;
      if (!(prev.contract_number || '').trim() && (e.contract_number || '').trim()) {
        prev.contract_number = e.contract_number;
      }
    } else {
      out.push({
        ...e,
        occupant_names: Array.isArray(e.occupant_names) ? [...e.occupant_names] : [],
      });
    }
  }
  return out;
}

function parsePrimaryGuestLine(line) {
  const withVoucher = line.match(PRIMARY_GUEST);
  if (withVoucher) {
    const lineIdx = withVoucher[1];
    const roomNo = normalizeRoomNumber(withVoucher[6]);
    if (isPhantomRoomFromLineIndex(lineIdx, roomNo, withVoucher[5])) return null;
    if (!looksLikePrimaryBookingTail(withVoucher[7])) return null;
    return {
      sex: withVoucher[2],
      name: withVoucher[3],
      contract_number: withVoucher[4].trim(),
      roomNo,
      tail: withVoucher[7],
    };
  }
  const noVoucher = line.match(PRIMARY_NO_VOUCHER);
  if (noVoucher) {
    const lineIdx = noVoucher[1];
    const roomNo = normalizeRoomNumber(noVoucher[4]);
    if (isPhantomRoomFromLineIndex(lineIdx, roomNo, null)) return null;
    if (!looksLikePrimaryBookingTail(noVoucher[5])) return null;
    let tail = noVoucher[5];
    // Ugovor u repu: npr. 123456/25 ili 123/2024 (ne mešati sa 1/3 u strukturi — traži 3+ cifre pre /).
    const vMatch = tail.match(/\b(\d{3,}\/\d{2,4})\b/);
    const contract_number = vMatch ? vMatch[1] : '';
    if (vMatch) {
      tail = tail.replace(vMatch[0], ' ').replace(/\s+/g, ' ').trim();
    }
    return {
      sex: noVoucher[2],
      name: noVoucher[3],
      contract_number,
      roomNo,
      tail,
    };
  }
  // Linija sa brojem/ugovorom u sredini, ali ne liči na gosta — preskoči.
  if (VOUCHER_IN_LINE.test(line)) return null;
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

/** INF bez rednog broja — nastavak iste sobe (beba 0–2). */
function tryAppendStandaloneInfant(line, buf, entries, currentHotel) {
  const m = line.match(STANDALONE_INF);
  if (!m) return false;
  let namePart = cleanGuestName(m[1]);
  namePart = namePart.replace(/\s+(?:BUS\s+PAK|AUTOBUS)\s*$/i, '').trim();
  if (SKIP_NAME.test(namePart) || SKIP_NAME.test(namePart.split(/\s+/)[0] || '')) return true;
  const occ = formatOccupant('INF', namePart);
  if (buf) {
    buf.occupants.push(occ);
    return true;
  }
  if (entries.length > 0) {
    const last = entries[entries.length - 1];
    if (last && last.house_name === currentHotel) {
      last.occupant_names.push(occ);
      last.number_of_persons = last.occupant_names.length;
      const guess = guessCapacityFromStructure(last.room_structure);
      last.capacity = Math.max(last.capacity || 1, guess ?? last.number_of_persons);
      return true;
    }
  }
  return true;
}

function stripPhoneFromNotesText(notes, phone) {
  if (!notes?.trim() || !phone?.trim()) return (notes || '').trim();
  let n = notes.trim();
  const p = phone.trim();
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  n = n.replace(new RegExp(esc, 'gi'), ' ');
  n = n.replace(/\d{2,3}\s*\/\s*\d{6,}/g, (m) => {
    const norm = (s) => s.replace(/\D/g, '');
    return norm(m) === norm(p) ? ' ' : m;
  });
  return n.replace(/\s{2,}/g, ' ').replace(/^[,/|•\-\s]+|[,/|•\-\s]+$/g, '').trim();
}

function entryFromBuffer(buf, currentHotel, stayFrom, stayTo, defaultLocation) {
  const cap = guessCapacityFromStructure(buf.structure) ?? Math.max(buf.occupants.length, 1);
  const rawNotes = [buf.agency].filter(Boolean).join(' ').trim();
  return {
    house_name: currentHotel,
    room_number: buf.roomNumber,
    room_structure: buf.structure,
    stay_from: stayFrom,
    stay_to: stayTo,
    occupant_names: [...buf.occupants],
    number_of_persons: buf.occupants.length,
    capacity: cap,
    notes: stripPhoneFromNotesText(rawNotes, buf.phone),
    contact_phone: buf.phone || '',
    contract_number: buf.contract_number || '',
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
        contract_number: primary.contract_number || '',
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
    } else if (isContinuationLine(line) && !buf && entries.length > 0) {
      const last = entries[entries.length - 1];
      if (last && last.house_name === currentHotel) {
        const cm = line.match(CONTINUATION);
        const sex = cm[1].toUpperCase();
        let namePart = cleanGuestName(cm[2]);
        namePart = namePart.replace(/\s+(?:BUS\s+PAK|AUTOBUS)\s*$/i, '').trim();
        if (SKIP_NAME.test(namePart) || SKIP_NAME.test(namePart.split(/\s+/)[0] || '')) continue;
        last.occupant_names.push(formatOccupant(sex, namePart));
        last.number_of_persons = last.occupant_names.length;
        const guess = guessCapacityFromStructure(last.room_structure);
        last.capacity = Math.max(last.capacity || 1, guess ?? last.occupant_names.length);
      }
    } else if (tryAppendStandaloneInfant(line, buf, entries, currentHotel)) {
      continue;
    }
  }

  flush();

  const mergedEntries = mergeAdjacentSameRoom(entries);

  const roomCountByHotel = new Map();
  for (const e of mergedEntries) {
    roomCountByHotel.set(e.house_name, (roomCountByHotel.get(e.house_name) || 0) + 1);
  }
  const hotels = [...hotelsSeen].filter(isValidHotelName);
  const hotelsMissingRooms = hotels.filter((h) => !roomCountByHotel.get(h));

  return { entries: mergedEntries, hotels, hotelsMissingRooms };
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
  if (/\bROOMING\s+LIST\b/i.test(t) && /\b(?:Hotel|House)\s*:/i.test(t)) return true;
  if (
    /(?:^|\n)\s*(?:Hotel|House)\s*\.{0,3}\s*:?\s*\S/im.test(t) &&
    /\bARR:\s*\d{1,2}\.\d{1,2}\.\d{4}/i.test(t)
  ) {
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
