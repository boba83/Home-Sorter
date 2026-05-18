/**
 * Parsiranje ASTRA / sličnih rooming list PDF-ova:
 * Hotel: …  ARR: dd.mm.yyyy  DEP: dd.mm.yyyy
 * Glavni red gosta: No Sex Ime … Voucher Service Room Struktura … telefon
 * Nastavni redovi: isti broj sobe dok ne dođe novi glavni red.
 */

const SEX_ALT = 'MR|MRS|CHD|INF|MS|MISS|DR';
/** Voucher: npr. 279846/25 */
const PRIMARY = new RegExp(
  `^\\s*\\d+\\s+(${SEX_ALT})\\s+(.+?)\\s+(\\d{5,}/\\d{2})\\s+(\\S+)\\s+(\\d{1,4})\\s+(.+)$`,
  'i'
);
const CONT = new RegExp(`^\\s*\\d+\\s+(${SEX_ALT})\\s+(.+)$`, 'i');
const PHONE_TAIL = /(\d{2,3}\/\d{6,})\s*$/;
const SKIP_NAME = /^(?:---+|X{3,})/i;

function guessCapacityFromStructure(structure) {
  if (!structure) return null;
  const s = structure.toUpperCase();
  const plus = s.match(/1\/(\d+)\s*\+\s*(\d+)/);
  if (plus) return Math.max(1, parseInt(plus[1], 10) + parseInt(plus[2], 10));
  const m = s.match(/1\/(\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return null;
}

function splitStructureAgencyBus(rest) {
  let bus_info = '';
  let t = rest.trim();
  if (/\bBUS\s+PAK\b/i.test(t)) {
    bus_info = 'BUS PAK';
    t = t.replace(/\s*BUS\s+PAK\s*/gi, ' ').trim();
  }

  /** Agencija: poslednji segment je JednaReč + TRAVEL (+ opciono D.O.O.) */
  const travelTail = t.match(/\s+[A-Za-zŠĐČĆŽšđčćž]+\s+TRAVEL(?:\s+D\.O\.O\.)?$/i);
  if (travelTail && travelTail.index > 0) {
    return {
      structure: t.slice(0, travelTail.index).trim(),
      agency: t.slice(travelTail.index).trim(),
      bus_info,
    };
  }

  const chunks = t.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length >= 2) {
    const last = chunks[chunks.length - 1];
    if (
      last.length > 6 &&
      /\b(TRAVEL|TURS|D\.O\.O\.|PARADISO|HOLIDAY|CLUB|START|ROMANOV|DOMINO|GLOBO|ECO|ANDRIJATIC|SUBAGENT)\b/i.test(
        last
      )
    ) {
      return {
        structure: chunks.slice(0, -1).join(' '),
        agency: last,
        bus_info,
      };
    }
  }
  return { structure: chunks.join(' ').replace(/\s+/g, ' ').trim(), agency: '', bus_info };
}

function extractPhoneAndRest(tail) {
  const m = tail.trim().match(PHONE_TAIL);
  if (!m) return { phone: '', rest: tail.trim() };
  return { phone: m[1], rest: tail.slice(0, m.index).trim() };
}

function formatOccupant(sex, namePart) {
  const n = namePart.replace(/\s+/g, ' ').trim();
  return `${sex.toUpperCase()} ${n}`.trim();
}

/**
 * @param {string[]} lines — već trimovane neprazne linije
 * @param {string|null} defaultLocation — iz teksta (npr. SARTI)
 * @returns {Array<object>}
 */
export function parseAstraRoomingListLines(lines, defaultLocation) {
  const entries = [];
  let currentHotel = '';
  let stayFrom = '';
  let stayTo = '';
  /** @type {{ roomNumber: string, structure: string, occupants: string[], phone: string, agency: string, bus_info: string } | null} */
  let buf = null;

  const flush = () => {
    if (!buf || buf.occupants.length === 0) return;
    const cap =
      guessCapacityFromStructure(buf.structure) ?? Math.max(buf.occupants.length, 1);
    const notes = [buf.agency].filter(Boolean).join(' ').trim();
    entries.push({
      house_name: currentHotel,
      room_number: buf.roomNumber,
      room_structure: buf.structure,
      stay_from: stayFrom,
      stay_to: stayTo,
      occupant_names: [...buf.occupants],
      number_of_persons: buf.occupants.length,
      capacity: cap,
      notes,
      contact_phone: buf.phone || '',
      bus_info: buf.bus_info || '',
    });
    buf = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\u00A0/g, ' ').trim();
    if (line.length < 4) continue;
    if (/^STRANA:|ROOMING\s+LIST|^PTA\d/i.test(line)) continue;
    if (/^DATUM\s|^VREME\s|^No\s+Sex/i.test(line)) continue;
    if (/^─+$/.test(line)) continue;

    if (/^TOTAL-/i.test(line)) {
      flush();
      continue;
    }

    const hm = line.match(/^Hotel:\s*(.+)$/i);
    if (hm) {
      flush();
      currentHotel = hm[1].replace(/\s+/g, ' ').trim();
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

    if (!currentHotel) continue;

    const pm = line.match(PRIMARY);
    if (pm) {
      flush();
      const sex = pm[1].toUpperCase();
      const namePart = pm[2].replace(/\s+/g, ' ').trim().replace(/\s+\d{1,2}\s*DA\s*$/i, '').trim();
      if (SKIP_NAME.test(namePart.split(/\s+/)[0] || '') || SKIP_NAME.test(namePart)) continue;
      const roomNo = pm[5];
      const tail = pm[6];
      const { phone, rest } = extractPhoneAndRest(tail);
      const { structure, agency, bus_info } = splitStructureAgencyBus(rest);
      buf = {
        roomNumber: String(roomNo),
        structure,
        occupants: [formatOccupant(sex, namePart)],
        phone,
        agency,
        bus_info,
      };
      continue;
    }

    const cm = line.match(CONT);
    if (cm && buf) {
      const sex = cm[1].toUpperCase();
      let namePart = cm[2].replace(/\s+/g, ' ').trim();
      namePart = namePart.replace(/\s+BUS\s+PAK\s*$/i, '').trim();
      namePart = namePart.replace(/\s+\d{1,2}\s*DA\s*$/i, '').trim();
      if (SKIP_NAME.test(namePart.split(/\s+/)[0] || '') || SKIP_NAME.test(namePart)) continue;
      if (PRIMARY.test(line)) continue;
      buf.occupants.push(formatOccupant(sex, namePart));
    }
  }
  flush();
  return entries;
}

export function looksLikeAstraRoomingList(text) {
  return /\bHotel:\s*\S/i.test(text) && /\bARR:\s*\d{1,2}\.\d{1,2}\.\d{4}/i.test(text);
}
