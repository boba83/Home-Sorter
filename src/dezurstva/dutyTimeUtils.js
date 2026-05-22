/** Uobičajeni blokovi (jutro / siesta / veče). Slobodno dodaj bilo koji interval u dijalogu. */
export const PRESET_BLOCKS = [
  {
    id: 'morning',
    tabTitle: 'Jutarnji deo',
    rangeLabel: '9–14',
    start_time: '09:00',
    end_time: '14:00',
    tabTone: 'blue',
  },
  {
    id: 'siesta',
    tabTitle: 'Siesta',
    rangeLabel: '14–18',
    start_time: '14:00',
    end_time: '18:00',
    tabTone: 'red',
  },
  {
    id: 'evening',
    tabTitle: 'Večernji deo',
    rangeLabel: '18–22',
    start_time: '18:00',
    end_time: '22:00',
    tabTone: 'green',
  },
];

export const PRESET_TAB_CLASSES = {
  blue: 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700 hover:text-white',
  red: 'bg-red-600 text-white border-red-700 hover:bg-red-700 hover:text-white',
  green: 'bg-green-600 text-white border-green-700 hover:bg-green-700 hover:text-white',
};

/** Tri panela dana (vizuelno ograničeni delovi) — usklađeno sa PRESET_BLOCKS. */
export const DAY_PART_PANELS = [
  {
    id: 'morning',
    title: 'Jutarnji deo',
    timeRange: '9:00 – 14:00',
    windowStart: '09:00',
    windowEnd: '14:00',
    shellClass: 'bg-sky-50/95 border-2 border-blue-300/90 shadow-sm',
    barClass: 'bg-blue-600',
  },
  {
    id: 'siesta',
    title: 'Siesta',
    timeRange: '14:00 – 18:00',
    windowStart: '14:00',
    windowEnd: '18:00',
    shellClass: 'bg-rose-50/95 border-2 border-rose-300/90 shadow-sm',
    barClass: 'bg-rose-600',
  },
  {
    id: 'evening',
    title: 'Večernji deo',
    timeRange: '18:00 – 22:00',
    windowStart: '18:00',
    windowEnd: '22:00',
    shellClass: 'bg-emerald-50/95 border-2 border-emerald-300/90 shadow-sm',
    barClass: 'bg-emerald-600',
  },
];

export function normalizeHm(s) {
  const m = String(s ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  let min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return '';
  h = Math.min(23, Math.max(0, h));
  min = Math.min(59, Math.max(0, min));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function hmToMinutes(hm) {
  const x = normalizeHm(hm);
  if (!x) return null;
  const [h, min] = x.split(':').map(Number);
  return h * 60 + min;
}

export function minutesToHm(total) {
  const m = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function addHoursToHm(startHm, hours) {
  const start = hmToMinutes(startHm);
  if (start === null) return '';
  return minutesToHm(start + Math.round(Number(hours) * 60));
}

/** U koji deo dana pada smena (prema početku). */
export function segmentIdForShiftStart(startTime) {
  const m = hmToMinutes(startTime);
  if (m === null) return 'morning';
  if (m < 14 * 60) return 'morning';
  if (m < 18 * 60) return 'siesta';
  return 'evening';
}

/** Traka trajanja unutar jednog dela dana (npr. samo 9–14). */
export function shiftBarInWindow(startTime, endTime, windowStartHm, windowEndHm) {
  const ws = hmToMinutes(windowStartHm);
  const we = hmToMinutes(windowEndHm);
  const start = hmToMinutes(startTime);
  const end = hmToMinutes(endTime);
  if ([ws, we, start, end].some((x) => x === null) || end <= start || we <= ws) {
    return { left: '0%', width: '0%' };
  }
  const span = we - ws;
  const clampedStart = Math.max(ws, Math.min(we, start));
  const clampedEnd = Math.max(ws, Math.min(we, end));
  const left = ((clampedStart - ws) / span) * 100;
  const width = Math.max(1.2, ((clampedEnd - clampedStart) / span) * 100);
  return { left: `${left}%`, width: `${width}%` };
}

/** Pozicija na traci 9:00–22:00 za prikaz (sitan %). */
export function shiftBarStyle(startTime, endTime) {
  const start = hmToMinutes(startTime);
  const end = hmToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return { left: '0%', width: '0%' };
  }
  const windowStart = 9 * 60;
  const windowEnd = 22 * 60;
  const span = windowEnd - windowStart;
  const clampedStart = Math.max(windowStart, Math.min(windowEnd, start));
  const clampedEnd = Math.max(windowStart, Math.min(windowEnd, end));
  const left = ((clampedStart - windowStart) / span) * 100;
  const width = Math.max(0.8, ((clampedEnd - clampedStart) / span) * 100);
  return { left: `${left}%`, width: `${width}%` };
}
