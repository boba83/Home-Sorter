import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calculator, Info, LayoutDashboard, CalendarClock } from 'lucide-react';
import { motion } from 'framer-motion';
import UserProfileButton from '@/components/UserProfileButton';
import NotificationBell from '@/components/NotificationBell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPageUrl } from '@/utils';

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
        to: '/Dezurstva',
        icon: CalendarClock,
        label: 'Dežurstva',
        description: 'Plan smena po danima za tim na kućama',
        gradient: 'from-violet-500 to-violet-700',
        shadow: 'shadow-violet-500/30',
        bg: 'bg-violet-50',
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

            <Tabs defaultValue="apps" className="w-full max-w-3xl mx-auto">
              <TabsList className="grid w-full max-w-xs mx-auto grid-cols-2 mb-8">
                <TabsTrigger value="apps">Aplikacije</TabsTrigger>
                <TabsTrigger value="ostalo">Ostalo</TabsTrigger>
              </TabsList>
              <TabsContent value="apps" className="mt-0 outline-none">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full items-stretch">
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
              </TabsContent>
              <TabsContent value="ostalo" className="mt-0 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mx-auto w-full max-w-md"
                >
                  <p className="text-center text-sm text-slate-500 mb-4">
                    Ostali resursi i informacije za tim.
                  </p>
                  <Link to={createPageUrl('ImportantInfo')} className="block">
                    <div className="bg-orange-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-lg transition-all duration-300 cursor-pointer group hover:-translate-y-0.5">
                      <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-md shadow-orange-500/30 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <Info className="w-7 h-7 text-white" />
                      </div>
                      <div className="text-center w-full">
                        <h2 className="text-base font-bold text-slate-800 leading-snug">Bitne informacije</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Kontakti i važne informacije</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
    );
}