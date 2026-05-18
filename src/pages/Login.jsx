import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Loader2 } from 'lucide-react';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@home-sorter.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);

  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  React.useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    fetch('/api/health', { signal: controller.signal, cache: 'no-store' })
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false))
      .finally(() => clearTimeout(t));
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.assign('/');
    } catch (err) {
      setError(err.message || 'Prijava nije uspela');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Home Sorter</h1>
            <p className="text-sm text-slate-500">Vaša lokalna aplikacija — bez Base44</p>
          </div>
        </div>

        {apiOnline === false && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">API server nije pokrenut</p>
            <p className="mt-1 text-amber-800">
              U terminalu u korenu projekta pokrenite:{' '}
              <code className="rounded bg-amber-100 px-1">npm run dev:all:clean</code>
              , sačekajte poruku na portu 3001, zatim osvežite stranicu.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lozinka</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Prijavi se
          </Button>
        </form>

        <p className="text-xs text-slate-400 mt-6 text-center">
          Podrazumevani admin: admin@home-sorter.local / admin123
        </p>
      </div>
    </div>
  );
}
