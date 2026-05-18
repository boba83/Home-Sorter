import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DoorOpen, Users, Edit2, Trash2, Plus, X, Loader2, Sailboat, UserCheck, Calendar, Bus, ChevronDown, ChevronUp, FileText, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

function normalizeNames(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p : raw.trim() ? [raw] : [];
        } catch {
            return raw.trim() ? [raw] : [];
        }
    }
    return [];
}

/** Prikaz datuma kao na rooming listi / kartici (npr. 18.08.2025) */
function formatStayDate(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (s.includes('-') && s.length >= 8) {
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) return format(d, 'dd.MM.yyyy');
    }
    if (s.includes('.')) {
        const p = s.split('.').filter(Boolean);
        if (p.length >= 3) {
            return `${p[0].padStart(2, '0')}.${p[1].padStart(2, '0')}.${p[2]}`;
        }
        if (p.length === 2) {
            return `${p[0].padStart(2, '0')}.${p[1].padStart(2, '0')}`;
        }
    }
    return s;
}

export default function RoomCard({ room, onUpdate, onDelete, canEdit = true }) {
    if (!room?.id) return null;

    const occupantNames = normalizeNames(room.occupant_names);

    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editData, setEditData] = useState({
        room_number: room.room_number || '',
        room_structure: room.room_structure || '',
        capacity: room.capacity || 1,
        occupant_names: occupantNames,
        notes: room.notes || '',
        excursion: room.excursion || '',
        visit: room.visit || '',
        stay_from: room.stay_from || '',
        stay_to: room.stay_to || '',
        tax_paid: room.tax_paid === true,
        contact_phone: room.contact_phone || '',
    });
    const [newVisitEntry, setNewVisitEntry] = useState('');
    const [visitExpanded, setVisitExpanded] = useState(true);

    const parseVisitHistory = (visitStr) => {
        if (!visitStr) return [];
        try {
            const parsed = JSON.parse(visitStr);
            if (Array.isArray(parsed)) return parsed;
        } catch {}
        return [{ text: visitStr, timestamp: null }];
    };

    const visitHistory = parseVisitHistory(room.visit);
    const [newOccupant, setNewOccupant] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const occupancy = room.current_occupants || occupantNames.length || 0;
    const capacity = room.capacity || 1;
    const occupancyPercent = Math.min((occupancy / capacity) * 100, 100);

    const calculateTax = (stayFrom, stayTo) => {
        if (!stayFrom || !stayTo) return 0;
        let fromDate, toDate;
        if (stayFrom.includes('.')) {
            const [day, month, year] = stayFrom.split('.');
            fromDate = new Date(year, month - 1, day);
        } else {
            fromDate = new Date(stayFrom);
        }
        if (stayTo.includes('.')) {
            const [day, month, year] = stayTo.split('.');
            toDate = new Date(year, month - 1, day);
        } else {
            toDate = new Date(stayTo);
        }
        const timeDiff = toDate.getTime() - fromDate.getTime();
        const nights = Math.round(timeDiff / (1000 * 60 * 60 * 24));
        return Math.max(0, nights * 2);
    };

    const taxAmount = calculateTax(room.stay_from || '', room.stay_to || '');

    const handleSave = async () => {
        setIsSaving(true);
        const convertToStorageFormat = (dateStr) => {
            if (!dateStr) return '';
            if (dateStr.includes('-')) {
                const [year, month, day] = dateStr.split('-');
                return `${day}.${month}.${year}`;
            }
            return dateStr;
        };
        const updateData = {
            ...editData,
            stay_from: convertToStorageFormat(editData.stay_from),
            stay_to: convertToStorageFormat(editData.stay_to),
            current_occupants: editData.occupant_names.length
        };
        if (editData.notes !== room.notes && editData.notes) {
            updateData.notes_updated_at = new Date().toISOString();
        }
        if (newVisitEntry.trim()) {
            const existingHistory = parseVisitHistory(room.visit);
            const newEntry = { text: newVisitEntry.trim(), timestamp: new Date().toISOString() };
            updateData.visit = JSON.stringify([...existingHistory, newEntry]);
            updateData.visit_updated_at = new Date().toISOString();
        } else {
            updateData.visit = room.visit || '';
        }
        if (editData.excursion !== room.excursion && editData.excursion) {
            updateData.excursion_updated_at = new Date().toISOString();
        }
        await base44.entities.Room.update(room.id, updateData);
        setIsSaving(false);
        setIsEditing(false);
        setNewVisitEntry('');
        onUpdate();
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        await base44.entities.Room.delete(room.id);
        onDelete();
    };

    const addOccupant = () => {
        if (newOccupant.trim()) {
            setEditData({
                ...editData,
                occupant_names: [...editData.occupant_names, newOccupant.trim()]
            });
            setNewOccupant('');
        }
    };

    const removeOccupant = (index) => {
        setEditData({
            ...editData,
            occupant_names: editData.occupant_names.filter((_, i) => i !== index)
        });
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
            >
                <Card className="group hover:shadow-md transition-shadow border border-slate-200/90 bg-white rounded-xl relative overflow-hidden shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        {/* Header — broj sobe, struktura, TAX + akcije */}
                        <motion.div className="flex items-start justify-between gap-3 mb-4">
                            <motion.div className="flex items-center gap-3 min-w-0">
                                <motion.div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                                    occupancy > 0
                                        ? 'bg-gradient-to-br from-emerald-400 to-green-600'
                                        : 'bg-gradient-to-br from-slate-300 to-slate-500'
                                }`}>
                                    <DoorOpen className="w-5 h-5 text-white" />
                                </motion.div>
                                <motion.div className="min-w-0">
                                    <h4 className="font-bold text-slate-900 text-base leading-tight tracking-tight">
                                        Room {room.room_number}
                                    </h4>
                                    {room.room_structure ? (
                                        <p className="text-sm mt-0.5 leading-snug text-slate-600">
                                            {room.room_structure}
                                        </p>
                                    ) : null}
                                    {room.contact_phone ? (
                                        <p className="text-xs mt-1 text-slate-500 flex items-center gap-1.5 font-medium tabular-nums">
                                            <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                                            {room.contact_phone}
                                        </p>
                                    ) : null}
                                </motion.div>
                            </motion.div>
                            <motion.div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                <span
                                    className={`text-xs font-semibold uppercase tracking-wide ${
                                        room.tax_paid === true ? 'text-emerald-600' : 'text-red-600'
                                    }`}
                                >
                                    TAX {room.tax_paid === true ? 'Paid' : 'Unpaid'}
                                </span>
                                {canEdit && (
                                    <motion.div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(true)}>
                                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDelete} disabled={isDeleting}>
                                            {isDeleting ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                            )}
                                        </Button>
                                    </motion.div>
                                )}
                            </motion.div>
                        </motion.div>

                        {/* Occupancy + gosti (kao na preview-u) */}
                        <motion.div className="mb-3">
                            <motion.div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                                    <Users className="w-3.5 h-3.5 text-slate-500" />
                                    Occupancy
                                </span>
                                <span className="font-semibold text-slate-900 tabular-nums">{occupancy}/{capacity}</span>
                            </motion.div>
                            <motion.div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2.5">
                                <motion.div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        occupancyPercent >= 100
                                            ? 'bg-emerald-500'
                                            : occupancyPercent > 0
                                                ? 'bg-blue-500'
                                                : 'bg-slate-200'
                                    }`}
                                    style={{ width: `${occupancyPercent}%` }}
                                />
                            </motion.div>
                            {occupantNames.length > 0 ? (
                                <motion.div className="flex flex-wrap gap-1.5">
                                    {occupantNames.map((name, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex rounded-full bg-slate-100/90 border border-slate-200/80 px-2.5 py-1 text-xs font-medium text-slate-800"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </motion.div>
                            ) : (
                                <p className="text-xs text-slate-400">Nema prijavljenih gostiju</p>
                            )}
                        </motion.div>

                        {/* Termin boravka — istaknuto (ljubičasta traka kao u preview tabeli) */}
                        {(room.stay_from || room.stay_to) && (
                            <motion.div className="flex items-center gap-2.5 text-sm rounded-xl border border-violet-200/80 bg-gradient-to-r from-violet-50 to-purple-50 px-3.5 py-2.5 mb-3 shadow-sm">
                                <Calendar className="w-4 h-4 text-violet-600 flex-shrink-0" />
                                <span className="font-semibold text-violet-900 tabular-nums">
                                    {formatStayDate(room.stay_from) || '?'}
                                    <span className="text-violet-400 font-normal mx-1.5">—</span>
                                    {formatStayDate(room.stay_to) || '?'}
                                </span>
                            </motion.div>
                        )}

                        {/* Visit record */}
                        {visitHistory.length > 0 && (
                            <motion.div className="bg-amber-50 border border-amber-200/90 rounded-xl px-3 py-2.5 mb-3 shadow-sm">
                                <button
                                    type="button"
                                    className="flex items-center justify-between w-full text-sm font-semibold text-amber-950 mb-1"
                                    onClick={() => setVisitExpanded((v) => !v)}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-md flex items-center justify-center bg-orange-500 flex-shrink-0 shadow-sm">
                                            <UserCheck className="w-3 h-3 text-white" />
                                        </span>
                                        Visit
                                        <span className="text-xs font-semibold text-amber-800">({visitHistory.length})</span>
                                    </span>
                                    {visitExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-amber-700" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-amber-700" />
                                    )}
                                </button>
                                {visitExpanded && (
                                    <motion.div className="space-y-2 pt-1">
                                        {visitHistory.map((entry, i) => (
                                            <motion.div key={i} className="rounded-lg bg-white/70 border border-amber-100 px-2.5 py-2">
                                                <p className="text-sm text-orange-800 font-medium leading-snug">{entry.text}</p>
                                                {entry.timestamp && (
                                                    <p className="text-xs text-orange-600 mt-1 tabular-nums">
                                                        {format(new Date(entry.timestamp), 'dd.MM.yyyy HH:mm')}
                                                    </p>
                                                )}
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {/* Ekskurzija */}
                        {room.excursion && (
                            <motion.div className="flex items-start gap-2.5 text-sm mb-3">
                                <span className="w-5 h-5 rounded-md flex items-center justify-center bg-blue-500 flex-shrink-0 shadow-sm">
                                    <Sailboat className="w-3 h-3 text-white" />
                                </span>
                                <p className="text-slate-700 leading-snug pt-0.5">
                                    <span className="font-semibold text-slate-800">Excursion: </span>
                                    {room.excursion}
                                </p>
                            </motion.div>
                        )}

                        {/* Napomena / agencija (npr. PORTO TRAVEL) */}
                        {room.notes && (
                            <motion.div className="flex items-start gap-2.5 pt-0.5 border-t border-slate-100 mt-1">
                                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 mt-0.5" />
                                <span className="text-xs font-semibold text-slate-700 leading-relaxed tracking-wide uppercase">
                                    {room.notes}
                                </span>
                            </motion.div>
                        )}
                    </CardContent>

                    {room.bus && (
                        <motion.div className="absolute bottom-3 right-3">
                            <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 shadow-sm">
                                <Bus className="w-3 h-3" />
                                BUS
                            </span>
                        </motion.div>
                    )}
                </Card>
            </motion.div>

            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Room {room.room_number}</DialogTitle>
                    </DialogHeader>
                    <motion.div className="space-y-4 py-4">
                        <motion.div className="grid grid-cols-2 gap-4">
                            <motion.div className="space-y-2">
                                <Label htmlFor="room_number">Room Number</Label>
                                <Input
                                    id="room_number"
                                    value={editData.room_number}
                                    onChange={(e) => setEditData({...editData, room_number: e.target.value})}
                                />
                            </motion.div>
                            <motion.div className="space-y-2">
                                <Label htmlFor="capacity">Capacity</Label>
                                <Input
                                    id="capacity"
                                    type="number"
                                    min="1"
                                    value={editData.capacity}
                                    onChange={(e) => setEditData({...editData, capacity: parseInt(e.target.value) || 1})}
                                />
                            </motion.div>
                        </motion.div>
                        <motion.div className="space-y-2">
                            <Label htmlFor="structure">Room Structure</Label>
                            <Input
                                id="structure"
                                value={editData.room_structure}
                                onChange={(e) => setEditData({...editData, room_structure: e.target.value})}
                                placeholder="e.g. 1/5+1 DUPLEX"
                            />
                        </motion.div>
                        <motion.div className="space-y-2">
                            <Label>Occupants</Label>
                            <motion.div className="flex gap-2">
                                <Input
                                    value={newOccupant}
                                    onChange={(e) => setNewOccupant(e.target.value)}
                                    placeholder="Add occupant name"
                                    onKeyPress={(e) => e.key === 'Enter' && addOccupant()}
                                />
                                <Button variant="outline" onClick={addOccupant}>
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </motion.div>
                            {editData.occupant_names.length > 0 && (
                                <motion.div className="flex flex-wrap gap-2 mt-2">
                                    {editData.occupant_names.map((name, i) => (
                                        <Badge key={i} variant="secondary" className="flex items-center gap-1">
                                            {name}
                                            <button type="button" onClick={() => removeOccupant(i)} className="ml-1 hover:text-red-500">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </motion.div>
                            )}
                        </motion.div>
                        <motion.div className="grid grid-cols-2 gap-4">
                            <motion.div className="space-y-2">
                                <Label htmlFor="stay_from">Stay From</Label>
                                <Input
                                    id="stay_from"
                                    type="date"
                                    value={editData.stay_from || ''}
                                    onChange={(e) => setEditData({...editData, stay_from: e.target.value})}
                                />
                            </motion.div>
                            <motion.div className="space-y-2">
                                <Label htmlFor="stay_to">Stay To</Label>
                                <Input
                                    id="stay_to"
                                    type="date"
                                    value={editData.stay_to || ''}
                                    onChange={(e) => setEditData({...editData, stay_to: e.target.value})}
                                />
                            </motion.div>
                        </motion.div>
                        <motion.div className="space-y-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <motion.div className="flex items-center gap-2 mb-2">
                                <span className="w-4 h-4 rounded flex items-center justify-center bg-orange-500">
                                    <UserCheck className="w-2.5 h-2.5 text-white" />
                                </span>
                                <span className="text-amber-800 font-semibold text-sm">Visit</span>
                            </motion.div>
                            {parseVisitHistory(room.visit).length > 0 && (
                                <motion.div className="space-y-1.5 mb-3">
                                    {parseVisitHistory(room.visit).map((entry, i) => (
                                        <motion.div key={i} className="text-sm bg-white border border-amber-200 rounded-lg px-3 py-2">
                                            <p className="text-amber-900">{entry.text}</p>
                                            {entry.timestamp && (
                                                <p className="text-xs text-orange-400 mt-0.5">
                                                    {format(new Date(entry.timestamp), 'dd.MM.yyyy HH:mm')}
                                                </p>
                                            )}
                                        </motion.div>
                                    ))}
                                </motion.div>
                            )}
                            <Label className="text-xs text-amber-700 font-medium">Dodaj novi unos</Label>
                            <Textarea
                                id="visit"
                                value={newVisitEntry}
                                onChange={(e) => setNewVisitEntry(e.target.value)}
                                placeholder="e.g. Doctor visit, Family visiting..."
                                className="h-20 border-amber-300 focus:border-amber-500 bg-white"
                            />
                        </motion.div>
                        <motion.div className="space-y-2">
                            <Label htmlFor="excursion" className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded flex items-center justify-center bg-blue-500">
                                    <Sailboat className="w-2.5 h-2.5 text-white" />
                                </span>
                                Excursion
                            </Label>
                            <Textarea
                                id="excursion"
                                value={editData.excursion}
                                onChange={(e) => setEditData({...editData, excursion: e.target.value})}
                                className="h-20"
                            />
                        </motion.div>
                        <motion.div className="space-y-2">
                            <Label htmlFor="contact_phone">Telefon (kontakt)</Label>
                            <Input
                                id="contact_phone"
                                value={editData.contact_phone}
                                onChange={(e) => setEditData({ ...editData, contact_phone: e.target.value })}
                                placeholder="npr. 063/1025533"
                            />
                        </motion.div>
                        <motion.div className="space-y-2">
                            <Label htmlFor="notes">Agencija / napomena (footer)</Label>
                            <Input
                                id="notes"
                                value={editData.notes}
                                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                                placeholder="npr. PORTO TRAVEL"
                            />
                        </motion.div>
                        <motion.div className="space-y-2 border-t pt-4">
                            <Label className="text-red-600 font-semibold text-base">TAX</Label>
                            <motion.div className="bg-gradient-to-br from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-200">
                                <motion.div className="flex items-center justify-between">
                                    <motion.div>
                                        <motion.div className="text-xs text-slate-500 font-medium uppercase">Amount</motion.div>
                                        <motion.div className="text-3xl font-bold text-blue-600">{taxAmount} €</motion.div>
                                    </motion.div>
                                    <motion.div className="flex items-center gap-3">
                                        <Checkbox
                                            id="tax_paid"
                                            checked={editData.tax_paid === true}
                                            onCheckedChange={(checked) => setEditData({...editData, tax_paid: !!checked})}
                                        />
                                        <Label htmlFor="tax_paid" className={`cursor-pointer font-semibold text-lg ${editData.tax_paid ? 'text-green-600' : 'text-slate-500'}`}>
                                            PAID
                                        </Label>
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
