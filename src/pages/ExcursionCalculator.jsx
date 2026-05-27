import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Plus,
    Trash2,
    Calculator,
    Sailboat,
    Bus,
    Car,
    Pencil,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { withExcursionStyles, EXCURSION_THEME_STYLES } from '@/lib/excursionThemes';
import { useToast } from '@/components/ui/use-toast';

const emptyRow = () => ({ excursion: '', adl: '', chd: '' });

const EXCURSION_ICON_OPTIONS = [
    { key: 'boat', label: 'Brod', emoji: '⛵' },
    { key: 'bus', label: 'Autobus', emoji: '🚌' },
    { key: 'minibus', label: 'Kombi / mini bus', emoji: '🚐' },
];

const ExcursionIcon = ({ icon, className }) => {
    if (icon === 'bus') return <Bus className={className} />;
    if (icon === 'minibus') return <Car className={className} />;
    return <Sailboat className={className} />;
};

function excursionTypeLabel(icon) {
    if (icon === 'bus') return 'Autobus';
    if (icon === 'minibus') return 'Kombi / mini bus';
    return 'Brodska ekskurzija';
}

const emptyForm = () => ({
    name: '',
    adl_price: '',
    chd_price: '',
    icon: 'boat',
    theme: 'cyan',
});

export default function ExcursionCalculator() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
    const queryClient = useQueryClient();
    const [rows, setRows] = useState([emptyRow()]);
    const [adminOpen, setAdminOpen] = useState(false);
    const [editExcursion, setEditExcursion] = useState(null);
    const [form, setForm] = useState(emptyForm());

    const { data: excursionsRaw = [], isLoading } = useQuery({
        queryKey: ['excursions'],
        queryFn: () => api.excursions.list(),
    });

    const excursions = useMemo(
        () => excursionsRaw.map(withExcursionStyles),
        [excursionsRaw]
    );

    const saveMutation = useMutation({
        mutationFn: async (payload) => {
            if (payload.id) {
                return api.excursions.update(payload.id, payload.body);
            }
            return api.excursions.create(payload.body);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ['excursions'] });
            setEditExcursion(null);
            setForm(emptyForm());
            toast({
                title: 'Sačuvano',
                description: variables?.id
                    ? 'Ekskurzija je ažurirana.'
                    : 'Nova ekskurzija je dodata u cenovnik.',
            });
        },
        onError: (err) => {
            toast({
                title: 'Greška',
                description: err?.message || 'Čuvanje ekskurzije nije uspelo.',
                variant: 'destructive',
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => api.excursions.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['excursions'] }),
    });

    const updateRow = (index, field, value) => {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    };

    const addRow = () => setRows((prev) => [...prev, emptyRow()]);
    const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

    const getExcursion = (name) => excursions.find((e) => e.name === name);

    const getPrice = (excursionName, type) => {
        const ex = getExcursion(excursionName);
        if (!ex) return 0;
        return type === 'adl' ? ex.adl : ex.chd;
    };

    const rowTotal = (row) => {
        const adl = parseInt(row.adl, 10) || 0;
        const chd = parseInt(row.chd, 10) || 0;
        return adl * getPrice(row.excursion, 'adl') + chd * getPrice(row.excursion, 'chd');
    };

    const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

    const openCreate = () => {
        setEditExcursion(null);
        setForm(emptyForm());
        setAdminOpen(true);
    };

    const openEdit = (ex) => {
        setEditExcursion(ex);
        setForm({
            name: ex.name,
            adl_price: String(ex.adl),
            chd_price: ex.chd_price != null ? String(ex.chd) : '',
            icon: ex.icon,
            theme: ex.theme,
        });
        setAdminOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        const adl = parseFloat(form.adl_price);
        if (!form.name.trim() || !Number.isFinite(adl)) return;
        const chdRaw = String(form.chd_price ?? '').trim();
        const chdParsed = chdRaw === '' ? null : parseFloat(chdRaw);
        const chd_price =
            chdParsed == null || chdRaw === '' ? null : Number.isFinite(chdParsed) && chdParsed >= 0 ? chdParsed : null;
        const body = {
            name: form.name.trim(),
            adl_price: adl,
            chd_price,
            icon: form.icon,
            theme: form.theme,
        };
        saveMutation.mutate({
            id: editExcursion?.id,
            body,
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full hover:bg-white shadow-sm border border-slate-200"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-800">Excursion Calculator</h1>
                        <p className="text-slate-500 text-sm">Obračun ekskurzija</p>
                    </div>
                    {isAdmin && (
                        <Button
                            size="sm"
                            className="rounded-xl gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-md"
                            onClick={openCreate}
                        >
                            <Plus className="w-4 h-4" />
                            Dodaj ekskurziju
                        </Button>
                    )}
                </div>

                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">
                        Cenovnik
                    </p>
                    {isLoading ? (
                        <div className="flex justify-center py-8 text-slate-400">
                            <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {excursions.map((ex) => (
                                <div
                                    key={ex.id}
                                    className={`relative flex items-center gap-3 rounded-2xl border ${ex.border} ${ex.bg} p-4 shadow-sm`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ex.color} flex items-center justify-center shadow-md flex-shrink-0`}
                                    >
                                        <ExcursionIcon icon={ex.icon} className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold text-sm ${ex.text}`}>{ex.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {excursionTypeLabel(ex.icon)}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 pr-8">
                                        <p className={`font-bold text-base ${ex.text}`}>{ex.adl} €</p>
                                        <p className="text-xs text-slate-400">
                                            {ex.chd} € <span className="text-slate-300">CHD</span>
                                        </p>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => openEdit(ex)}
                                            className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors"
                                            title="Izmeni cenu"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        Obračun
                    </p>

                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase mb-2 px-1">
                        <span className="col-span-5">Ekskurzija</span>
                        <span className="col-span-2 text-center">ADL</span>
                        <span className="col-span-2 text-center">CHD</span>
                        <span className="col-span-2 text-right">Ukupno</span>
                        <span className="col-span-1"></span>
                    </div>

                    <div className="space-y-2">
                        {rows.map((row, i) => {
                            const ex = getExcursion(row.excursion);
                            return (
                                <div
                                    key={i}
                                    className={`grid grid-cols-12 gap-2 items-center rounded-xl p-1 transition-colors ${ex ? ex.bg : 'bg-slate-50'}`}
                                >
                                    <select
                                        className={`col-span-5 border rounded-lg px-2 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${ex ? `${ex.border} ${ex.text}` : 'border-slate-200 text-slate-600'}`}
                                        value={row.excursion}
                                        onChange={(e) => updateRow(i, 'excursion', e.target.value)}
                                        disabled={isLoading || excursions.length === 0}
                                    >
                                        <option value="">Odaberi...</option>
                                        {excursions.map((e) => {
                                            const opt = EXCURSION_ICON_OPTIONS.find((o) => o.key === e.icon);
                                            return (
                                                <option key={e.id} value={e.name}>
                                                    {opt?.emoji ?? '·'} {e.name}
                                                </option>
                                            );
                                        })}
                                    </select>

                                    <Input
                                        className="col-span-2 text-center bg-white"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={row.adl}
                                        onChange={(e) => updateRow(i, 'adl', e.target.value)}
                                    />

                                    <Input
                                        className="col-span-2 text-center bg-white"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={row.chd}
                                        onChange={(e) => updateRow(i, 'chd', e.target.value)}
                                    />

                                    <div
                                        className={`col-span-2 text-right font-bold text-sm ${ex ? ex.text : 'text-slate-400'}`}
                                    >
                                        {rowTotal(row) > 0 ? `${rowTotal(row)} €` : '—'}
                                    </div>

                                    <div className="col-span-1 flex justify-end">
                                        {rows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(i)}
                                                className="text-slate-300 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <Button
                        variant="outline"
                        className="mt-4 w-full border-dashed border-slate-300 text-slate-400 hover:text-slate-600 hover:border-slate-400 rounded-xl"
                        onClick={addRow}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Dodaj red u obračun
                    </Button>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-600 font-semibold">
                            <Calculator className="w-5 h-5" />
                            <span>Ukupno</span>
                        </div>
                        <div className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent">
                            {grandTotal} €
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editExcursion ? 'Izmeni ekskurziju' : 'Nova ekskurzija'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <Label htmlFor="ex-name">Naziv</Label>
                            <Input
                                id="ex-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="npr. Meteora"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="ex-adl">Cena ADL (€)</Label>
                                <Input
                                    id="ex-adl"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={form.adl_price}
                                    onChange={(e) => setForm({ ...form, adl_price: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="ex-chd">Cena CHD (€)</Label>
                                <Input
                                    id="ex-chd"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="polovina ADL"
                                    value={form.chd_price}
                                    onChange={(e) => setForm({ ...form, chd_price: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Tip prevoza</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                                {EXCURSION_ICON_OPTIONS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setForm({ ...form, icon: key })}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border text-sm font-medium transition-colors ${
                                            form.icon === key
                                                ? 'border-blue-400 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        <ExcursionIcon icon={key} className="w-4 h-4 shrink-0" />
                                        <span className="leading-tight text-center">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <Label>Boja kartice</Label>
                            <div className="grid grid-cols-4 gap-2 mt-1">
                                {Object.entries(EXCURSION_THEME_STYLES).map(([key, t]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        title={t.label}
                                        onClick={() => setForm({ ...form, theme: key })}
                                        className={`h-9 rounded-lg bg-gradient-to-br ${t.color} ring-2 transition-all ${
                                            form.theme === key
                                                ? 'ring-blue-500 scale-105'
                                                : 'ring-transparent opacity-80 hover:opacity-100'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                        {saveMutation.isError && (
                            <p className="text-sm text-red-600">
                                {saveMutation.error?.message || 'Greška pri čuvanju'}
                            </p>
                        )}
                        <DialogFooter className="flex-col sm:flex-row gap-2">
                            {editExcursion && (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    className="sm:mr-auto"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                `Obrisati „${editExcursion.name}" iz cenovnika?`
                                            )
                                        ) {
                                            deleteMutation.mutate(editExcursion.id, {
                                                onSuccess: () => setAdminOpen(false),
                                            });
                                        }
                                    }}
                                >
                                    Obriši
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAdminOpen(false)}
                            >
                                Otkaži
                            </Button>
                            <Button type="submit" disabled={saveMutation.isPending}>
                                {saveMutation.isPending ? 'Čuvanje...' : 'Sačuvaj'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
