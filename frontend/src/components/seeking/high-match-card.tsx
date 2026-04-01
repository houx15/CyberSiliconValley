'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { HighMatchItem } from '@/lib/api/seeking';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, FileText, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface HighMatchCardProps {
  match: HighMatchItem;
  index: number;
  onGenerateResume: (jobId: string) => void;
}

export function HighMatchCard({
  match,
  index,
  onGenerateResume,
}: HighMatchCardProps) {
  const [expanded, setExpanded] = useState(index === 0);
  const t = useTranslations('seeking');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.04 }}
    >
      <Card className="overflow-hidden">
        <CardHeader
          className="cursor-pointer py-4"
          onClick={() => setExpanded((value) => !value)}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-lg font-semibold text-emerald-700">
                {match.score}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">{match.jobTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {match.companyName} · {match.location} · {match.workMode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CardHeader>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="space-y-4 border-t border-border/60 pt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t('skillMatch')}</p>
                  <div className="flex flex-wrap gap-2">
                    {match.skillMatches.map((skill) => (
                      <Badge
                        key={skill.skill}
                        variant={skill.matched ? 'secondary' : 'outline'}
                        className={skill.matched ? 'bg-emerald-500/10 text-emerald-700' : 'text-rose-700'}
                      >
                        {skill.matched ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        {skill.skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{t('assessment')}</p>
                  <div className="rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                    {match.aiAssessment}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.stopPropagation();
                      onGenerateResume(match.jobId);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    {t('generateResume')}
                  </Button>
                  <Button size="sm">{t('apply')}</Button>
                  <Button size="sm" variant="ghost">
                    {t('dismiss')}
                  </Button>
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
