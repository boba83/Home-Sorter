/** Dozvoljene boje fascikli (hex). */
export const INFO_FOLDER_COLORS = [
  '#f97316',
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#ef4444',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#64748b',
];

const ALLOWED = new Set(INFO_FOLDER_COLORS);

export function normalizeInfoFolderColor(value) {
  if (value == null || value === '' || value === 'default' || value === 'none') {
    return null;
  }
  const hex = String(value).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return null;
  return ALLOWED.has(hex) ? hex : null;
}
