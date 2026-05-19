import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Building2, Upload, Search, LayoutGrid, List, Users, Trash2, CheckSquare, Square, ArrowLeft, FileDown, Plus, Loader2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from 'react-router-dom';
import { createPageUrl, isHouseAssignedToUserId, userDisplayName } from '@/utils';
import FileUploader from '@/components/FileUploader';
import ExtractedDataPreview from '@/components/ExtractedDataPreview';
import HouseCard from '@/components/HouseCard';
import LocationFolder from '@/components/LocationFolder';
import { motion, AnimatePresence } from 'framer-motion';
import ErrorBoundary from '@/lib/ErrorBoundary';

const ALL_LOCATIONS = [
    'Sarti', 'Sykia', 'Klimataria', 'Kalamitsi', 'Porto Koufo',
    'Toroni', 'Zaliv Simonitiko', 'Neos Marmaras', 'Nikiti',
    'Metamorfosi', 'Psakoudia', 'Nea Plaja'
];

function getHouseName(house) {
    return (house?.name ?? 'Bez naziva').toString();
}

function getOccupantNames(room) {
    const raw = room?.occupant_names;
    if (Array.isArray(raw)) return raw.filter((n) => n != null && String(n).trim());
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : raw.trim() ? [raw] : [];
        } catch {
            return raw.trim() ? [raw] : [];
        }
    }
    return [];
}

export default function Home() {
    const [showUploader, setShowUploader] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [filterByUser, setFilterByUser] = useState('all');
    const [selectedHouses, setSelectedHouses] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [importTargetLocation, setImportTargetLocation] = useState('');
    const [isAddingHouse, setIsAddingHouse] = useState(false);
    const [isSavingHouse, setIsSavingHouse] = useState(false);
    const [newHouseData, setNewHouseData] = useState({ name: '', address: '', location: '' });
    const queryClient = useQueryClient();

    const effectiveImportLocation = selectedLocation || importTargetLocation || null;

    const { data: houses, isLoading: housesLoading, error: housesError } = useQuery({
        queryKey: ['houses'],
        queryFn: () => base44.entities.House.list('-created_date'),
    });

    const { data: rooms, isLoading: roomsLoading, error: roomsError } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => base44.entities.Room.list('-created_date'),
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const isAdmin = currentUser?.role === 'admin';
    const isViewer = currentUser?.role === 'viewer';
    const canManageHouses = !isViewer;
    const canAccessAllHouses = Boolean(currentUser?.can_access_all_houses);
    const canFilterByAllUsers = isAdmin || canAccessAllHouses;

    const { data: assignableUsers = [] } = useQuery({
        queryKey: ['assignableUsers'],
        queryFn: () => base44.entities.User.assignable(),
        enabled: canFilterByAllUsers,
    });

    const filterUser =
        filterByUser === 'all'
            ? null
            : (assignableUsers || []).find((u) => u.id === filterByUser) || null;

    const houseScope =
        filterByUser === 'all' ? 'all' : `user&userId=${encodeURIComponent(filterByUser)}`;

    const houseList = Array.isArray(houses) ? houses : [];
    const roomList = Array.isArray(rooms) ? rooms : [];

    const handleDataExtracted = (payload) => {
        const rawEntries = payload?.entries ?? (Array.isArray(payload) ? payload : []);
        const entries = Array.isArray(rawEntries) ? rawEntries : [];
        setExtractedData({
            entries,
            location: effectiveImportLocation || payload?.location || null,
            hotels: payload?.hotels ?? [],
            hotelsMissingRooms: payload?.hotelsMissingRooms ?? [],
        });
    };

    const handleImportComplete = () => {
        const importedLocation = extractedData?.location || effectiveImportLocation;
        setExtractedData(null);
        setShowUploader(false);
        queryClient.invalidateQueries({ queryKey: ['houses'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        if (importedLocation) {
            setSelectedLocation(importedLocation);
        }
    };

    const getRoomsForHouse = (houseId) => {
        return roomList.filter((room) => room.house_id === houseId);
    };

    const openAddHouseDialog = () => {
        const loc =
            selectedLocation && selectedLocation !== '__unlocated__'
                ? selectedLocation
                : '';
        setNewHouseData({ name: '', address: '', location: loc });
        setIsAddingHouse(true);
    };

    const handleAddHouse = async () => {
        const name = newHouseData.name.trim();
        if (!name) return;
        const location =
            selectedLocation && selectedLocation !== '__unlocated__'
                ? selectedLocation
                : newHouseData.location.trim() || null;
        if (!location) {
            alert('Izaberite lokaciju za kuću.');
            return;
        }
        setIsSavingHouse(true);
        try {
            await base44.entities.House.create({
                name,
                address: newHouseData.address.trim() || undefined,
                location,
                total_rooms: 0,
                total_capacity: 0,
            });
            queryClient.invalidateQueries({ queryKey: ['houses'] });
            setIsAddingHouse(false);
            setNewHouseData({ name: '', address: '', location: '' });
            if (!selectedLocation) setSelectedLocation(location);
        } catch (e) {
            alert(e.message || 'Kuća nije dodata');
        } finally {
            setIsSavingHouse(false);
        }
    };

    /** Kuće nakon filtera po korisniku (pretraga i lokacija idu posle). */
    const userFilteredHouses = houseList.filter((house) => {
        if (!house?.id) return false;
        if (filterByUser === 'all') return true;
        if (!canFilterByAllUsers) return true;
        return isHouseAssignedToUserId(house, filterByUser, filterUser);
    });

    const responsiblePersons = [...new Set(userFilteredHouses.map((h) => h.responsible_person).filter(Boolean))];
    
    const getUserColor = (person) => {
        if (!person) return 'slate';
        const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'cyan', 'indigo', 'rose'];
        const index = responsiblePersons.indexOf(person);
        if (index < 0) return 'slate';
        return colors[index % colors.length];
    };

    const openLocation = (location) => {
        setSelectedLocation(location);
        setShowUploader(false);
        setExtractedData(null);
        setSelectedHouses(new Set());
    };

    const filteredHouses = userFilteredHouses.filter((house) => {
        const query = searchQuery.toLowerCase().trim();
        const houseNameMatch = getHouseName(house).toLowerCase().includes(query);

        const houseRooms = getRoomsForHouse(house.id);
        const guestNameMatch = houseRooms.some((room) =>
            getOccupantNames(room).some((name) =>
                String(name).toLowerCase().includes(query)
            )
        );

        const loc = (house.location || '').trim();
        const locationMatch =
            !selectedLocation ||
            (selectedLocation === '__unlocated__'
                ? !loc || !ALL_LOCATIONS.includes(loc)
                : loc === selectedLocation);

        return (houseNameMatch || guestNameMatch) && locationMatch;
    });

    const getLocationStats = (location) => {
        const locationHouses = userFilteredHouses.filter(
            (h) => (h.location || '').trim() === location
        );
        const locationRooms = locationHouses.flatMap((h) => getRoomsForHouse(h.id));
        return {
            houses: locationHouses.length,
            rooms: locationRooms.length,
            occupants: locationRooms.reduce((sum, r) => sum + (r.current_occupants || 0), 0)
        };
    };

    const activeLocations = ALL_LOCATIONS.filter((loc) =>
        userFilteredHouses.some((h) => (h.location || '').trim() === loc)
    );

    const housesWithoutLocation = userFilteredHouses.filter((h) => {
        const loc = (h.location || '').trim();
        return !loc || !ALL_LOCATIONS.includes(loc);
    });

    const isLoading = housesLoading || roomsLoading;
    const loadError = housesError || roomsError;

    const toggleSelectAll = () => {
        if (selectedHouses.size === filteredHouses.length) {
            setSelectedHouses(new Set());
        } else {
            setSelectedHouses(new Set(filteredHouses.map(h => h.id)));
        }
    };

    const toggleSelectHouse = (houseId) => {
        const newSelected = new Set(selectedHouses);
        if (newSelected.has(houseId)) {
            newSelected.delete(houseId);
        } else {
            newSelected.add(houseId);
        }
        setSelectedHouses(newSelected);
    };

    const handleExportXML = (location) => {
        const locationHouses = userFilteredHouses.filter(
            (h) => (h.location || '').trim() === location
        );
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<export lokacija="${location}" datum="${new Date().toISOString().slice(0, 10)}">\n`;

        for (const house of locationHouses) {
            const houseRooms = getRoomsForHouse(house.id);
            xml += `  <kuca id="${house.id}" naziv="${house.name || ''}" adresa="${house.address || ''}" odgovornaOsoba="${house.responsible_person || ''}">\n`;
            for (const room of houseRooms) {
                xml += `    <soba broj="${room.room_number || ''}" struktura="${room.room_structure || ''}" kapacitet="${room.capacity || ''}" trenutnoGostiju="${room.current_occupants || 0}">\n`;
                if (room.occupant_names && room.occupant_names.length > 0) {
                    xml += `      <gosti>\n`;
                    for (const name of room.occupant_names) {
                        xml += `        <gost>${name}</gost>\n`;
                    }
                    xml += `      </gosti>\n`;
                }
                xml += `      <boravakOd>${room.stay_from || ''}</boravakOd>\n`;
                xml += `      <boravakDo>${room.stay_to || ''}</boravakDo>\n`;
                xml += `      <ekskurzija>${room.excursion || ''}</ekskurzija>\n`;
                xml += `      <poseta>${room.visit || ''}</poseta>\n`;
                xml += `      <autobus>${room.bus ? 'da' : 'ne'}</autobus>\n`;
                xml += `      <porezPlacen>${room.tax_paid ? 'da' : 'ne'}</porezPlacen>\n`;
                if (room.notes) xml += `      <napomene>${room.notes}</napomene>\n`;
                xml += `    </soba>\n`;
            }
            xml += `  </kuca>\n`;
        }

        xml += `</export>`;

        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${location}_smena_${new Date().toISOString().slice(0, 10)}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteSelected = async () => {
        if (selectedHouses.size === 0) return;

        const count = selectedHouses.size;
        const confirmed = confirm(`Are you sure you want to delete ${count} house(s) and all their rooms?`);
        if (!confirmed) return;

        setIsDeleting(true);

        try {
            for (const houseId of selectedHouses) {
                await base44.entities.House.delete(houseId);
            }
            setSelectedHouses(new Set());
            await queryClient.invalidateQueries({ queryKey: ['houses'] });
            await queryClient.invalidateQueries({ queryKey: ['rooms'] });
        } catch (error) {
            alert('Greška pri brisanju: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <ErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loadError && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <p className="font-medium">Greška pri učitavanju podataka</p>
                        <p className="mt-1">{loadError.message}</p>
                        <p className="mt-2 text-red-700">Restartujte API, pa uradite Ctrl+F5.</p>
                    </div>
                )}
                {/* Header */}
                <div className="mb-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <Link to="/">
                                <Button variant="ghost" size="icon" className="rounded-full hover:bg-white shadow-sm border border-slate-200">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <Building2 className="w-5 h-5 text-white" />
                                    </div>
                                    Room Manager
                                </h1>
                                <p className="text-slate-500 mt-1">
                                    Organize and manage your houses and rooms
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {isAdmin && (
                                <Link to={createPageUrl('UserManagement')}>
                                    <Button variant="outline">
                                        <Users className="w-4 h-4 mr-2" />
                                        Korisnici
                                    </Button>
                                </Link>
                            )}
                            <Button 
                                onClick={() => setShowUploader(!showUploader)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Import from PDF
                            </Button>
                        </div>
                    </div>

                    {/* Search and View Toggle */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search houses or guests..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white border-slate-200"
                            />
                        </div>
                        {canFilterByAllUsers && (
                            <Select value={filterByUser} onValueChange={setFilterByUser}>
                                <SelectTrigger className="w-52 bg-white">
                                    <SelectValue placeholder="Filter po korisniku" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Svi korisnici</SelectItem>
                                    {(assignableUsers || []).map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {userDisplayName(user)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1">
                            <Button
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="icon"
                                onClick={() => setViewMode('list')}
                            >
                                <List className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    
                    {isAdmin && (selectedLocation || searchQuery) && filteredHouses.length > 0 && (
                        <div className="flex items-center gap-2 mt-4 bg-white border border-slate-200 rounded-lg p-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleSelectAll}
                                className="gap-2"
                            >
                                {selectedHouses.size === filteredHouses.length ? (
                                    <CheckSquare className="w-4 h-4" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                Izaberi sve ({filteredHouses.length})
                            </Button>
                            {selectedHouses.size > 0 && (
                                <>
                                    <span className="text-sm text-slate-500">
                                        {selectedHouses.size} izabrano
                                    </span>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteSelected}
                                        disabled={isDeleting}
                                        className="ml-auto gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Obriši ({selectedHouses.size})
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Upload Section */}
                <AnimatePresence>
                    {showUploader && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-8"
                        >
                            {(selectedLocation || importTargetLocation) && (
                                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-4">
                                    Import ide u lokaciju:{' '}
                                    <strong>{selectedLocation || importTargetLocation}</strong>
                                </p>
                            )}
                            {!selectedLocation && (
                                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                                    <span className="text-sm text-slate-600 shrink-0">Lokacija za import:</span>
                                    <Select
                                        value={importTargetLocation || '_none'}
                                        onValueChange={(v) => setImportTargetLocation(v === '_none' ? '' : v)}
                                    >
                                        <SelectTrigger className="bg-white max-w-xs">
                                            <SelectValue placeholder="Izaberi lokaciju (npr. Toroni)..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_none">— automatski iz PDF-a —</SelectItem>
                                            {ALL_LOCATIONS.map((loc) => (
                                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <FileUploader
                                onDataExtracted={handleDataExtracted}
                                defaultLocation={effectiveImportLocation}
                            />
                            
                            {extractedData && (
                                <ExtractedDataPreview
                                    data={extractedData}
                                    importLocation={effectiveImportLocation || extractedData.location}
                                    onImportComplete={handleImportComplete}
                                    onCancel={() => setExtractedData(null)}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Location Folders */}
                {!isLoading && !searchQuery && !selectedLocation && userFilteredHouses.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Lokacije</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {activeLocations.map((location) => {
                                const stats = getLocationStats(location);
                                return (
                                    <LocationFolder
                                        key={location}
                                        location={location}
                                        houses={stats.houses}
                                        totalRooms={stats.rooms}
                                        totalOccupants={stats.occupants}
                                        onClick={() => openLocation(location)}
                                        isSelected={false}
                                    />
                                );
                            })}
                            {housesWithoutLocation.length > 0 && (
                                <LocationFolder
                                    key="__unlocated__"
                                    location="Bez lokacije"
                                    houses={housesWithoutLocation.length}
                                    totalRooms={housesWithoutLocation.reduce(
                                        (n, h) => n + getRoomsForHouse(h.id).length,
                                        0,
                                    )}
                                    totalOccupants={housesWithoutLocation.reduce(
                                        (n, h) =>
                                            n +
                                            getRoomsForHouse(h.id).reduce(
                                                (s, r) => s + (r.current_occupants || 0),
                                                0,
                                            ),
                                        0,
                                    )}
                                    onClick={() => {
                                        setSelectedLocation('__unlocated__');
                                        setSelectedHouses(new Set());
                                    }}
                                    isSelected={false}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Selected location header */}
                {selectedLocation && (
                    <div className="flex items-center gap-3 mb-6 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSelectedLocation(null);
                                setSelectedHouses(new Set());
                            }}
                            className="gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Nazad
                        </Button>
                        <h2 className="text-xl font-bold text-slate-800">
                            {selectedLocation === '__unlocated__' ? 'Bez lokacije' : selectedLocation}
                        </h2>
                        <span className="text-slate-500 text-sm">— {filteredHouses.length} {filteredHouses.length === 1 ? 'kuća' : 'kuće/kuća'}</span>
                        <motion.div className="ml-auto flex flex-wrap gap-2">
                            {canManageHouses && (
                                <Button
                                    size="sm"
                                    onClick={openAddHouseDialog}
                                    className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600"
                                >
                                    <Plus className="w-4 h-4" />
                                    Dodaj kuću
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportXML(selectedLocation)}
                                className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                                <FileDown className="w-4 h-4" />
                                Izvezi XML (smena)
                            </Button>
                        </motion.div>
                    </div>
                )}

                {/* Houses Grid */}
                {(!selectedLocation && !searchQuery) ? null : isLoading ? (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Skeleton className="w-12 h-12 rounded-xl" />
                                    <div>
                                        <Skeleton className="h-5 w-32 mb-1" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <Skeleton className="h-10 flex-1 rounded-lg" />
                                    <Skeleton className="h-10 flex-1 rounded-lg" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredHouses.length > 0 ? (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {filteredHouses.map(house => (
                            <div key={house.id} className="relative">
                                {isAdmin && (
                                <div
                                    className="absolute top-3 left-3 z-10 cursor-pointer"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleSelectHouse(house.id);
                                    }}
                                >
                                    {selectedHouses.has(house.id) ? (
                                        <CheckSquare className="w-6 h-6 text-blue-600 bg-white rounded shadow-md" />
                                    ) : (
                                        <Square className="w-6 h-6 text-slate-400 bg-white rounded shadow-md hover:text-blue-600" />
                                    )}
                                </div>
                                )}
                                <HouseCard
                                    house={house}
                                    rooms={getRoomsForHouse(house.id)}
                                    userColor={getUserColor(house.responsible_person)}
                                    detailsScope={houseScope}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Building2 className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-800 mb-2">
                            {searchQuery ? 'Nema rezultata' : 'Nema kuća na ovoj lokaciji'}
                        </h3>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                            {searchQuery
                                ? 'Probajte drugi pojam za pretragu'
                                : 'Uvezite rooming listu (PDF) ili dodajte kuću ručno ako nije u listi'}
                        </p>
                        {!searchQuery && selectedLocation && (
                            <div className="flex flex-wrap justify-center gap-3">
                                {canManageHouses && (
                                    <Button
                                        onClick={openAddHouseDialog}
                                        className="bg-gradient-to-r from-blue-500 to-blue-600"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Dodaj kuću
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => setShowUploader(true)}
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Uvezi PDF
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Stats Footer */}
                {houseList.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-slate-800">{houseList.length}</div>
                                <div className="text-sm text-slate-500">Total Houses</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-slate-800">{roomList.length}</div>
                                <div className="text-sm text-slate-500">Total Rooms</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-green-600">
                                    {roomList.filter((r) => r.current_occupants > 0).length}
                                </div>
                                <div className="text-sm text-slate-500">Occupied Rooms</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-blue-600">
                                    {roomList.reduce((sum, r) => sum + (r.current_occupants || 0), 0)}
                                </div>
                                <div className="text-sm text-slate-500">Total Occupants</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={isAddingHouse} onOpenChange={setIsAddingHouse}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj kuću</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="newHouseName">Naziv kuće</Label>
                            <Input
                                id="newHouseName"
                                value={newHouseData.name}
                                onChange={(e) => setNewHouseData({ ...newHouseData, name: e.target.value })}
                                placeholder="npr. Flora, Duvas"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newHouseAddress">Adresa (opciono)</Label>
                            <Input
                                id="newHouseAddress"
                                value={newHouseData.address}
                                onChange={(e) => setNewHouseData({ ...newHouseData, address: e.target.value })}
                            />
                        </div>
                        {(!selectedLocation || selectedLocation === '__unlocated__') && (
                            <div className="space-y-2">
                                <Label>Lokacija</Label>
                                <Select
                                    value={newHouseData.location}
                                    onValueChange={(val) => setNewHouseData({ ...newHouseData, location: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Izaberite lokaciju..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALL_LOCATIONS.map((loc) => (
                                            <SelectItem key={loc} value={loc}>
                                                {loc}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {selectedLocation && selectedLocation !== '__unlocated__' && (
                            <p className="text-sm text-slate-500">
                                Lokacija: <span className="font-medium text-slate-700">{selectedLocation}</span>
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingHouse(false)}>
                            Otkaži
                        </Button>
                        <Button
                            onClick={handleAddHouse}
                            disabled={isSavingHouse || !newHouseData.name.trim()}
                        >
                            {isSavingHouse && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sačuvaj
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </ErrorBoundary>
    );
}