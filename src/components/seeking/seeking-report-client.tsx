'use client';

import { useState } from 'react';
import type { SeekingReportData } from '@/lib/api/seeking';
import { ScanSummary } from './scan-summary';
import { HighMatchCard } from './high-match-card';
import { PreChatActivity } from './prechat-activity';
import { InboundInterest } from './inbound-interest';
import { TailoredResumeDialog } from './tailored-resume-dialog';
import { useTranslations } from 'next-intl';
import { NoReport } from '@/components/empty-states/no-report';

interface SeekingReportClientProps {
  initialReport: SeekingReportData | null;
  talentId: string;
}

export function SeekingReportClient({
  initialReport,
  talentId,
}: SeekingReportClientProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const t = useTranslations('seeking');

  if (!initialReport) {
    return <NoReport />;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('generated', { date: new Date(initialReport.generatedAt).toLocaleString() })}
        </p>
      </div>

      <ScanSummary data={initialReport.scanSummary} />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('highMatches')}</h2>
          <p className="text-sm text-muted-foreground">{t('highMatchesDescription')}</p>
        </div>

        <div className="space-y-3">
          {initialReport.highMatches.map((match, index) => (
            <HighMatchCard
              key={match.matchId}
              match={match}
              index={index}
              onGenerateResume={setSelectedJobId}
            />
          ))}
        </div>
      </section>

      <PreChatActivity items={initialReport.preChatActivity} />
      <InboundInterest items={initialReport.inboundInterest} />

      {selectedJobId && (
        <TailoredResumeDialog
          open={Boolean(selectedJobId)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedJobId(null);
            }
          }}
          talentId={talentId}
          jobId={selectedJobId}
        />
      )}
    </div>
  );
}
