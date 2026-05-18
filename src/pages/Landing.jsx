import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calculator, Info, LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';
import UserProfileButton from '@/components/UserProfileButton';
import NotificationBell from '@/components/NotificationBell';

const apps = [
    {
        to: '/Home',
        icon: Building2,
        label: 'Room Manager',
        description: 'Upravljanje kućama i sobama',
        gradient: 'from-blue-800 to-blue-900',
        shadow: 'shadow-blue-800/30',
        bg: 'bg-blue-50',
    },
    {
        to: '/ExcursionCalculator',
        icon: Calculator,
        label: 'Excursion Calculator',
        description: 'Obračun ekskurzija',
        gradient: 'from-emerald-500 to-emerald-600',
        shadow: 'shadow-emerald-500/30',
        bg: 'bg-emerald-50',
    },
    {
        to: '/TaskManager',
        icon: LayoutDashboard,
        label: 'Manager Zadataka',
        description: 'Upravljanje problemima i zadacima',
        gradient: 'from-blue-400 to-blue-500',
        shadow: 'shadow-blue-400/30',
        bg: 'bg-sky-50',
    },
    {
        to: '/ImportantInfo',
        icon: Info,
        label: 'Bitne Informacije',
        description: 'Kontakti i važne informacije',
        gradient: 'from-orange-500 to-orange-600',
        shadow: 'shadow-orange-500/30',
        bg: 'bg-orange-50',
    },
];

export default function Landing() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col p-8">
          <div className="flex justify-end items-center gap-2 mb-4">
            <NotificationBell variant="light" />
            <UserProfileButton />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <h1 className="text-4xl font-bold text-slate-800 mb-2">Dobrodošli</h1>
                <p className="text-slate-500">Odaberite aplikaciju</p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg items-stretch">
                {apps.map((app, i) => {
                    const Icon = app.icon;
                    return (
                        <motion.div
                            key={app.to}
                            className="h-full"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Link to={app.to} className="block h-full">
                                <div
                                    className={`${app.bg} border border-slate-200 rounded-xl p-5 h-full flex flex-col items-center gap-3 hover:shadow-lg transition-all duration-300 cursor-pointer group hover:-translate-y-0.5`}
                                >
                                    <div
                                        className={`w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br ${app.gradient} shadow-md ${app.shadow} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}
                                    >
                                        <Icon className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="text-center w-full min-h-[3.25rem] flex flex-col items-center justify-center">
                                        <h2 className="text-base font-bold text-slate-800 leading-snug">{app.label}</h2>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{app.description}</p>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    );
                })}
            </div>
          </div>
        </div>
    );
}