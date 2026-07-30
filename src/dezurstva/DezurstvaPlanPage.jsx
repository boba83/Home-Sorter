import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { CalendarClock, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl, userDisplayName } from '@/utils';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EXCURSION_DUTY_SLOTS, ROOM_DUTY_PRESETS, ROOM_DUTY_WINDOW, roomDutySlotLabel } from '@/dezurstva/excursionDutyConfig';
import {
  PRESET_BLOCKS,
  PRESET_TAB_CLASSES,
  DAY_PART_PANELS,
  normalizeHm,
  addHoursToHm,
  segmentIdForShiftStart,
  shiftBarInWindow,
  hmToMinutes,
} from '@/dezurstva/dutyTimeUtils';

const WEEKDAYS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const ROOM_DUTY_END_MAX_M = 17 * 60;
const ROOM_DUTY_START_MIN_M = 9 * 60;

function clampHmToRoomDutyWindow(hm) {
  const n = hmToMinutes(normalizeHm(hm));
  if (n == null) return normalizeHm(hm);
  if (n < ROOM_DUTY_START_MIN_M) return '09:00';
  return n > ROOM_DUTY_END_MAX_M ? '17:00' : normalizeHm(hm);
}

function buildMonthGrid(monthAnchor) {
  const start = startOfMonth(monthAnchor);
  const end = endOfMonth(monthAnchor);
  const days = eachDayOfInterval({ start, end });
  const startWeekday = (start.getDay() + 6) % 7;
  const cells = [...Array(startWeekday).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return { rows, monthLabel: format(monthAnchor, 'LLLL yyyy') };
}

export default function DezurstvaPlanPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isViewer = String(user?.role || '').toLowerCase() === 'viewer';

  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const range = useMemo(() => {
    const start = startOfMonth(monthAnchor);
    const end = endOfMonth(monthAnchor);
    return {
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd'),
    };
  }, [monthAnchor]);

  const selectedDayStr = format(selectedDay, 'yyyy-MM-dd');

  useEffect(() => {
    if (!isSameMonth(selectedDay, monthAnchor)) {
      setSelectedDay(startOfMonth(monthAnchor));
    }
  }, [monthAnchor, selectedDay]);

  const { rows, monthLabel } = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['duty-shifts', range.from, range.to],
    queryFn: () => api.dutyShifts.list({ from: range.from, to: range.to }),
  });

  const { data: eligibleUsers = [], isLoading: eligibleLoading } = useQuery({
    queryKey: ['duty-eligible-users'],
    queryFn: () => api.dutyShifts.eligibleUsers(),
  });

  const countsByDate = useMemo(() => {
    const m = new Map();
    for (const s of shifts) {
      m.set(s.date, (m.get(s.date) || 0) + 1);
    }
    return m;
  }, [shifts]);

  const dayShifts = useMemo(
    () => shifts.filter((s) => s.date === selectedDayStr).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [shifts, selectedDayStr],
  );

  const shiftsBySegment = useMemo(() => {
    const g = { morning: [], siesta: [], evening: [] };
    for (const s of dayShifts) {
      const seg = segmentIdForShiftStart(s.start_time);
      g[seg].push(s);
    }
    return g;
  }, [dayShifts]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formUserId, setFormUserId] = useState('');
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('14:00');
  const [formNote, setFormNote] = useState('');

  const [roomDutyDialogOpen, setRoomDutyDialogOpen] = useState(false);
  const [roomDutyEditingId, setRoomDutyEditingId] = useState(null);
  const [roomDutySlotKey, setRoomDutySlotKey] = useState('aristotelis');
  const [roomFormUserId, setRoomFormUserId] = useState('');
  const [roomFormStart, setRoomFormStart] = useState('09:00');
  const [roomFormEnd, setRoomFormEnd] = useState('12:00');
  const [roomFormNote, setRoomFormNote] = useState('');

  useEffect(() => {
    if (!roomDutyDialogOpen || roomDutyEditingId) return;
    if (!roomFormUserId && eligibleUsers[0]?.id) setRoomFormUserId(eligibleUsers[0].id);
  }, [roomDutyDialogOpen, roomDutyEditingId, roomFormUserId, eligibleUsers]);

  useEffect(() => {
    if (!dialogOpen || editingId) return;
    if (!formUserId && eligibleUsers[0]?.id) setFormUserId(eligibleUsers[0].id);
  }, [dialogOpen, editingId, formUserId, eligibleUsers]);

  const openNewDialog = () => {
    setEditingId(null);
    setFormUserId(eligibleUsers[0]?.id || '');
    setFormStart('09:00');
    setFormEnd('14:00');
    setFormNote('');
    setDialogOpen(true);
  };

  const openEditDialog = (s) => {
    setEditingId(s.id);
    setFormUserId(s.user_id);
    setFormStart(s.start_time);
    setFormEnd(s.end_time);
    setFormNote(s.note || '');
    setDialogOpen(true);
  };

  const invalidateDuty = () => {
    queryClient.invalidateQueries({ queryKey: ['duty-shifts'] });
    queryClient.invalidateQueries({ queryKey: ['duty-eligible-users'] });
  };

  const createMut = useMutation({
    mutationFn: (body) => api.dutyShifts.create(body),
    onSuccess: () => {
      invalidateDuty();
      toast({ title: 'Sačuvano', description: 'Dežurstvo je dodato.' });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => api.dutyShifts.update(id, body),
    onSuccess: () => {
      invalidateDuty();
      toast({ title: 'Sačuvano', description: 'Izmena je sačuvana.' });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.dutyShifts.delete(id),
    onSuccess: () => {
      invalidateDuty();
      toast({ title: 'Obrisano' });
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const { data: roomDutyResp, isLoading: roomDutyLoading } = useQuery({
    queryKey: ['excursion-duties', selectedDayStr],
    queryFn: () => api.excursionDuties.getByDate(selectedDayStr),
  });
  const roomDutyShifts = roomDutyResp?.shifts ?? [];

  const roomDutiesBySlot = useMemo(() => {
    const m = Object.fromEntries(EXCURSION_DUTY_SLOTS.map((s) => [s.key, []]));
    for (const s of roomDutyShifts) {
      const key = String(s.slot_key || '').toLowerCase();
      if (!m[key]) m[key] = [];
      m[key].push(s);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
    }
    return m;
  }, [roomDutyShifts]);

  const invalidateRoomDuties = () => {
    queryClient.invalidateQueries({ queryKey: ['excursion-duties', selectedDayStr] });
  };

  const roomDutyCreateMut = useMutation({
    mutationFn: (body) => api.excursionDuties.create(body),
    onSuccess: () => {
      invalidateRoomDuties();
      toast({ title: 'Sačuvano', description: 'Smena za sobe je dodata.' });
      setRoomDutyDialogOpen(false);
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const roomDutyUpdateMut = useMutation({
    mutationFn: ({ id, body }) => api.excursionDuties.update(id, body),
    onSuccess: () => {
      invalidateRoomDuties();
      toast({ title: 'Sačuvano', description: 'Smena za sobe je ažurirana.' });
      setRoomDutyDialogOpen(false);
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const roomDutyDeleteMut = useMutation({
    mutationFn: (id) => api.excursionDuties.delete(id),
    onSuccess: () => {
      invalidateRoomDuties();
      toast({ title: 'Obrisano' });
    },
    onError: (e) => toast({ title: 'Greška', description: e.message, variant: 'destructive' }),
  });

  const handleSubmitDialog = () => {
    const start_time = normalizeHm(formStart);
    const end_time = normalizeHm(formEnd);
    if (!start_time || !end_time) {
      toast({ title: 'Proverite vreme', description: 'Format HH:mm (npr. 09:00).', variant: 'destructive' });
      return;
    }
    if (!formUserId) {
      toast({ title: 'Izaberite korisnika', variant: 'destructive' });
      return;
    }
    const payload = {
      date: selectedDayStr,
      start_time,
      end_time,
      user_id: formUserId,
      note: formNote.trim() || undefined,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, body: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const openRoomDutyNew = (slotKey) => {
    setRoomDutyEditingId(null);
    setRoomDutySlotKey(slotKey);
    setRoomFormUserId(eligibleUsers[0]?.id || '');
    setRoomFormStart('09:00');
    setRoomFormEnd('12:00');
    setRoomFormNote('');
    setRoomDutyDialogOpen(true);
  };

  const openRoomDutyEdit = (s) => {
    setRoomDutyEditingId(s.id);
    setRoomDutySlotKey(s.slot_key);
    setRoomFormUserId(s.user_id);
    setRoomFormStart(s.start_time);
    setRoomFormEnd(s.end_time);
    setRoomFormNote(s.note || '');
    setRoomDutyDialogOpen(true);
  };

  const applyRoomPreset = (p) => {
    setRoomFormStart(p.start_time);
    setRoomFormEnd(p.end_time);
  };

  const applyRoomDurationHours = (h) => {
    const end = addHoursToHm(roomFormStart, h);
    if (end) setRoomFormEnd(clampHmToRoomDutyWindow(end));
  };

  const handleRoomDutySubmit = () => {
    const start_time = normalizeHm(roomFormStart);
    const end_time = normalizeHm(roomFormEnd);
    if (!start_time || !end_time) {
      toast({ title: 'Proverite vreme', description: 'Format HH:mm (npr. 09:00).', variant: 'destructive' });
      return;
    }
    if (!roomFormUserId) {
      toast({ title: 'Izaberite korisnika', variant: 'destructive' });
      return;
    }
    const sm = hmToMinutes(start_time);
    const em = hmToMinutes(end_time);
    if (
      sm == null ||
      em == null ||
      sm < ROOM_DUTY_START_MIN_M ||
      em > ROOM_DUTY_END_MAX_M ||
      em <= sm
    ) {
      toast({
        title: 'Interval 9:00–17:00',
        description: 'Početak i kraj moraju biti između 09:00 i 17:00, kraj posle početka.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      date: selectedDayStr,
      slot_key: roomDutySlotKey,
      start_time,
      end_time,
      user_id: roomFormUserId,
      note: roomFormNote.trim() || undefined,
    };
    if (roomDutyEditingId) {
      roomDutyUpdateMut.mutate({ id: roomDutyEditingId, body: payload });
    } else {
      roomDutyCreateMut.mutate(payload);
    }
  };

  const applyPreset = (p) => {
    setFormStart(p.start_time);
    setFormEnd(p.end_time);
  };

  const applyDurationHours = (h) => {
    const end = addHoursToHm(formStart, h);
    if (end) setFormEnd(end);
  };

  const busy = createMut.isPending || updateMut.isPending;
  const roomDutyBusy = roomDutyCreateMut.isPending || roomDutyUpdateMut.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              to={createPageUrl('Landing')}
              className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800 mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Nazad
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-7 h-7 text-indigo-600" />
              Plan dežurstva
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Korisnici iz dodela kućama. Brzi delovi dana: <strong className="text-blue-700">Jutarnji deo</strong> (9–14),{' '}
              <strong className="text-red-700">Siesta</strong> (14–18), <strong className="text-green-700">Večernji deo</strong>{' '}
              (18–22). Ostale intervale unosite ručno ili preko „+1h“ itd.
            </p>
          </div>
          {!isViewer && eligibleUsers.length > 0 && (
            <Button onClick={openNewDialog} className="shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Dodaj za {format(selectedDay, 'd.MM.yyyy.')}
            </Button>
          )}
        </div>

        {!eligibleLoading && eligibleUsers.length === 0 && (
          <Card className="border-amber-200 bg-amber-50/80">
            <CardContent className="py-4 text-sm text-amber-900">
              Nema korisnika u dodelama kućama (ili ste u ulozi bez pristupa). Dodelite korisnike kućama u{' '}
              <Link to={createPageUrl('UserManagement')} className="underline font-medium">
                User Management
              </Link>
              .
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:gap-6 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-4 flex flex-col gap-4 self-start">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 pt-3">
                <CardTitle className="text-sm font-semibold capitalize sm:text-base">{monthLabel}</CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={() => setMonthAnchor((d) => subMonths(d, 1))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const n = new Date();
                      setMonthAnchor(n);
                      setSelectedDay(n);
                    }}
                  >
                    Danas
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setMonthAnchor((d) => addMonths(d, 1))}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-0">
                <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-slate-500 mb-1 sm:text-xs">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-0.5 truncate">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {rows.flatMap((week, wi) =>
                    week.map((day, di) => {
                      const key = day ? format(day, 'yyyy-MM-dd') : `e-${wi}-${di}`;
                      if (!day) {
                        return <div key={key} className="aspect-square max-h-8 rounded-md bg-transparent sm:max-h-9" />;
                      }
                      const inMonth = format(day, 'yyyy-MM') === format(monthAnchor, 'yyyy-MM');
                      const selected = isSameDay(day, selectedDay);
                      const n = countsByDate.get(format(day, 'yyyy-MM-dd')) || 0;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={[
                            'aspect-square max-h-8 min-h-0 w-full rounded-md border text-[11px] font-medium transition-colors relative flex flex-col items-center justify-center sm:max-h-9 sm:text-xs',
                            inMonth ? 'border-slate-200 bg-white hover:bg-slate-50' : 'opacity-40',
                            selected ? 'ring-2 ring-indigo-500 border-indigo-300 bg-indigo-50' : '',
                            isToday(day) ? 'text-indigo-700 font-bold' : 'text-slate-800',
                          ].join(' ')}
                        >
                          <span>{format(day, 'd')}</span>
                          {n > 0 && (
                            <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-indigo-500 sm:bottom-1 sm:h-1.5 sm:w-1.5" title={`${n} smena`} />
                          )}
                        </button>
                      );
                    }),
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 px-3 pt-3">
                <CardTitle className="text-sm font-semibold sm:text-base">Dežurstva za izdavanje soba</CardTitle>
                <p className="text-xs text-slate-500 mt-1 leading-snug">
                  Linije: Aristotelis, Panorama Beach, Sartios, Ostraco. Više smena po liniji; vreme od 9:00 do 17:00.
                </p>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                {roomDutyLoading ? (
                  <p className="text-sm text-slate-500">Učitavanje…</p>
                ) : (
                  <Tabs defaultValue="aristotelis" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1 bg-slate-100/80">
                      {EXCURSION_DUTY_SLOTS.map((s) => (
                        <TabsTrigger
                          key={s.key}
                          value={s.key}
                          className={`text-[11px] sm:text-sm px-1.5 py-2 border border-transparent whitespace-normal leading-tight ${s.tabClass}`}
                        >
                          {s.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {EXCURSION_DUTY_SLOTS.map((s) => {
                      const list = roomDutiesBySlot[s.key] || [];
                      return (
                        <TabsContent key={s.key} value={s.key} className="mt-3">
                          <section className={`flex flex-col rounded-xl p-3 ${s.panelClass}`}>
                            <header className="shrink-0 border-b border-slate-900/10 pb-2 mb-2 flex flex-wrap items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight min-w-0">
                                <span className="font-semibold text-slate-900">{s.label}</span>
                                <span className="text-slate-400 select-none" aria-hidden>
                                  ·
                                </span>
                                <span className="text-slate-700 tabular-nums font-medium">
                                  {ROOM_DUTY_WINDOW.timeRange}
                                </span>
                              </div>
                              {!isViewer && eligibleUsers.length > 0 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="shrink-0 h-8"
                                  onClick={() => openRoomDutyNew(s.key)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Dodaj
                                </Button>
                              )}
                            </header>
                            <div className={list.length > 4 ? 'max-h-[min(32vh,240px)] overflow-y-auto pr-0.5' : ''}>
                              {list.length === 0 ? (
                                <p className="text-xs text-slate-500/90 italic py-0.5">Nema smena.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {list.map((shift) => {
                                    const bar = shiftBarInWindow(
                                      shift.start_time,
                                      shift.end_time,
                                      ROOM_DUTY_WINDOW.windowStart,
                                      ROOM_DUTY_WINDOW.windowEnd,
                                    );
                                    return (
                                      <div
                                        key={shift.id}
                                        className="rounded-lg border border-white/80 bg-white/90 p-2 shadow-sm space-y-1.5 backdrop-blur-[1px]"
                                      >
                                        <div className="flex justify-between gap-1.5 items-start">
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                                              {userDisplayName(shift.user) || shift.user?.email || 'Korisnik'}
                                            </div>
                                            <div className="text-xs text-slate-600 tabular-nums mt-0.5">
                                              {shift.start_time} – {shift.end_time}
                                            </div>
                                            {shift.note ? (
                                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{shift.note}</p>
                                            ) : null}
                                          </div>
                                          {!isViewer && (
                                            <div className="flex flex-col gap-0 shrink-0">
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
                                                onClick={() => openRoomDutyEdit(shift)}
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-500 hover:text-red-700 hover:bg-red-50"
                                                disabled={roomDutyDeleteMut.isPending}
                                                onClick={() => {
                                                  if (confirm('Obrisati smenu?')) roomDutyDeleteMut.mutate(shift.id);
                                                }}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                        <div className="relative h-2 rounded bg-slate-200/80">
                                          <div
                                            className={`absolute top-0 h-2 rounded opacity-95 ${s.barClass}`}
                                            style={{ left: bar.left, width: bar.width }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </section>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-8 border-slate-200 shadow-sm flex flex-col max-h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-6rem)]">
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-lg sm:text-xl">{format(selectedDay, 'EEEE, d. MMMM yyyy.')}</CardTitle>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Smena je u delu dana u kome <strong>počinje</strong>. Traka pokazuje trajanje unutar tog intervala.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 min-h-0 overflow-y-auto pt-0 pb-2 pr-1">
              {shiftsLoading ? (
                <p className="text-sm text-slate-500">Učitavanje…</p>
              ) : (
                DAY_PART_PANELS.map((panel) => {
                  const list = shiftsBySegment[panel.id] || [];
                  return (
                    <section
                      key={panel.id}
                      className={`flex flex-col rounded-xl p-3 shrink-0 ${panel.shellClass}`}
                    >
                      <header className="shrink-0 border-b border-slate-900/10 pb-2 mb-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-tight">
                          <span className="font-semibold text-slate-900">{panel.title}</span>
                          <span className="text-slate-400 select-none" aria-hidden>
                            ·
                          </span>
                          <span className="text-slate-700 tabular-nums font-medium">{panel.timeRange}</span>
                        </div>
                      </header>
                      <div
                        className={
                          list.length > 4
                            ? 'max-h-[min(36vh,280px)] overflow-y-auto pr-0.5'
                            : ''
                        }
                      >
                        {list.length === 0 ? (
                          <p className="text-xs text-slate-500/90 italic py-0.5">Nema smena.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {list.map((s) => {
                              const bar = shiftBarInWindow(
                                s.start_time,
                                s.end_time,
                                panel.windowStart,
                                panel.windowEnd,
                              );
                              return (
                                <div
                                  key={s.id}
                                  className="rounded-lg border border-white/80 bg-white/90 p-2 shadow-sm space-y-1.5 backdrop-blur-[1px]"
                                >
                                  <div className="flex justify-between gap-1.5 items-start">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                                        {userDisplayName(s.user) || s.user?.email || 'Korisnik'}
                                      </div>
                                      <div className="text-xs text-slate-600 tabular-nums mt-0.5">
                                        {s.start_time} – {s.end_time}
                                      </div>
                                      {s.note ? (
                                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{s.note}</p>
                                      ) : null}
                                    </div>
                                    {!isViewer && (
                                      <div className="flex flex-col gap-0 shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
                                          onClick={() => openEditDialog(s)}
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-slate-500 hover:text-red-700 hover:bg-red-50"
                                          disabled={deleteMut.isPending}
                                          onClick={() => {
                                            if (confirm('Obrisati smenu?')) deleteMut.mutate(s.id);
                                          }}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative h-2 rounded bg-slate-200/80">
                                    <div
                                      className={`absolute top-0 h-2 rounded opacity-95 ${panel.barClass}`}
                                      style={{ left: bar.left, width: bar.width }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Izmeni dežurstvo' : 'Novo dežurstvo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input value={selectedDayStr} readOnly className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>Korisnik</Label>
                <Select value={formUserId} onValueChange={setFormUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {userDisplayName(u) || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delovi dana</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_BLOCKS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`h-auto min-w-[7.5rem] flex-col gap-0.5 border py-2 shadow-sm ${PRESET_TAB_CLASSES[p.tabTone] || ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      <span className="text-xs font-semibold leading-tight sm:text-sm">{p.tabTitle}</span>
                      <span className="text-[10px] font-normal opacity-90 leading-none">{p.rangeLabel}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Početak</Label>
                  <Input value={formStart} onChange={(e) => setFormStart(e.target.value)} placeholder="09:00" />
                </div>
                <div className="space-y-2">
                  <Label>Kraj</Label>
                  <Input value={formEnd} onChange={(e) => setFormEnd(e.target.value)} placeholder="14:00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Trajanje od početka</Label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6].map((h) => (
                    <Button key={h} type="button" variant="outline" size="sm" onClick={() => applyDurationHours(h)}>
                      +{h}h
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Napomena (opciono)</Label>
                <Textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                Otkaži
              </Button>
              <Button type="button" onClick={handleSubmitDialog} disabled={busy}>
                {editingId ? 'Sačuvaj' : 'Dodaj'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={roomDutyDialogOpen} onOpenChange={setRoomDutyDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{roomDutyEditingId ? 'Izmeni smenu (sobe)' : 'Nova smena (sobe)'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Datum</Label>
                <Input value={selectedDayStr} readOnly className="bg-slate-50" />
              </div>
              <div className="space-y-2">
                <Label>Linija / kuća</Label>
                <Input
                  value={roomDutySlotLabel(roomDutySlotKey)}
                  readOnly
                  className="bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label>Korisnik</Label>
                <Select value={roomFormUserId} onValueChange={setRoomFormUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite…" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {userDisplayName(u) || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brzi intervali (9–17)</Label>
                <div className="flex flex-wrap gap-2">
                  {ROOM_DUTY_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={`h-auto min-w-[6.5rem] flex-col gap-0.5 border py-2 shadow-sm ${PRESET_TAB_CLASSES[p.tabTone] || ''}`}
                      onClick={() => applyRoomPreset(p)}
                    >
                      <span className="text-xs font-semibold leading-tight sm:text-sm">{p.tabTitle}</span>
                      {p.rangeLabel ? (
                        <span className="text-[10px] font-normal opacity-90 leading-none">{p.rangeLabel}</span>
                      ) : null}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Početak</Label>
                  <Input
                    value={roomFormStart}
                    onChange={(e) => setRoomFormStart(e.target.value)}
                    placeholder="09:00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kraj</Label>
                  <Input
                    value={roomFormEnd}
                    onChange={(e) => setRoomFormEnd(e.target.value)}
                    placeholder="17:00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Trajanje od početka</Label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                    <Button key={h} type="button" variant="outline" size="sm" onClick={() => applyRoomDurationHours(h)}>
                      +{h}h
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Napomena (opciono)</Label>
                <Textarea value={roomFormNote} onChange={(e) => setRoomFormNote(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setRoomDutyDialogOpen(false)}>
                Otkaži
              </Button>
              <Button type="button" onClick={handleRoomDutySubmit} disabled={roomDutyBusy}>
                {roomDutyEditingId ? 'Sačuvaj' : 'Dodaj'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
