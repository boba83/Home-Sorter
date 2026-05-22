import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DoorOpen, Users, ChevronRight, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
export default function HouseCard({ house, rooms = [], userColor = 'slate', detailsScope = 'all' }) {
    if (!house?.id) return null;

    const safeRooms = Array.isArray(rooms) ? rooms : [];
    const houseName = (house?.name ?? 'Bez naziva').toString();
    const listedRoomCount = safeRooms.length;
    const houseTotalRooms = Number(house?.total_rooms) || 0;
    /** Ako API sobe nisu učitane, koristi agregat sa kuće (iz importa) da ne bude 0/0. */
    const totalRoomsForDisplay = Math.max(listedRoomCount, houseTotalRooms);
    const occupiedRooms = safeRooms.filter((r) => (r.current_occupants || 0) > 0).length;
    const totalOccupants = safeRooms.reduce((sum, r) => sum + (r.current_occupants || 0), 0);

    const colorClasses = {
        blue: 'border-blue-300 bg-blue-50/30',
        purple: 'border-purple-300 bg-purple-50/30',
        green: 'border-green-300 bg-green-50/30',
        orange: 'border-orange-300 bg-orange-50/30',
        pink: 'border-pink-300 bg-pink-50/30',
        cyan: 'border-cyan-300 bg-cyan-50/30',
        indigo: 'border-indigo-300 bg-indigo-50/30',
        rose: 'border-rose-300 bg-rose-50/30',
        slate: 'border-slate-200'
    };

    const safeColor = colorClasses[userColor] ? userColor : 'slate';
    const borderClass = house.responsible_person ? colorClasses[safeColor] : colorClasses.slate;

    return (
        <div>
            <Link to={createPageUrl(`HouseDetails?id=${house.id}&scope=${detailsScope}`)}>
                <Card className={`group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 ${borderClass} relative`}>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                                        {houseName}
                                    </h3>
                                    {house.address && (
                                        <p className="text-sm text-slate-500">{house.address}</p>
                                    )}
                                    {house.responsible_person && (
                                        <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                                            <UserCircle className="w-3 h-3" />
                                            {house.responsible_person}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                                <DoorOpen className="w-4 h-4 text-slate-400" />
                                <span className="text-sm">
                                    <span className="font-semibold text-slate-700">{occupiedRooms}</span>
                                    <span className="text-slate-400">/{totalRoomsForDisplay}</span>
                                    <span className="text-slate-500 ml-1">rooms</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-sm">
                                    <span className="font-semibold text-slate-700">{totalOccupants}</span>
                                    <span className="text-slate-400">/{house.total_capacity || safeRooms.reduce((s, r) => s + (r.capacity || 0), 0)}</span>
                                    <span className="text-slate-500 ml-1">persons</span>
                                </span>
                            </div>
                        </div>

                        {safeRooms.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {safeRooms.slice(0, 5).map((room) => (
                                    <Badge
                                        key={room.id}
                                        variant="outline"
                                        className={room.current_occupants > 0
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                        }
                                    >
                                        Room {room.room_number}
                                    </Badge>
                                ))}
                                {safeRooms.length > 5 && (
                                    <Badge variant="secondary">
                                        +{safeRooms.length - 5} more
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}

