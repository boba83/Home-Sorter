import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '@/api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, Edit2, ArrowLeft, Loader2, Trash2, UserPlus, Shield, User, Copy, KeyRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function UserManagement() {
    const queryClient = useQueryClient();
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedHouse, setSelectedHouse] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    
    // User management states
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userFormData, setUserFormData] = useState({
        first_name: '',
        last_name: '',
        role: 'user',
        can_access_all_houses: false,
    });
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserForm, setNewUserForm] = useState({
        email: '',
        first_name: '',
        last_name: '',
        role: 'user',
    });
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [adminTempPassword, setAdminTempPassword] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);

    const { data: houses, isLoading } = useQuery({
        queryKey: ['houses'],
        queryFn: () => base44.entities.House.list('-created_date'),
    });

    const { data: users, isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => base44.entities.User.list('-created_date'),
    });

    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    const isAdmin = currentUser?.role === 'admin';

    if (currentUser && !isAdmin) {
        return <Navigate to={createPageUrl('Home')} replace />;
    }

    const handleAssign = (house) => {
        setSelectedHouse(house);
        setSelectedMemberIds(house.member_user_ids || []);
        setIsAssigning(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await api.houses.setMembers(selectedHouse.id, selectedMemberIds);
        queryClient.invalidateQueries({ queryKey: ['houses'] });
        setIsSaving(false);
        setIsAssigning(false);
    };

    const getHousesByUserId = (userId) => {
        return (houses || []).filter(h => (h.member_user_ids || []).includes(userId));
    };

    const handleCreateUser = async () => {
        if (!newUserForm.email.trim()) return;
        setIsSaving(true);
        setCreatedCredentials(null);
        try {
            const result = await base44.entities.User.createAccount({
                email: newUserForm.email.trim(),
                role: newUserForm.role,
                can_access_all_houses: newUserForm.role !== 'admin' && newUserForm.can_access_all_houses,
                first_name: newUserForm.first_name.trim() || undefined,
                last_name: newUserForm.last_name.trim() || undefined,
            });
            setCreatedCredentials({
                email: result.user?.email || newUserForm.email.trim(),
                temporary_password: result.temporary_password,
            });
            setNewUserForm({ email: '', first_name: '', last_name: '', role: 'user', can_access_all_houses: false });
            queryClient.invalidateQueries({ queryKey: ['users'] });
        } catch (e) {
            alert(e.message || 'Korisnik nije kreiran');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdminResetPassword = async () => {
        if (!selectedUser?.id) return;
        if (!confirm(`Generisati novu privremenu lozinku za ${selectedUser.email}?`)) return;
        setIsSaving(true);
        setAdminTempPassword('');
        try {
            const result = await base44.entities.User.resetPassword(selectedUser.id);
            setAdminTempPassword(result.temporary_password || '');
        } catch (e) {
            alert(e.message || 'Lozinka nije promenjena');
        } finally {
            setIsSaving(false);
        }
    };

    const roleBadgeClass = (role) => {
        if (role === 'admin') return 'bg-purple-100 text-purple-700 border-purple-200';
        if (role === 'viewer') return 'bg-amber-100 text-amber-800 border-amber-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const userLabel = (user) => {
        const parts = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
        return parts || user?.full_name || user?.email || '-';
    };

    const houseRoomCount = (h) => Number(h?.total_rooms) || 0;

    /** Pravilni oblik: 1 soba, 2–4 sobe (osim 12–14), inače soba */
    const roomsWordSr = (n) => {
        const x = Math.abs(Number(n)) || 0;
        if (x === 1) return 'soba';
        const mod10 = x % 10;
        const mod100 = x % 100;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return 'sobe';
        return 'soba';
    };

    /** 1 kuća, 2–4 kuće (osim 12–14), inače kuća */
    const housesWordSr = (n) => {
        const x = Math.abs(Number(n)) || 0;
        if (x === 1) return 'kuća';
        const mod10 = x % 10;
        const mod100 = x % 100;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) return 'kuće';
        return 'kuća';
    };

    const houseLabelWithRooms = (h) => {
        const n = houseRoomCount(h);
        const name = h?.name || '—';
        return `${name} (${n} ${roomsWordSr(n)})`;
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setAdminTempPassword('');
        setUserFormData({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            role: user.role || 'user',
            can_access_all_houses: Boolean(user.can_access_all_houses),
        });
        setIsEditingUser(true);
    };

    const handleSaveUser = async () => {
        setIsSaving(true);
        await base44.entities.User.update(selectedUser.id, {
            ...userFormData,
            can_access_all_houses:
                userFormData.role === 'admin' ? false : Boolean(userFormData.can_access_all_houses),
        });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        setIsSaving(false);
        setIsEditingUser(false);
    };

    const handleDeleteUser = async (userId) => {
        if (!confirm('Are you sure you want to delete this user?')) return;
        await base44.entities.User.delete(userId);
        queryClient.invalidateQueries({ queryKey: ['users'] });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-500 hover:text-slate-700 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Houses
                </Link>

                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        User Management
                    </h1>
                    <p className="text-slate-500 mt-1">Manage users and assign responsible persons to houses</p>
                </div>

                <Tabs defaultValue="users" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="users" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Users
                        </TabsTrigger>
                        <TabsTrigger value="assignments" className="flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            House Assignments
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users">
                        {/* Users Table */}
                        <Card className="border-slate-200">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-purple-500" />
                                        All Users
                                    </CardTitle>
                                    <Button size="sm" onClick={() => { setCreatedCredentials(null); setIsAddingUser(true); }}>
                                        <UserPlus className="w-4 h-4 mr-1" />
                                        Dodaj korisnika
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ime</TableHead>
                                            <TableHead>Prezime</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Prikazano kao</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Broj dodela</TableHead>
                                            {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {usersLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </TableCell>
                                            </TableRow>
                                        ) : users?.length > 0 ? (
                                            users.map(user => {
                                                const userHouses = getHousesByUserId(user.id);
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell className="font-medium">{user.first_name || '—'}</TableCell>
                                                        <TableCell className="font-medium">{user.last_name || '—'}</TableCell>
                                                        <TableCell className="text-slate-500">{user.email}</TableCell>
                                                        <TableCell className="text-slate-600 text-sm">{userLabel(user)}</TableCell>
                                                        <TableCell>
                                                            <Badge className={roleBadgeClass(user.role)}>
                                                                <Shield className="w-3 h-3 mr-1" />
                                                                {user.role || 'user'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {userHouses.length > 0 ? (
                                                                <span className="text-slate-600 text-sm tabular-nums">
                                                                    {userHouses.length} {housesWordSr(userHouses.length)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">—</span>
                                                            )}
                                                        </TableCell>
                                                        {isAdmin && (
                                                            <TableCell>
                                                                <div className="flex gap-1">
                                                                    <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                                                                        <Edit2 className="w-4 h-4 text-slate-400" />
                                                                    </Button>
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        onClick={() => handleDeleteUser(user.id)}
                                                                        disabled={user.id === currentUser?.id}
                                                                    >
                                                                        <Trash2 className="w-4 h-4 text-red-400" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        )}
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                    No users found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="assignments">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {(users || []).map(u => {
                                const personHouses = getHousesByUserId(u.id);
                                const label = userLabel(u);
                                const roomsOnHouses = personHouses.reduce((sum, h) => sum + houseRoomCount(h), 0);
                                return (
                                    <Card key={u.id} className="border-slate-200">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                                                    {label?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">{label}</h3>
                                                    <p className="text-sm text-slate-500">
                                                        {personHouses.length} kuća
                                                        {personHouses.length > 0 && (
                                                            <span className="text-slate-400">
                                                                {' '}
                                                                · {roomsOnHouses} {roomsWordSr(roomsOnHouses)}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            {personHouses.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {personHouses.map(h => (
                                                        <Badge key={h.id} variant="secondary" className="text-xs">
                                                            {houseLabelWithRooms(h)}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>

                        {/* Houses Table */}
                        <Card className="border-slate-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-blue-500" />
                                    House Assignments
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>House</TableHead>
                                            <TableHead>Address</TableHead>
                                            <TableHead>Rooms</TableHead>
                                            <TableHead>Dodeljeni korisnici</TableHead>
                                            <TableHead className="w-20"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </TableCell>
                                            </TableRow>
                                        ) : houses?.length > 0 ? (
                                            houses.map(house => (
                                                <TableRow key={house.id}>
                                                    <TableCell className="font-medium">{house.name}</TableCell>
                                                    <TableCell className="text-slate-500">{house.address || '-'}</TableCell>
                                                    <TableCell>
                                                        <span className="font-medium tabular-nums">{house.total_rooms || 0}</span>
                                                        <span className="text-slate-500 text-sm ml-1">{roomsWordSr(house.total_rooms || 0)}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {(house.member_user_ids || []).length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {(house.member_user_ids || []).map(uid => {
                                                                    const u = (users || []).find(x => x.id === uid);
                                                                    return (
                                                                        <Badge key={uid} className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                                                            {u ? userLabel(u) : uid}
                                                                        </Badge>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400">Niko</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="icon" onClick={() => handleAssign(house)}>
                                                            <Edit2 className="w-4 h-4 text-slate-400" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                                    No houses found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Assign Dialog */}
            <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodela kuće korisnicima</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>
                            Kuća:{' '}
                            <span className="font-semibold">{selectedHouse?.name}</span>
                            {selectedHouse != null && (
                                <span className="text-slate-500 font-normal">
                                    {' '}
                                    ({houseRoomCount(selectedHouse)} {roomsWordSr(houseRoomCount(selectedHouse))})
                                </span>
                            )}
                        </Label>
                        <div className="mt-4 space-y-2">
                            <Label>Korisnici na kući</Label>
                            <section className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 mt-2">
                                {(users || []).filter(u => u.role !== 'admin').map(u => (
                                    <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 rounded px-2 py-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedMemberIds.includes(u.id)}
                                            onChange={() => {
                                                setSelectedMemberIds(prev =>
                                                    prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                                );
                                            }}
                                        />
                                        <span>{userLabel(u)} ({u.role})</span>
                                    </label>
                                ))}
                            </section>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssigning(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditingUser} onOpenChange={setIsEditingUser}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="userEmail">Email</Label>
                            <Input
                                id="userEmail"
                                value={selectedUser?.email || ''}
                                readOnly
                                disabled
                                className="bg-slate-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="userFirst">Ime (opciono)</Label>
                            <Input
                                id="userFirst"
                                value={userFormData.first_name}
                                onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="userLast">Prezime (opciono)</Label>
                            <Input
                                id="userLast"
                                value={userFormData.last_name}
                                onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="userRole">Uloga</Label>
                            <Select value={userFormData.role} onValueChange={(value) => setUserFormData({...userFormData, role: value})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="user">Korisnik</SelectItem>
                                    <SelectItem value="viewer">Pregledač</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {userFormData.role !== 'admin' && (
                            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                                <Checkbox
                                    checked={userFormData.can_access_all_houses}
                                    onCheckedChange={(checked) =>
                                        setUserFormData({ ...userFormData, can_access_all_houses: checked === true })
                                    }
                                />
                                <span className="text-sm">
                                    <span className="font-medium text-slate-800">Pristup svim kućama</span>
                                    <span className="block text-slate-500 mt-0.5">
                                        Može da bira „Svi korisnici“ na početnoj stranici i da menja sve kuće, ne samo dodeljene.
                                    </span>
                                </span>
                            </label>
                        )}
                        <section className="pt-3 border-t border-slate-200 space-y-2">
                            <Label className="text-sm">Lozinka</Label>
                            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleAdminResetPassword} disabled={isSaving}>
                                <KeyRound className="w-4 h-4 mr-2" />
                                Generiši novu privremenu lozinku
                            </Button>
                            {adminTempPassword && (
                                <section className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                                    <p className="font-mono text-lg select-all">{adminTempPassword}</p>
                                    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => navigator.clipboard?.writeText(adminTempPassword)}>
                                        <Copy className="w-3 h-3 mr-1" /> Kopiraj
                                    </Button>
                                </section>
                            )}
                        </section>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingUser(false)}>Otkaži</Button>
                        <Button onClick={handleSaveUser} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sačuvaj
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dodaj korisnika</DialogTitle>
                    </DialogHeader>
                    <section className="py-4 space-y-4">
                        <p className="text-sm text-slate-500">
                            Samo dodati korisnici mogu da se prijave. Prosledite im email i privremenu lozinku.
                        </p>
                        {createdCredentials ? (
                            <section className="rounded-lg bg-green-50 border border-green-200 p-4 space-y-2">
                                <p className="text-green-900 font-medium">Nalog kreiran</p>
                                <p className="text-sm">Email: <strong>{createdCredentials.email}</strong></p>
                                <p className="font-mono text-xl text-green-950 select-all">{createdCredentials.temporary_password}</p>
                                <Button type="button" size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(`Email: ${createdCredentials.email}\nLozinka: ${createdCredentials.temporary_password}`)}>
                                    <Copy className="w-3 h-3 mr-1" /> Kopiraj podatke za prijavu
                                </Button>
                            </section>
                        ) : (
                            <>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Email *</span>
                                    <Input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Ime (opciono)</span>
                                    <Input value={newUserForm.first_name} onChange={(e) => setNewUserForm({ ...newUserForm, first_name: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Prezime (opciono)</span>
                                    <Input value={newUserForm.last_name} onChange={(e) => setNewUserForm({ ...newUserForm, last_name: e.target.value })} />
                                </label>
                                <label className="space-y-1 block">
                                    <span className="text-sm font-medium">Uloga</span>
                                    <Select value={newUserForm.role} onValueChange={(role) => setNewUserForm({ ...newUserForm, role })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">Korisnik</SelectItem>
                                            <SelectItem value="viewer">Pregledač</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </label>
                                {newUserForm.role !== 'admin' && (
                                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                                        <Checkbox
                                            checked={newUserForm.can_access_all_houses}
                                            onCheckedChange={(checked) =>
                                                setNewUserForm({ ...newUserForm, can_access_all_houses: checked === true })
                                            }
                                        />
                                        <span className="text-sm">
                                            <span className="font-medium text-slate-800">Pristup svim kućama</span>
                                            <span className="block text-slate-500 mt-0.5">
                                                Vidi i menja sve kuće kada izabere „Svi korisnici“ na početnoj.
                                            </span>
                                        </span>
                                    </label>
                                )}
                            </>
                        )}
                    </section>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAddingUser(false); setCreatedCredentials(null); }}>
                            {createdCredentials ? 'Zatvori' : 'Otkaži'}
                        </Button>
                        {!createdCredentials && (
                            <Button onClick={handleCreateUser} disabled={isSaving || !newUserForm.email.trim()}>
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Kreiraj nalog
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}