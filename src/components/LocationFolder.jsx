import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Building2, Users, ChevronRight } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

const LOCATION_COLORS = {
    'Sarti': 'from-blue-400 to-blue-600',
    'Sykia': 'from-emerald-400 to-emerald-600',
    'Klimataria': 'from-amber-400 to-amber-600',
    'Kalamitsi': 'from-rose-400 to-rose-600',
    'Porto Koufo': 'from-purple-400 to-purple-600',
    'Toroni': 'from-cyan-400 to-cyan-600',
    'Zaliv Simonitiko': 'from-indigo-400 to-indigo-600',
    'Neos Marmaras': 'from-teal-400 to-teal-600',
    'Nikiti': 'from-orange-400 to-orange-600',
    'Metamorfosi': 'from-pink-400 to-pink-600',
    'Psakoudia': 'from-lime-400 to-lime-600',
    'Nea Plaja': 'from-violet-400 to-violet-600',
};

export default function LocationFolder({ location, houses, totalRooms, totalOccupants, onClick, isSelected }) {
    const gradient = LOCATION_COLORS[location] || 'from-slate-400 to-slate-600';
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={onClick}
            className={`cursor-pointer rounded-2xl border-2 transition-all duration-200 overflow-hidden shadow-sm hover:shadow-lg
                ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300'}`}
        >
            {/* Folder Tab */}
            <div className={`bg-gradient-to-r ${gradient} px-5 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white/90" />
                    <span className="text-white font-bold text-lg tracking-wide">{location}</span>
                </div>
                <ChevronRight className={`w-5 h-5 text-white/80 transition-transform duration-200 ${isSelected ? 'rotate-90' : ''}`} />
            </div>

            {/* Folder Body */}
            <div className="bg-white px-5 py-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{houses} {houses === 1 ? 'kuća' : 'kuće/kuća'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{totalOccupants} gostiju</span>
                    </div>
                    <div className="ml-auto">
                        <Badge variant="secondary" className="text-xs">
                            {totalRooms} soba
                        </Badge>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}