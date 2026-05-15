import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, DoorOpen, Users, ChevronRight, UserCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function HouseCard({ house, rooms, userColor = 'slate' }) {
    const occupiedRooms = rooms.filter(r => r.current_occupants > 0).length;
    const totalOccupants = rooms.reduce((sum, r) => sum + (r.current_occupants || 0), 0);

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

    const borderClass = house.responsible_person ? colorClasses[userColor] : colorClasses.slate;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <Link to={createPageUrl(`HouseDetails?id=${house.id}`)}>
                <Card className={`group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 ${borderClass} hover:shadow-${userColor}-200/50 relative`}>
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                                        {house.name}
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
                                    <span className="text-slate-400">/{rooms.length}</span>
                                    <span className="text-slate-500 ml-1">rooms</span>
                                </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-sm">
                                    <span className="font-semibold text-slate-700">{totalOccupants}</span>
                                    <span className="text-slate-400">/{house.total_capacity || rooms.reduce((s, r) => s + (r.capacity || 0), 0)}</span>
                                    <span className="text-slate-500 ml-1">persons</span>
                                </span>
                            </div>
                        </div>

                        {rooms.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {rooms.slice(0, 5).map(room => (
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
                                {rooms.length > 5 && (
                                    <Badge variant="secondary">
                                        +{rooms.length - 5} more
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    );
}