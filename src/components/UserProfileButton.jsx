import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, Camera } from 'lucide-react';

export default function UserProfileButton() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      await base44.auth.updateMe({ profile_image: url });
      setUser(prev => ({ ...prev, profile_image: file_url }));
    } finally {
      setUploading(false);
      setOpen(false);
    }
  };

  const handleLogout = () => base44.auth.logout('/');

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-300 hover:border-slate-400 transition-all flex-shrink-0 bg-slate-200"
      >
        {user?.profile_image ? (
          <img src={user.profile_image} alt="profil" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-slate-600 flex items-center justify-center text-white font-semibold text-sm">
            {initials}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 w-52 z-50">
          <div className="px-4 py-2 border-b border-slate-100 mb-1">
            <p className="font-semibold text-slate-800 text-sm truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={uploading}
          >
            <Camera className="w-4 h-4 text-slate-400" />
            {uploading ? 'Učitavanje...' : 'Promeni profilnu sliku'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odjavi se
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />
    </div>
  );
}