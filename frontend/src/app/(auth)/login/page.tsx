'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import { loginWithPassword } from '@/lib/session/current-user';

const DEMO_ACCOUNTS = [
  { email: 'talent1@csv.dev', label: 'Talent 1', role: 'talent' },
  { email: 'talent2@csv.dev', label: 'Talent 2', role: 'talent' },
  { email: 'enterprise1@csv.dev', label: 'Enterprise 1', role: 'enterprise' },
  { email: 'enterprise2@csv.dev', label: 'Enterprise 2', role: 'enterprise' },
];

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError('');
    try {
      const user = await loginWithPassword(loginEmail, loginPassword);
      router.push(user.role === 'talent' ? '/talent/home' : '/enterprise/dashboard');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError(t('invalidCredentials'));
        return;
      }
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="font-serif text-2xl">{t('loginTitle')}</CardTitle>
        <CardDescription>{t('loginSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Quick login:</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={loading}
                onClick={() => handleLogin(account.email, 'csv2026')}
              >
                {account.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleLogin(email, password); }} className="space-y-4">
          <div className="space-y-2">
            <Input type="email" placeholder={t('email')} value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
            <Input type="password" placeholder={t('password')} value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '...' : t('loginButton')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
