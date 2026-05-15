import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Building2, Upload, Search, LayoutGrid, List, Users, Trash2, CheckSquare, Square, ArrowLeft, FileDown } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import FileUploader from '@/components/FileUploader';
import ExtractedDataPreview from '@/components/ExtractedDataPreview';
import HouseCard from '@/components/HouseCard';
import LocationFolder from '@/components/LocationFolder';
import { motion, AnimatePresence } from 'framer-motion';

const ALL_LOCATIONS = [
    'Sarti', 'Sykia', 'Klimataria', 'Kalamitsi', 'Porto Koufo',
    'Toroni', 'Zaliv Simonitiko', 'Neos Marmaras', 'Nikiti',
    'Metamorfosi', 'Psakoudia', 'Nea Plaja'
];

export default function Home() {
    const [showUploader, setShowUploader] = useState(false);
    const [extractedData, setExtractedData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [filterByUser, setFilterByUser] = useState('all');
    const [selectedHouses, setSelectedHouses] = useState(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const queryClient = useQueryClient();

    const { data: houses, isLoading: housesLoading } = useQuery({
        queryKey: ['houses'],
        queryFn: () => base44.entities.House.list('-created_date'),
    });

    const { data: rooms, isLoading: roomsLoading } = useQuery({
        queryKey: ['rooms'],
        queryFn: () => base44.entities.Room.list('-created_date'),
    });

    const handleDataExtracted = (data) => {
        setExtractedData(data);
    };

    const handleImportComplete = () => {
        setExtractedData(null);
        setShowUploader(false);
        queryClient.invalidateQueries({ queryKey: ['houses'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
    };

    const getRoomsForHouse = (houseId) => {
        return (rooms || []).filter(room => room.house_id === houseId);
    };

    const responsiblePersons = [...new Set((houses || []).map(h => h.responsible_person).filter(Boolean))];
    
    const getUserColor = (person) => {
        if (!person) return 'slate';
        const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'cyan', 'indigo', 'rose'];
        const index = responsiblePersons.indexOf(person) % colors.length;
        return colors[index];
    };

    const filteredHouses = (houses || []).filter(house => {
        const query = searchQuery.toLowerCase();
        const houseNameMatch = house.name.toLowerCase().includes(query);
        
        const houseRooms = getRoomsForHouse(house.id);
        const guestNameMatch = houseRooms.some(room => 
            room.occupant_names?.some(name => name.toLowerCase().includes(query))
        );
        
        const userMatch = filterByUser === 'all' || house.responsible_person === filterByUser;
        const locationMatch = !selectedLocation || house.location === selectedLocation;
        
        return (houseNameMatch || guestNameMatch) && userMatch && locationMatch;
    });

    // Stats per location
    const getLocationStats = (location) => {
        const locationHouses = (houses || []).filter(h => h.location === location);
        const locationRooms = locationHouses.flatMap(h => getRoomsForHouse(h.id));
        return {
            houses: locationHouses.length,
            rooms: locationRooms.length,
            occupants: locationRooms.reduce((sum, r) => sum + (r.current_occupants || 0), 0)
        };
    };

    // Locations that actually have houses
    const activeLocations = ALL_LOCATIONS.filter(loc => 
        (houses || []).some(h => h.location === loc)
    );

    const isLoading = housesLoading || roomsLoading;

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
        const locationHouses = (houses || []).filter(h => h.location === location);
        
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
            const deletePromises = [];
            for (const houseId of selectedHouses) {
                const houseRooms = getRoomsForHouse(houseId);
                for (const room of houseRooms) {
                    deletePromises.push(base44.entities.Room.delete(room.id));
                }
                deletePromises.push(base44.entities.House.delete(houseId));
            }

            await Promise.all(deletePromises);
            setSelectedHouses(new Set());
            queryClient.invalidateQueries({ queryKey: ['houses'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
        } catch (error) {
            alert('Error deleting: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                            <Link to={createPageUrl('UserManagement')}>
                                <Button variant="outline">
                                    <Users className="w-4 h-4 mr-2" />
                                    User Management
                                </Button>
                            </Link>
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
                        <Select value={filterByUser} onValueChange={setFilterByUser}>
                            <SelectTrigger className="w-48 bg-white">
                                <SelectValue placeholder="Filter by user" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {responsiblePersons.map(person => (
                                    <SelectItem key={person} value={person}>{person}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                    
                    {filteredHouses.length > 0 && (
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
                                Select All ({filteredHouses.length})
                            </Button>
                            {selectedHouses.size > 0 && (
                                <>
                                    <span className="text-sm text-slate-500">
                                        {selectedHouses.size} selected
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
                            <FileUploader onDataExtracted={handleDataExtracted} />
                            
                            {extractedData && (
                                <ExtractedDataPreview
                                    data={extractedData}
                                    onImportComplete={handleImportComplete}
                                    onCancel={() => setExtractedData(null)}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Location Folders */}
                {!isLoading && !searchQuery && !selectedLocation && houses && houses.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-slate-700 mb-4">Lokacije</h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {ALL_LOCATIONS.map(location => {
                                const stats = getLocationStats(location);
                                return (
                                    <LocationFolder
                                        key={location}
                                        location={location}
                                        houses={stats.houses}
                                        totalRooms={stats.rooms}
                                        totalOccupants={stats.occupants}
                                        onClick={stats.houses > 0 ? () => setSelectedLocation(location) : undefined}
                                        isSelected={false}
                                    />
                                );
                            })}
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
                        <h2 className="text-xl font-bold text-slate-800">{selectedLocation}</h2>
                        <span className="text-slate-500 text-sm">— {filteredHouses.length} {filteredHouses.length === 1 ? 'kuća' : 'kuće/kuća'}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportXML(selectedLocation)}
                            className="ml-auto gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                            <FileDown className="w-4 h-4" />
                            Izvezi XML (smena)
                        </Button>
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
                                <HouseCard
                                    house={house}
                                    rooms={getRoomsForHouse(house.id)}
                                    userColor={getUserColor(house.responsible_person)}
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
                            {searchQuery ? 'No houses found' : 'No houses yet'}
                        </h3>
                        <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                            {searchQuery 
                                ? 'Try a different search term'
                                : 'Upload a PDF file to import house and room data automatically'}
                        </p>
                        {!searchQuery && (
                            <Button 
                                onClick={() => setShowUploader(true)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600"
                            >
                                <Upload className="w-4 h-4 mr-2" />
                                Import from PDF
                            </Button>
                        )}
                    </div>
                )}

                {/* Stats Footer */}
                {houses && houses.length > 0 && (
                    <div className="mt-12 pt-8 border-t border-slate-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-slate-800">{houses.length}</div>
                                <div className="text-sm text-slate-500">Total Houses</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-slate-800">{rooms?.length || 0}</div>
                                <div className="text-sm text-slate-500">Total Rooms</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-green-600">
                                    {rooms?.filter(r => r.current_occupants > 0).length || 0}
                                </div>
                                <div className="text-sm text-slate-500">Occupied Rooms</div>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                                <div className="text-3xl font-bold text-blue-600">
                                    {rooms?.reduce((sum, r) => sum + (r.current_occupants || 0), 0) || 0}
                                </div>
                                <div className="text-sm text-slate-500">Total Occupants</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}