import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, Building2, DoorOpen, Users, Loader2, Calendar, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ExtractedDataPreview({ data, importLocation, onImportComplete, onCancel }) {
    const [isImporting, setIsImporting] = useState(false);

    const rawEntries = Array.isArray(data) ? data : data?.entries;
    const entries = Array.isArray(rawEntries) ? rawEntries : [];
    const resolvedLocation = importLocation ?? data?.location ?? null;

    const groupedByHouse = entries.reduce((acc, entry) => {
        const houseName = entry.house_name || 'Unknown House';
        if (!acc[houseName]) {
            acc[houseName] = [];
        }
        acc[houseName].push(entry);
        return acc;
    }, {});
    const missingRooms = Array.isArray(data?.hotelsMissingRooms) ? data.hotelsMissingRooms : [];
    const isRealHotel = (name) =>
        name && !/TOTAL|\/ADT\b|ROOMS\s*:/i.test(name) && !/^\d+\s*\/\s*ADT/i.test(name);

    const allHotelNames = [
        ...new Set([
            ...Object.keys(groupedByHouse),
            ...(Array.isArray(data?.hotels) ? data.hotels : []),
        ].filter(isRealHotel)),
    ].sort((a, b) => a.localeCompare(b, 'sr'));

    const missingRoomsFiltered = missingRooms.filter(isRealHotel);

    const handleImport = async () => {
        setIsImporting(true);

        try {
            const result = await base44.integrations.Core.CommitPdfImport({
                location: resolvedLocation,
                entries,
            });
            setIsImporting(false);
            const saved = result?.houses?.length ? result.houses.join(', ') : allHotelNames.join(', ');
            if (saved) {
                alert(`Import završen.\nKuće: ${saved}\nSobe: ${result?.roomsCreated ?? entries.length}`);
            }
            onImportComplete();
        } catch (error) {
            setIsImporting(false);
            alert('Import greška: ' + (error.message || String(error)));
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-500" />
                        Preview Extracted Data
                    </CardTitle>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            {Object.keys(groupedByHouse).length} Houses
                        </span>
                        <span className="flex items-center gap-1">
                            <DoorOpen className="w-4 h-4" />
                            {entries.length} Rooms
                        </span>
                        {resolvedLocation && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                Lokacija: {resolvedLocation}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="px-4 py-3 border-b bg-slate-50 space-y-2">
                    <p className="text-sm text-slate-600">
                        Proverite da su <strong>sve kuće</strong> u listi i da imaju sobe (broj u zagradi).
                        Crveno = kuća je u PDF-u ali <strong>nijedna soba nije prepoznata</strong> (npr. pogrešan format sobe).
                        Sobe tipa <strong>A1</strong>, <strong>B3</strong> i gosti preko više strana sada se prepoznaju.
                    </p>
                    {missingRoomsFiltered.length > 0 && (
                        <p className="text-sm font-medium text-red-700">
                            Nedostaju sobe za: {missingRoomsFiltered.join(', ')}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {allHotelNames.map((name) => {
                            const rooms = groupedByHouse[name]?.length ?? 0;
                            const warn = missingRoomsFiltered.includes(name) || rooms === 0;
                            return (
                            <Badge
                                key={name}
                                variant="outline"
                                className={
                                    warn
                                        ? 'bg-red-50 text-red-800 border-red-300'
                                        : 'bg-white text-slate-800'
                                }
                            >
                                {name} ({rooms}{warn ? ' — nema soba!' : ''})
                            </Badge>
                            );
                        })}
                    </div>
                </div>
                <div className="max-h-96 overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                                <TableHead>House</TableHead>
                                <TableHead>Room #</TableHead>
                                <TableHead>Structure</TableHead>
                                <TableHead>Stay Period</TableHead>
                                <TableHead>Capacity</TableHead>
                                <TableHead>Occupants</TableHead>
                                <TableHead className="whitespace-nowrap">Ugovor</TableHead>
                                <TableHead className="whitespace-nowrap">Phone</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((entry, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            {entry.house_name || 'Unknown'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {entry.room_number || 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-slate-600">
                                        {entry.room_structure || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {(entry.stay_from || entry.stay_to) ? (
                                            <span className="flex items-center gap-1 text-sm text-purple-600">
                                                <Calendar className="w-3 h-3" />
                                                {entry.stay_from || '?'} — {entry.stay_to || '?'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3 text-slate-400" />
                                            {entry.number_of_persons || 1}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {entry.occupant_names?.length > 0 ? (
                                                entry.occupant_names.map((name, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs">
                                                        {name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 text-sm">-</span>
                                            )}
                                            {entry.bus_info && /\b(bus|autobus|bus pak)\b/i.test(entry.bus_info) && (
                                                <Badge className="bg-amber-500 text-white text-xs">BUS</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm font-semibold text-blue-600 tabular-nums whitespace-nowrap">
                                        {entry.contract_number || (
                                            <span className="text-slate-400 font-normal">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {entry.contact_phone ? (
                                            <span className="inline-flex items-center gap-1">
                                                <Phone className="w-3 h-3 shrink-0" />
                                                {entry.contact_phone}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-end gap-3 p-4 border-t bg-slate-50">
                    <Button variant="outline" onClick={onCancel} disabled={isImporting}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || missingRoomsFiltered.length > 0}
                        title={
                            missingRoomsFiltered.length > 0
                                ? 'Prvo rešite kuće bez prepoznatih soba'
                                : undefined
                        }
                    >
                        {isImporting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4 mr-2" />
                        )}
                        Import Data
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
