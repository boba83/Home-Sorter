import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Building2, Edit2, ArrowLeft, Loader2, Trash2, UserPlus, Shield, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function UserManagement() {
    const queryClient = useQueryClient();
    const [isAssigning, setIsAssigning] = useState(false);
    const [selectedHouse, setSelectedHouse] = useState(null);
    const [selectedPerson, setSelectedPerson] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // User management states
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userFormData, setUserFormData] = useState({ full_name: '', role: 'user' });

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

    // Get responsible persons from users list
    const RESPONSIBLE_PERSONS = (users || []).map(u => u.full_name).filter(Boolean);

    const handleAssign = (house) => {
        setSelectedHouse(house);
        setSelectedPerson(house.responsible_person || '');
        setIsAssigning(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        await base44.entities.House.update(selectedHouse.id, {
            responsible_person: selectedPerson
        });
        queryClient.invalidateQueries({ queryKey: ['houses'] });
        setIsSaving(false);
        setIsAssigning(false);
    };

    const getHousesByPerson = (person) => {
        return (houses || []).filter(h => h.responsible_person === person);
    };

    const handleEditUser = (user) => {
        setSelectedUser(user);
        setUserFormData({ full_name: user.full_name || '', role: user.role || 'user' });
        setIsEditingUser(true);
    };

    const handleSaveUser = async () => {
        setIsSaving(true);
        await base44.entities.User.update(selectedUser.id, userFormData);
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
                                    <p className="text-sm text-slate-500">
                                        To add new users, use the invite function in Dashboard → Users
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Assigned Houses</TableHead>
                                            {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {usersLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </TableCell>
                                            </TableRow>
                                        ) : users?.length > 0 ? (
                                            users.map(user => {
                                                const userHouses = getHousesByPerson(user.full_name);
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                                                        <TableCell className="text-slate-500">{user.email}</TableCell>
                                                        <TableCell>
                                                            <Badge className={user.role === 'admin' 
                                                                ? "bg-purple-100 text-purple-700 border-purple-200" 
                                                                : "bg-slate-100 text-slate-700 border-slate-200"
                                                            }>
                                                                <Shield className="w-3 h-3 mr-1" />
                                                                {user.role || 'user'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {userHouses.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {userHouses.map(h => (
                                                                        <Badge key={h.id} variant="secondary" className="text-xs">
                                                                            {h.name}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400">None</span>
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
                            {RESPONSIBLE_PERSONS.map(person => {
                                const personHouses = getHousesByPerson(person);
                                return (
                                    <Card key={person} className="border-slate-200">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                                                    {person?.[0] || '?'}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">{person}</h3>
                                                    <p className="text-sm text-slate-500">{personHouses.length} houses</p>
                                                </div>
                                            </div>
                                            {personHouses.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {personHouses.map(h => (
                                                        <Badge key={h.id} variant="secondary" className="text-xs">
                                                            {h.name}
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
                                            <TableHead>Responsible Person</TableHead>
                                            <TableHead className="w-20"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                                                </TableCell>
                                            </TableRow>
                                        ) : houses?.length > 0 ? (
                                            houses.map(house => (
                                                <TableRow key={house.id}>
                                                    <TableCell className="font-medium">{house.name}</TableCell>
                                                    <TableCell className="text-slate-500">{house.address || '-'}</TableCell>
                                                    <TableCell>{house.total_rooms || 0}</TableCell>
                                                    <TableCell>
                                                        {house.responsible_person ? (
                                                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                                                {house.responsible_person}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-slate-400">Not assigned</span>
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
                        <DialogTitle>Assign Responsible Person</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>House: <span className="font-semibold">{selectedHouse?.name}</span></Label>
                        <div className="mt-4 space-y-2">
                            <Label htmlFor="person">Responsible Person</Label>
                            <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a person" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>None</SelectItem>
                                    {RESPONSIBLE_PERSONS.map(person => (
                                        <SelectItem key={person} value={person}>{person}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                            <Label htmlFor="userName">Full Name</Label>
                            <Input
                                id="userName"
                                value={userFormData.full_name}
                                onChange={(e) => setUserFormData({...userFormData, full_name: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="userRole">Role</Label>
                            <Select value={userFormData.role} onValueChange={(value) => setUserFormData({...userFormData, role: value})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditingUser(false)}>Cancel</Button>
                        <Button onClick={handleSaveUser} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}