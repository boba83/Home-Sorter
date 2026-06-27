/** Prirodno sortiranje brojeva soba: 1, 2, 3, 10, 101 (ne 1, 101, 2). */
export function compareRoomNumbers(a, b) {
  const sa = String(a ?? '').trim();
  const sb = String(b ?? '').trim();
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRoomsByNumber(rooms) {
  if (!Array.isArray(rooms)) return [];
  return [...rooms].sort((x, y) => compareRoomNumbers(x?.room_number, y?.room_number));
}
