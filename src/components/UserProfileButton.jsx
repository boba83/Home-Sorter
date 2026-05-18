import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { LogOut, Camera, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Čitanje slike nije uspelo'));
    reader.readAsDataURL(file);
  });
}

function displayName(user) {
  if (!user) return '';
  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return parts || user.full_name || user.email || '';
}

export default function UserProfileButton() {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '' });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await base44.auth.me();
        if (cancelled) return;
        let profile_image = null;
        if (u?.has_profile_image) {
          const img = await base44.auth.profileImage();
          profile_image = img?.profile_image ?? null;
        }
        if (cancelled) return;
        const merged = { ...u, profile_image };
        setUser(merged);
        setProfileForm({
          first_name: merged.first_name || '',
          last_name: merged.last_name || '',
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
    });
  }, [user?.id, user?.first_name, user?.last_name]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openFilePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    input.value = '';
    input.click();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Izaberite sliku (JPG, PNG, WebP…).');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      alert('Slika je prevelika (maks. 2 MB).');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = await base44.auth.updateMe({ profile_image: dataUrl });
      setUser(updated);
    } catch (err) {
      alert(err?.message || 'Profilna slika nije sačuvana.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await base44.auth.updateMe({
        first_name: profileForm.first_name.trim(),
        last_name: profileForm.last_name.trim(),
      });
      setUser(updated);
    } catch (err) {
      alert(err?.message || 'Podaci nisu sačuvani.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password.length < 6) {
      alert('Nova lozinka mora imati najmanje 6 karaktera.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('Nova lozinka i potvrda se ne poklapaju.');
      return;
    }
    setSavingPassword(true);
    try {
      await base44.auth.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      alert('Lozinka je promenjena.');
    } catch (err) {
      alert(err?.message || 'Lozinka nije promenjena.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => base44.auth.logout();

  const nameLabel = displayName(user);
  const initials = nameLabel
    ? nameLabel.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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
        <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-xl border border-slate-100 py-3 w-72 z-50">
          <div className="px-4 pb-3 border-b border-slate-100">
            <p className="font-semibold text-slate-800 text-sm truncate">{nameLabel || 'Profil'}</p>
          </div>

          <div className="px-4 py-3 space-y-3 border-b border-slate-100">
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs text-slate-500">
                Email (iz naloga)
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="bg-slate-50 text-slate-600 h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-first" className="text-xs text-slate-500">
                Ime <span className="text-slate-400">(opciono)</span>
              </Label>
              <Input
                id="profile-first"
                value={profileForm.first_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, first_name: e.target.value }))}
                placeholder="Ime"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-last" className="text-xs text-slate-500">
                Prezime <span className="text-slate-400">(opciono)</span>
              </Label>
              <Input
                id="profile-last"
                value={profileForm.last_name}
                onChange={(e) => setProfileForm((f) => ({ ...f, last_name: e.target.value }))}
                placeholder="Prezime"
                className="h-9 text-sm"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full h-9"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                'Čuvanje...'
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-2" />
                  Sačuvaj podatke
                </>
              )}
            </Button>
          </div>

          <section className="px-4 py-3 space-y-2 border-b border-slate-100">
            <p className="text-xs font-medium text-slate-500">Promena lozinke</p>
            <Input type="password" placeholder="Trenutna lozinka" value={passwordForm.current_password} onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))} className="h-9 text-sm" />
            <Input type="password" placeholder="Nova lozinka" value={passwordForm.new_password} onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))} className="h-9 text-sm" />
            <Input type="password" placeholder="Ponovi novu lozinku" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))} className="h-9 text-sm" />
            <Button type="button" size="sm" variant="outline" className="w-full h-9" onClick={handleChangePassword} disabled={savingPassword}>
              {savingPassword ? 'Čuvanje...' : 'Promeni lozinku'}
            </Button>
          </section>

          <button
            type="button"
            onClick={openFilePicker}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={uploading}
          >
            <Camera className="w-4 h-4 text-slate-400" />
            {uploading ? 'Učitavanje...' : 'Promeni profilnu sliku'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Odjavi se
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoUpload}
      />
    </div>
  );
}
