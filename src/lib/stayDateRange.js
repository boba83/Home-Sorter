/** Parsira dd.MM.yyyy ili yyyy-MM-dd u Date (lokalno, ponoć). */
export function parseStayDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (s.includes('.')) {
    const parts = s.split('.').filter(Boolean);
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      const dt = new Date(y, m - 1, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Da li se boravak sobe preklapa sa traženim intervalom (uključivo). */
export function stayPeriodsOverlap(roomFrom, roomTo, periodFrom, periodTo) {
  const r0 = parseStayDate(roomFrom);
  const r1 = parseStayDate(roomTo);
  const p0 = parseStayDate(periodFrom);
  const p1 = parseStayDate(periodTo);
  if (!r0 || !r1 || !p0 || !p1) return false;
  const rs = r0.getTime();
  const re = r1.getTime();
  let ps = p0.getTime();
  let pe = p1.getTime();
  if (ps > pe) [ps, pe] = [pe, ps];
  if (rs > re || ps > pe) return false;
  return rs <= pe && re >= ps;
}

export function roomMatchesStayPeriod(room, periodFrom, periodTo) {
  if (!periodFrom || !periodTo) return true;
  return stayPeriodsOverlap(room?.stay_from, room?.stay_to, periodFrom, periodTo);
}

/**
 * Pretraga „smene“ [periodFrom, periodTo]: sobe koje uopšte ulaze u smenu i čiji boravak
 * ne traje posle kraja smene (boravakDo ≤ periodTo), uključujući one koje počnu posle
 * početka smene (npr. 05.06–12.06). Ne ulaze sobe koje se završavaju 15.06, 17.06, itd.
 * Potrebni su oba datuma boravka na sobi.
 */
export function roomMatchesStayShiftPeriod(room, periodFrom, periodTo) {
  if (!periodFrom || !periodTo) return true;
  const r0 = parseStayDate(room?.stay_from);
  const r1 = parseStayDate(room?.stay_to);
  const p0 = parseStayDate(periodFrom);
  const p1 = parseStayDate(periodTo);
  if (!r0 || !r1 || !p0 || !p1) return false;
  const rs = r0.getTime();
  const re = r1.getTime();
  let ps = p0.getTime();
  let pe = p1.getTime();
  if (ps > pe) [ps, pe] = [pe, ps];
  if (rs > re) return false;
  return rs <= pe && re >= ps && re <= pe;
}

export function formatStayDateDisplay(value) {
  if (!value) return '';
  const d = parseStayDate(value);
  if (!d) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

export function escapeXmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
