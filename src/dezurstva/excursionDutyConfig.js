/** Tri linije dežurstva za izdavanje soba; više smena po liniji, vreme 09:00–15:00. */

export const ROOM_DUTY_WINDOW = {
  windowStart: '09:00',
  windowEnd: '15:00',
  timeRange: '9:00 – 15:00',
};

/** Brzi intervali (isti stil dugmadi kao „Jutarnji deo“ u glavnom dijalogu). */
export const ROOM_DUTY_PRESETS = [
  { id: '9-12', tabTitle: 'Prepodne', rangeLabel: '9–12', start_time: '09:00', end_time: '12:00', tabTone: 'blue' },
  { id: '12-15', tabTitle: 'Poslepodne', rangeLabel: '12–15', start_time: '12:00', end_time: '15:00', tabTone: 'red' },
  { id: '9-15', tabTitle: 'Ceo interval', rangeLabel: '9–15', start_time: '09:00', end_time: '15:00', tabTone: 'green' },
  { id: '9-11', tabTitle: '9–11', rangeLabel: '2h', start_time: '09:00', end_time: '11:00', tabTone: 'blue' },
  { id: '11-13', tabTitle: '11–13', rangeLabel: '2h', start_time: '11:00', end_time: '13:00', tabTone: 'red' },
  { id: '13-15', tabTitle: '13–15', rangeLabel: '2h', start_time: '13:00', end_time: '15:00', tabTone: 'green' },
];

export const EXCURSION_DUTY_SLOTS = [
  {
    key: 'aristotelis',
    label: 'Aristotelis',
    tabClass: 'data-[state=active]:bg-sky-100 data-[state=active]:text-sky-900 data-[state=active]:border-sky-300',
    panelClass: 'bg-sky-50/95 border-2 border-blue-300/90 shadow-sm',
    barClass: 'bg-blue-600',
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
