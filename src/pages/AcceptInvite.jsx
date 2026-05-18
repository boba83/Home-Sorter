import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, setToken } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Administrator',
  user: 'Korisnik',
  viewer: 'Pregledač (samo čitanje)',
};

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (!token) {
      setLoadError('Nedostaje link pozivnice.');
      setLoading(false);
      return;
    }
    api.invites
      .preview(token)
      .then(setPreview)
      .catch((e) => setLoadError(e.message || 'Pozivnica nije važeća'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera.');
      return;
    }
    if (password !== password2) {
      setError('Lozinke se ne poklapaju.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.invites.accept(token, {
        password,
        first_name: firstName,
        last_name: lastName,
      });
      if (result?.token) setToken(result.token);
      navigate('/', { replace: true });
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Registracija nije uspela');
    }
    setSubmitting(false);
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <header className="flex flex-col items-center mb-6">
          <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mb-3">
            <Building2 className="w-7 h-7 text-white" />
          </span>
          <h1 className="text-2xl font-bold text-slate-800">Home Sorter</h1>
          <p className="text-slate-500 text-sm mt-1">Prihvatanje pozivnice</p>
        </header>

        {loading && (
          <p className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </p>
        )}

        {!loading && loadError && (
          <section className="text-center space-y-4">
            <p className="text-red-600">{loadError}</p>
            <Link to="/login" className="text-blue-600 hover:underline text-sm">
              Idi na prijavu
            </Link>
          </section>
        )}

        {!loading && preview && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <section className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 space-y-1">
              <p>
                <span className="font-medium text-slate-800">Email:</span> {preview.email}
              </p>
              <p>
                <span className="font-medium text-slate-800">Uloga:</span>{' '}
                {ROLE_LABELS[preview.role] || preview.role}
              </p>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-sm font-medium">Ime (opciono)</span>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-sm font-medium">Prezime (opciono)</span>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
            </section>

            <label className="space-y-1 block">
              <span className="text-sm font-medium">Lozinka</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label className="space-y-1 block">
              <span className="text-sm font-medium">Ponovi lozinku</span>
              <Input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
              />
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kreiraj nalog
            </Button>
          </form>
        )}
      </section>
    </section>
  );
}
