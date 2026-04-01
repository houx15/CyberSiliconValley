'use client';

import { useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Shield } from 'lucide-react';
import { optInPreChat } from '@/lib/api/prechat';

interface PreChatOptInProps {
  preChatId: string;
  jobTitle: string;
  companyName: string;
  variant: 'talent' | 'enterprise';
  onOptIn?: () => void;
  onDecline?: () => void;
}

export function PreChatOptIn({
  preChatId,
  jobTitle,
  companyName,
  variant,
  onOptIn,
  onDecline,
}: PreChatOptInProps) {
  const [isPending, startTransition] = useTransition();

  function handleOptIn() {
    startTransition(async () => {
      try {
        await optInPreChat(preChatId);
        onOptIn?.();
      } catch {
        // Error will be handled by caller
      }
    });
  }

  const description = variant === 'talent'
    ? `${companyName} 就 "${jobTitle}" 机会发起了 AI 预沟通。你的 AI 伙伴将代表你与企业的 AI HR 进行初步交流，了解双方的匹配度。`
    : `系统已为 "${jobTitle}" 机会匹配到候选人。AI HR 将代表你与候选人的 AI 伙伴进行初步交流，评估匹配度。`;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-5">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI 预沟通邀请</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">
                预沟通期间不会泄露你的联系方式，AI 会保护你的隐私。
              </p>
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleOptIn} disabled={isPending}>
                {isPending ? '确认中...' : '同意参与'}
              </Button>
              <Button variant="outline" size="sm" onClick={onDecline} disabled={isPending}>
                暂不参与
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
