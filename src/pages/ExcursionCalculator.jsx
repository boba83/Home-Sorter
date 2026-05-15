import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Calculator, Sailboat, Bus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EXCURSIONS = [
    { name: 'Robinzon', adl: 36, icon: 'boat', color: 'from-cyan-400 to-blue-500', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
    { name: 'Plava laguna', adl: 34, icon: 'boat', color: 'from-blue-400 to-indigo-500', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    { name: 'Atos', adl: 29, icon: 'boat', color: 'from-violet-400 to-purple-500', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
    { name: 'Sunset', adl: 16, icon: 'boat', color: 'from-orange-400 to-rose-500', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    { name: 'Solun', adl: 30, icon: 'bus', color: 'from-emerald-400 to-teal-500', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
].map(e => ({ ...e, chd: e.adl / 2 }));

const emptyRow = () => ({ excursion: '', adl: '', chd: '' });

const ExcursionIcon = ({ icon, className }) =>
    icon === 'bus'
        ? <Bus className={className} />
        : <Sailboat className={className} />;

export default function ExcursionCalculator() {
    const [rows, setRows] = useState([emptyRow()]);

    const updateRow = (index, field, value) => {
        setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
    };

    const addRow = () => setRows(prev => [...prev, emptyRow()]);
    const removeRow = (index) => setRows(prev => prev.filter((_, i) => i !== index));

    const getExcursion = (name) => EXCURSIONS.find(e => e.name === name);

    const getPrice = (excursionName, type) => {
        const ex = getExcursion(excursionName);
        if (!ex) return 0;
        return type === 'adl' ? ex.adl : ex.chd;
    };

    const rowTotal = (row) => {
        const adl = parseInt(row.adl) || 0;
        const chd = parseInt(row.chd) || 0;
        return adl * getPrice(row.excursion, 'adl') + chd * getPrice(row.excursion, 'chd');
    };

    const grandTotal = rows.reduce((sum, r) => sum + rowTotal(r), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50 p-4 md:p-8">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/">
                        <Button variant="ghost" size="icon" className="rounded-full hover:bg-white shadow-sm border border-slate-200">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Excursion Calculator</h1>
                        <p className="text-slate-500 text-sm">Obračun ekskurzija</p>
                    </div>
                </div>

                {/* Price List */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Cenovnik</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {EXCURSIONS.map(ex => (
                            <div key={ex.name} className={`flex items-center gap-3 rounded-2xl border ${ex.border} ${ex.bg} p-4 shadow-sm`}>
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ex.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                                    <ExcursionIcon icon={ex.icon} className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`font-bold text-sm ${ex.text}`}>{ex.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {ex.icon === 'bus' ? 'Autobus' : 'Brodska ekskurzija'}
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className={`font-bold text-base ${ex.text}`}>{ex.adl} €</p>
                                    <p className="text-xs text-slate-400">{ex.chd} € <span className="text-slate-300">CHD</span></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calculator */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Obračun</p>

                    {/* Column headers */}
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
                                <div key={i} className={`grid grid-cols-12 gap-2 items-center rounded-xl p-1 transition-colors ${ex ? ex.bg : 'bg-slate-50'}`}>
                                    <select
                                        className={`col-span-5 border rounded-lg px-2 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${ex ? `${ex.border} ${ex.text}` : 'border-slate-200 text-slate-600'}`}
                                        value={row.excursion}
                                        onChange={e => updateRow(i, 'excursion', e.target.value)}
                                    >
                                        <option value="">Odaberi...</option>
                                        {EXCURSIONS.map(e => (
                                            <option key={e.name} value={e.name}>{e.icon === 'bus' ? '🚌' : '⛵'} {e.name}</option>
                                        ))}
                                    </select>

                                    <Input
                                        className="col-span-2 text-center bg-white"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={row.adl}
                                        onChange={e => updateRow(i, 'adl', e.target.value)}
                                    />

                                    <Input
                                        className="col-span-2 text-center bg-white"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={row.chd}
                                        onChange={e => updateRow(i, 'chd', e.target.value)}
                                    />

                                    <div className={`col-span-2 text-right font-bold text-sm ${ex ? ex.text : 'text-slate-400'}`}>
                                        {rowTotal(row) > 0 ? `${rowTotal(row)} €` : '—'}
                                    </div>

                                    <div className="col-span-1 flex justify-end">
                                        {rows.length > 1 && (
                                            <button onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-400 transition-colors">
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
                        Dodaj ekskurziju
                    </Button>

                    {/* Total */}
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
        </div>
    );
}