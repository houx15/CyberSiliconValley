'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisibilityToggleProps {
  initialVisible: boolean;
  variant: 'talent' | 'enterprise';
}

export function VisibilityToggle({ initialVisible, variant }: VisibilityToggleProps) {
  const [visible, setVisible] = useState(initialVisible);
  const [isPending, startTransition] = useTransition();

  const label = variant === 'talent' ? '对企业可见' : '对人才可见';
  const description = variant === 'talent'
    ? '开启后，你的个人资料将出现在企业的人才搜索结果中。'
    : '开启后，你的企业信息和发布的机会将对人才可见。';

  function handleToggle() {
    const next = !visible;
    setVisible(next);
    startTransition(async () => {
      try {
        await fetch('/api/v1/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visible: next }),
        });
      } catch {
        setVisible(!next); // revert on failure
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">可见性设置</CardTitle>
      </CardHeader>
      <CardContent>
        <button
          onClick={handleToggle}
          disabled={isPending}
          className="flex w-full items-center gap-4 rounded-lg border border-border/50 px-4 py-3 text-left transition-colors hover:bg-accent/30"
        >
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full',
            visible ? 'bg-emerald-500/10' : 'bg-muted'
          )}>
            {visible ? (
              <Eye className="h-5 w-5 text-emerald-500" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              visible ? 'bg-emerald-500' : 'bg-muted-foreground/30'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                visible ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
