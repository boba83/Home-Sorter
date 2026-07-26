/** Linije dežurstva za izdavanje soba; više smena po liniji, vreme 09:00–17:00. */

export const ROOM_DUTY_WINDOW = {
  windowStart: '09:00',
  windowEnd: '17:00',
  timeRange: '9:00 – 17:00',
};

/** Brzi intervali (isti stil dugmadi kao „Jutarnji deo“ u glavnom dijalogu). */
export const ROOM_DUTY_PRESETS = [
  { id: '9-12', tabTitle: 'Prepodne', rangeLabel: '9–12', start_time: '09:00', end_time: '12:00', tabTone: 'blue' },
  { id: '12-15', tabTitle: 'Poslepodne', rangeLabel: '12–15', start_time: '12:00', end_time: '15:00', tabTone: 'red' },
  { id: '15-17', tabTitle: 'Kasnije', rangeLabel: '15–17', start_time: '15:00', end_time: '17:00', tabTone: 'orange' },
  { id: '9-17', tabTitle: 'Ceo interval', rangeLabel: '9–17', start_time: '09:00', end_time: '17:00', tabTone: 'green' },
  { id: '9-11', tabTitle: '9–11', rangeLabel: '2h', start_time: '09:00', end_time: '11:00', tabTone: 'blue' },
  { id: '11-13', tabTitle: '11–13', rangeLabel: '2h', start_time: '11:00', end_time: '13:00', tabTone: 'red' },
  { id: '13-15', tabTitle: '13–15', rangeLabel: '2h', start_time: '13:00', end_time: '15:00', tabTone: 'green' },
  { id: '13-17', tabTitle: '13–17', rangeLabel: '4h', start_time: '13:00', end_time: '17:00', tabTone: 'orange' },
];

/**
 * Prva linija: Aristotelis ili Panorama Beach (umesto nje).
 * Ostale: Sartios, Ostraco.
 */
export const EXCURSION_DUTY_SLOTS = [
  {
    key: 'aristotelis',
    label: 'Aristotelis',
    tabClass: 'data-[state=active]:bg-sky-100 data-[state=active]:text-sky-900 data-[state=active]:border-sky-300',
    panelClass: 'bg-sky-50/95 border-2 border-blue-300/90 shadow-sm',
    barClass: 'bg-blue-600',
    /** Alternativne kuće za ovu liniju (isti tab, izbor kuće). */
    houseOptions: [
      { key: 'aristotelis', label: 'Aristotelis' },
      { key: 'panorama-beach', label: 'Panorama Beach' },
    ],
  },
  {
    key: 'sartios',
    label: 'Sartios',
    tabClass: 'data-[state=active]:bg-rose-100 data-[state=active]:text-rose-900 data-[state=active]:border-rose-300',
    panelClass: 'bg-rose-50/95 border-2 border-rose-300/90 shadow-sm',
    barClass: 'bg-rose-600',
  },
  {
    key: 'ostraco',
    label: 'Ostraco',
    tabClass: 'data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-900 data-[state=active]:border-emerald-300',
    panelClass: 'bg-emerald-50/95 border-2 border-emerald-300/90 shadow-sm',
    barClass: 'bg-emerald-600',
  },
];

export function roomDutySlotLabel(slotKey) {
  const key = String(slotKey || '').toLowerCase();
  for (const s of EXCURSION_DUTY_SLOTS) {
    if (s.key === key) return s.label;
    if (s.houseOptions) {
      const opt = s.houseOptions.find((o) => o.key === key);
      if (opt) return opt.label;
    }
  }
  return slotKey;
}

export function roomDutyTabForSlotKey(slotKey) {
  const key = String(slotKey || '').toLowerCase();
  for (const s of EXCURSION_DUTY_SLOTS) {
    if (s.key === key) return s.key;
    if (s.houseOptions?.some((o) => o.key === key)) return s.key;
  }
  return key;
}
