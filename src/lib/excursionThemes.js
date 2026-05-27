export const EXCURSION_THEME_STYLES = {
  cyan: {
    color: 'from-cyan-400 to-blue-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    label: 'Cijan',
  },
  blue: {
    color: 'from-blue-400 to-indigo-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    label: 'Plava',
  },
  violet: {
    color: 'from-violet-400 to-purple-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    label: 'Ljubičasta',
  },
  orange: {
    color: 'from-orange-400 to-rose-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    label: 'Narandžasta',
  },
  emerald: {
    color: 'from-emerald-400 to-teal-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    label: 'Zelena',
  },
  rose: {
    color: 'from-rose-400 to-pink-500',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    label: 'Roze',
  },
  amber: {
    color: 'from-amber-400 to-yellow-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    label: 'Žuta',
  },
  slate: {
    color: 'from-slate-400 to-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    label: 'Siva',
  },
};

export function withExcursionStyles(excursion) {
  const styles = EXCURSION_THEME_STYLES[excursion.theme] || EXCURSION_THEME_STYLES.cyan;
  return { ...excursion, ...styles };
}

/** Vrednosti ikone usklađene sa serverom (`normalizeExcursionIcon`). */
export const EXCURSION_ICON_KEYS = ['boat', 'bus', 'minibus'];
