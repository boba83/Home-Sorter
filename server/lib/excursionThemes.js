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

export const EXCURSION_ICONS = ['boat', 'bus'];

export function normalizeExcursionIcon(icon) {
  return icon === 'bus' ? 'bus' : 'boat';
}
