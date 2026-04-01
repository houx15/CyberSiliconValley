'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      router.push('/');
    }
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm font-medium text-foreground">退出登录</p>
          <p className="text-xs text-muted-foreground">退出当前账号</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
          disabled={loading}
        >
          <LogOut className="h-3.5 w-3.5" />
          {loading ? '退出中...' : '退出登录'}
        </Button>
      </CardContent>
    </Card>
  );
}
