export const INFO_FOLDER_COLORS = [
  { hex: '#f97316', label: 'Narandžasta' },
  { hex: '#3b82f6', label: 'Plava' },
  { hex: '#22c55e', label: 'Zelena' },
  { hex: '#a855f7', label: 'Ljubičasta' },
  { hex: '#ef4444', label: 'Crvena' },
  { hex: '#14b8a6', label: 'Tirkizna' },
  { hex: '#f59e0b', label: 'Žuta' },
  { hex: '#ec4899', label: 'Roze' },
  { hex: '#64748b', label: 'Siva' },
];

export const DEFAULT_FOLDER_COLOR = '#f97316';

export function resolveFolderColor(color) {
  const hex = color || DEFAULT_FOLDER_COLOR;
  return INFO_FOLDER_COLORS.some((c) => c.hex === hex) ? hex : DEFAULT_FOLDER_COLOR;
}

export function folderTint(hex, alpha = 0.12) {
  const c = resolveFolderColor(hex);
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
