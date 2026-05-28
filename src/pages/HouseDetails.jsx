import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ArrowLeft, DoorOpen, Users, Plus, Edit2, Trash2, Loader2, UserCircle, Lock, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortRoomsByNumber } from '@/lib/roomNumberSort';

const ALL_LOCATIONS = [
    'Sarti', 'Sykia', 'Klimataria', 'Kalamitsi', 'Porto Koufo',
    'Toroni', 'Zaliv Simonitiko', 'Neos Marmaras', 'Nikiti',
    'Metamorfosi', 'Psakoudia', 'Nea Plaja'
];
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl, isHouseAssignedToUser, isUserResponsibleForHouse } from '@/utils';
import RoomCard from '@/components/RoomCard';
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from 'framer-motion';

export default function HouseDetails() {
    const urlParams = new URLSearchParams(window.location.search);
    const houseId = urlParams.get('id');
    const viewScope = urlParams.get('scope') || 'all';
    const filterUserId = urlParams.get('userId');
    const queryClient = useQueryClient();

    const [isEditingHouse, setIsEditingHouse] = useState(false);
    const [isAddingRoom, setIsAddingRoom] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editHouseData, setEditHouseData] = useState({ name: '', address: '', location: '' });
    const [newRoomData, setNewRoomData] = useState({
        room_number: '',
        room_structure: '',
        capacity: 1
    });

    const { data: house, isLoading: houseLoading, error: houseError } = useQuery({
        queryKey: ['house', houseId],
        queryFn: async () => {
            const houses = await base44.entities.House.filter({ id: houseId });
            return houses[0] ?? null;
        },
        enabled: !!houseId
    });

    const { data: rooms, isLoading: roomsLoading, error: roomsError } = useQuery({
        queryKey: ['rooms', houseId],
        queryFn: () => base44.entities.Room.filter({ house_id: houseId }),
        enabled: !!houseId
    });

    const roomList = useMemo(
        () => sortRoomsByNumber(Array.isArray(rooms) ? rooms : []),
        [rooms],
    );

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const { data: assignableUsers = [] } = useQuery({
        queryKey: ['assignableUsers'],
        queryFn: () => base44.entities.User.assignable(),
        enabled: Boolean(currentUser?.can_access_all_houses || String(currentUser?.role || '').toLowerCase() === 'admin'),
    });

    const filterUser = filterUserId
        ? (assignableUsers || []).find((u) => u.id === filterUserId)
        : null;

    const isAdmin = String(currentUser?.role || '').toLowerCase() === 'admin';
    const isUser = currentUser?.role === 'user';
    const canAccessAllHouses = Boolean(currentUser?.can_access_all_houses);
    const memberIds = house?.member_user_ids || [];
    const isHouseMember = currentUser?.id && memberIds.includes(currentUser.id);
    const isResponsible = isUserResponsibleForHouse(house, currentUser);
    const assignedToFilterUser =
        viewScope === 'user' && filterUser && house
            ? isHouseAssignedToUser(house, filterUser)
            : false;
    const isOwnUserFilter =
        viewScope !== 'user' || !filterUserId || filterUserId === currentUser?.id;

    const canEdit =
        isAdmin ||
        (isUser && canAccessAllHouses && viewScope === 'all') ||
        (isUser &&
            canAccessAllHouses &&
            viewScope === 'user' &&
            isOwnUserFilter &&
            assignedToFilterUser) ||
        (isUser && !canAccessAllHouses && (isHouseMember || isResponsible));
    const canDelete = isAdmin;

    const handleEditHouse = () => {
        setEditHouseData({ name: house.name, address: house.address || '', location: house.location || '' });
        setIsEditingHouse(true);
    };

    const handleSaveHouse = async () => {
        setIsSaving(true);
        await base44.entities.House.update(house.id, editHouseData);
        queryClient.invalidateQueries({ queryKey: ['house', houseId] });
        setIsSaving(false);
        setIsEditingHouse(false);
    };

    const handleDeleteHouse = async () => {
        if (!confirm('Da li ste sigurni da želite da obrišete ovu kuću i sve sobe?')) return;
        setIsDeleting(true);

        try {
            await base44.entities.House.delete(house.id);
            queryClient.invalidateQueries({ queryKey: ['houses'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            window.location.href = createPageUrl('Home');
        } catch (error) {
            alert('Greška pri brisanju: ' + error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAddRoom = async () => {
        setIsSaving(true);
        await base44.entities.Room.create({
            ...newRoomData,
            house_id: houseId,
            house_name: house.name,
            current_occupants: 0,
            occupant_names: []
        });
        queryClient.invalidateQueries({ queryKey: ['rooms', houseId] });
        queryClient.invalidateQueries({ queryKey: ['house', houseId] });
        setIsSaving(false);
        setIsAddingRoom(false);
        setNewRoomData({ room_number: '', room_structure: '', capacity: 1 });
    };

    const handleRoomUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['rooms', houseId] });
    };

    const isLoading = houseLoading || roomsLoading;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <Skeleton className="h-8 w-48 mb-6" />
                    <Skeleton className="h-32 w-full mb-8 rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Skeleton key={i} className="h-40 rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (houseError || roomsError) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-8">
                <div className="max-w-md text-center rounded-xl border border-red-200 bg-red-50 p-6">
                    <h2 className="text-lg font-semibold text-red-800 mb-2">Greška pri učitavanju</h2>
                    <p className="text-sm text-red-700">{(houseError || roomsError)?.message}</p>
                    <Link to={createPageUrl('Home')} className="inline-block mt-4">
                        <Button variant="outline">Nazad na početnu</Button>
                    </Link>
                </div>
            </div>
        );
    }

    if (!house) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <Building2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Kuća nije pronađena</h2>
                    <p className="text-slate-500 text-sm mb-4 max-w-md">
                        Nema pristupa ovoj kući ili je obrisana. Admin vidi sve kuće; običan korisnik samo dodeljene.
                        Vratite se i otvorite kuću iz liste (Sarti / Toroni / Sve kuće).
                    </p>
                    <Link to={createPageUrl('Home')}>
                        <Button variant="outline">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Nazad na početnu
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    const totalOccupants = roomList.reduce((sum, r) => sum + (r.current_occupants || 0), 0);
    const totalCapacity = roomList.reduce((sum, r) => sum + (r.capacity || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-4 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Houses
                    </Link>

                    <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                                        <Building2 className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl font-bold text-slate-800">{house.name}</h1>
                                        {house.address && (
                                            <p className="text-slate-500">{house.address}</p>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap mt-1">
                                            {house.location && (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                                    <MapPin className="w-3 h-3 mr-1" />
                                                    {house.location}
                                                </Badge>
                                            )}
                                            {house.responsible_person && (
                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                                    <UserCircle className="w-3 h-3 mr-1" />
                                                    {house.responsible_person}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {canEdit ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" onClick={handleEditHouse}>
                                            <Edit2 className="w-4 h-4 mr-2" />
                                            Izmeni kuću
                                        </Button>
                                        {canDelete && (
                                            <Button variant="outline" onClick={handleDeleteHouse} disabled={isDeleting} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                                Obriši
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-2 rounded-lg">
                                        <Lock className="w-4 h-4" />
                                        <span className="text-sm">View only</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <DoorOpen className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                                    <div className="text-2xl font-bold text-slate-800">{rooms?.length || 0}</div>
                                    <div className="text-sm text-slate-500">Rooms</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <Users className="w-5 h-5 text-green-500 mx-auto mb-1" />
                                    <div className="text-2xl font-bold text-green-600">{totalOccupants}</div>
                                    <div className="text-sm text-slate-500">Occupants</div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-4 text-center">
                                    <Users className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                                    <div className="text-2xl font-bold text-blue-600">{totalCapacity}</div>
                                    <div className="text-sm text-slate-500">Total Capacity</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Rooms Section */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-blue-700 flex items-center gap-2">
                        <DoorOpen className="w-5 h-5 text-blue-600" />
                        Rooms ({roomList.length})
                    </h2>
                    {canEdit && (
                        <Button onClick={() => setIsAddingRoom(true)} className="bg-gradient-to-r from-blue-500 to-blue-600">
                            <Plus className="w-4 h-4 mr-2" />
                            Dodaj sobu
                        </Button>
                    )}
                </div>

                {roomList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                        {roomList.map((room, index) => (
                            <motion.div
                                key={room.id}
                                className="h-full"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <RoomCard
                                    room={room}
                                    onUpdate={handleRoomUpdate}
                                    onDelete={handleRoomUpdate}
                                    canEdit={canEdit}
                                    canDelete={canDelete}
                                />
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <DoorOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">Još nema soba</h3>
                        <p className="text-slate-500 mb-4">Dodajte sobu ručno ako nije u rooming listi</p>
                        {canEdit && (
                            <Button onClick={() => setIsAddingRoom(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Dodaj prvu sobu
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Edit House Dialog */}
            <Dialog open={isEditingHouse} onOpenChange={setIsEditingHouse}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit House</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="houseName">House Name</Label>
                            <Input
                                id="houseName"
                                value={editHouseData.name}
                                onChange={(e) => setEditHouseData({...editHouseData, name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="houseAddress">Address</Label>
                            <Input
                                id="houseAddress"
                                value={editHouseData.address}
                                onChange={(e) => setEditHouseData({...editHouseData, address: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="houseLocation">Lokacija</Label>
                            <Select value={editHouseData.location} onValueChange={(val) => setEditHouseData({...editHouseData, location: val})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Izaberi lokaciju..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {ALL_LOCATIONS.map(loc => (
                                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingHouse(false)}>Cancel</Button>
                        <Button onClick={handleSaveHouse} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Room Dialog */}
            <Dialog open={isAddingRoom} onOpenChange={setIsAddingRoom}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj sobu</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="roomNumber">Broj sobe</Label>
                            <Input
                                id="roomNumber"
                                value={newRoomData.room_number}
                                onChange={(e) => setNewRoomData({...newRoomData, room_number: e.target.value})}
                                placeholder="npr. 101, B3, A1"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="roomStructure">Struktura sobe</Label>
                            <Input
                                id="roomStructure"
                                value={newRoomData.room_structure}
                                onChange={(e) => setNewRoomData({...newRoomData, room_structure: e.target.value})}
                                placeholder="e.g., Single, Double, Suite"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="roomCapacity">Capacity</Label>
                            <Input
                                id="roomCapacity"
                                type="number"
                                min="1"
                                value={newRoomData.capacity}
                                onChange={(e) => setNewRoomData({...newRoomData, capacity: parseInt(e.target.value) || 1})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingRoom(false)}>Otkaži</Button>
                        <Button onClick={handleAddRoom} disabled={isSaving || !newRoomData.room_number}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sačuvaj
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}