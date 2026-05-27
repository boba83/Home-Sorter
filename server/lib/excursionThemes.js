export const EXCURSION_THEMES = [
  'cyan',
  'blue',
  'violet',
  'orange',
  'emerald',
  'rose',
  'amber',
  'slate',
];

export function normalizeExcursionTheme(theme) {
  return EXCURSION_THEMES.includes(theme) ? theme : 'cyan';
}

export const EXCURSION_ICONS = ['boat', 'bus', 'minibus'];

export function normalizeExcursionIcon(icon) {
  const k = String(icon || '')
    .toLowerCase()
    .trim()
    .replace(/_/g, '-');
  if (k === 'bus') return 'bus';
  if (k === 'minibus' || k === 'mini-bus' || k === 'combi' || k === 'van') return 'minibus';
  return 'boat';
}
