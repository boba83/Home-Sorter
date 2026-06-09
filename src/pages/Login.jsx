import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

const LOGIN_ICON = '/home-sorter-login-icon.png';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  /** Tihi „warm-up“ (npr. Render cold start) — bez UI statusa da korisnik ne vidi lažne „server ne radi“. */
  React.useEffect(() => {
    const url = buildApiUrl('/health');
    void fetch(url, { cache: 'no-store', credentials: 'omit' }).catch(() => {});
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
        <div className="flex items-center gap-4 mb-6">
          <img
            src={LOGIN_ICON}
            alt="Home Sorter"
            className="w-[4.5rem] h-[4.5rem] rounded-xl object-contain bg-white shadow-sm ring-1 ring-slate-200/80 shrink-0 p-0.5"
            width={72}
            height={72}
          />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Home Sorter</h1>
            <p className="text-sm text-slate-500">
              Vaš digitalni pomoćnik u organizaciji poslovanja — powered by Astra travel
            </p>
          </div>
        </div>

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
          <Button
            type="submit"
            className="w-full bg-blue-900 text-white hover:bg-blue-950"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Prijavi se
          </Button>
        </form>
      </div>
    </div>
  );
}
