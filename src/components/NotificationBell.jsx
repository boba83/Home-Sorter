import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { api } from '@/api/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationBell({ variant = 'light' }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [onlyUnread, setOnlyUnread] = useState(false);

    const isDark = variant === 'dark';

    const { data: unread = { count: 0 } } = useQuery({
        queryKey: ['notifications-unread'],
        queryFn: () => api.notifications.unreadCount(),
        refetchInterval: 30000,
    });

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.notifications.list(),
        enabled: open,
        refetchInterval: open ? 15000 : false,
    });

    const markRead = useMutation({
        mutationFn: (id) => api.notifications.markRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
        },
    });

    const markAllRead = useMutation({
        mutationFn: () => api.notifications.markAllRead(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
            queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
        },
    });

    const unreadCount = unread.count ?? 0;
    const urgentUnread = unread.urgent_count ?? 0;

    const visibleItems = useMemo(() => {
        if (!onlyUnread) return items;
        return items.filter((n) => !n.read);
    }, [items, onlyUnread]);

    const triggerClass = isDark
        ? 'w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors relative'
        : 'w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50 flex items-center justify-center transition-colors relative';

    const iconClass = isDark ? 'w-4 h-4 text-white' : 'w-5 h-5 text-slate-600';

    const handleItemClick = (n) => {
        if (!n.read) markRead.mutate(n.id);
        setOpen(false);
        navigate('/TaskManager');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className={triggerClass} title="Notifikacije">
                    <Bell className={iconClass} />
                    {unreadCount > 0 && (
                        <span
                            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm ${
                                urgentUnread > 0
                                    ? 'bg-red-600 animate-pulse ring-2 ring-red-300/80'
                                    : 'bg-blue-600'
                            }`}
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[min(22rem,calc(100vw-2rem))] p-0 max-h-[min(28rem,75vh)] flex flex-col overflow-hidden rounded-2xl border-slate-200/80 shadow-xl"
            >
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 pt-4 pb-3 text-white">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                                <Bell className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="font-semibold text-sm leading-tight">Notifikacije</p>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    {unreadCount > 0
                                        ? `${unreadCount} nepročitan${unreadCount === 1 ? 'a' : 'e'}`
                                        : 'Sve ste pročitali'}
                                </p>
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-white hover:bg-white/15 hover:text-white shrink-0"
                                onClick={() => markAllRead.mutate()}
                                disabled={markAllRead.isPending}
                            >
                                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                                Sve pročitano
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80">
                    <Label
                        htmlFor="notif-only-unread"
                        className="text-xs font-medium text-slate-600 cursor-pointer"
                    >
                        Samo nepročitane
                    </Label>
                    <Switch
                        id="notif-only-unread"
                        checked={onlyUnread}
                        onCheckedChange={setOnlyUnread}
                        className="data-[state=checked]:bg-blue-600"
                    />
                </div>

                <div className="px-4 py-2.5 border-b border-slate-100 bg-white text-xs text-slate-600 space-y-2">
                    <p>
                        <strong>Push na telefonu:</strong> u Manageru zadataka kliknite zvonce pored profila
                        i dozvolite obaveštenja. Na telefonu dodajte sajt na početni ekran (Chrome/Safari).
                    </p>
                    {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full text-xs h-8"
                            onClick={() => requestPermission()}
                        >
                            Uključi push obaveštenja
                        </Button>
                    )}
                    {permission === 'granted' && (
                        <p className="text-emerald-700 font-medium">Push je uključen (dok je aplikacija otvorena).</p>
                    )}
                </div>

                <div className="overflow-y-auto flex-1 p-2 space-y-1.5 bg-slate-50/50">
                    {isLoading && (
                        <div className="py-10 text-center">
                            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-slate-500 mt-3">Učitavanje...</p>
                        </div>
                    )}
                    {!isLoading && visibleItems.length === 0 && (
                        <div className="py-10 px-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                                <Inbox className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-700">
                                {onlyUnread ? 'Nema nepročitanih' : 'Nema notifikacija'}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {onlyUnread
                                    ? 'Isključite filter da vidite sve.'
                                    : 'Obaveštenja o zadacima će se pojaviti ovde.'}
                            </p>
                        </div>
                    )}
                    {!isLoading &&
                        visibleItems.map((n) => {
                            const urgent = n.severity === 'urgent';
                            return (
                                <button
                                    key={n.id}
                                    type="button"
                                    onClick={() => handleItemClick(n)}
                                    className={`w-full text-left rounded-xl border transition-all hover:shadow-md active:scale-[0.99] ${
                                        !n.read
                                            ? urgent
                                                ? 'bg-white border-red-200/80 shadow-sm ring-1 ring-red-100'
                                                : 'bg-white border-blue-200/60 shadow-sm ring-1 ring-blue-50'
                                            : 'bg-white/80 border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <div className="flex gap-2.5 p-3">
                                        <div
                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                urgent
                                                    ? 'bg-red-100 text-red-600'
                                                    : !n.read
                                                      ? 'bg-blue-100 text-blue-600'
                                                      : 'bg-slate-100 text-slate-400'
                                            }`}
                                        >
                                            {urgent ? (
                                                <AlertTriangle className="w-4 h-4" />
                                            ) : (
                                                <Bell className="w-3.5 h-3.5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-2">
                                                <p
                                                    className={`text-sm font-medium leading-snug ${
                                                        urgent ? 'text-red-900' : 'text-slate-800'
                                                    }`}
                                                >
                                                    {n.title}
                                                </p>
                                                {!n.read && (
                                                    <span
                                                        className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                                                            urgent ? 'bg-red-500' : 'bg-blue-500'
                                                        }`}
                                                    />
                                                )}
                                            </div>
                                            {n.message && (
                                                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                                    {n.message}
                                                </p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
                                                {n.created_date
                                                    ? formatDistanceToNow(new Date(n.created_date), {
                                                          addSuffix: true,
                                                          locale: sr,
                                                      })
                                                    : ''}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                </div>
            </PopoverContent>
        </Popover>
    );
}
