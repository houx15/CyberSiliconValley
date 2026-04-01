'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompanyData {
  companyName?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  description?: string;
  aiMaturity?: string;
}

interface CompanyRevealProps {
  data: CompanyData;
  step: string;
}

const fieldOrder: Array<{ key: keyof CompanyData; label: string }> = [
  { key: 'companyName', label: 'Company' },
  { key: 'industry', label: 'Industry' },
  { key: 'companySize', label: 'Size' },
  { key: 'website', label: 'Website' },
  { key: 'description', label: 'About' },
  { key: 'aiMaturity', label: 'AI Maturity' },
];

export function CompanyReveal({ data, step }: CompanyRevealProps) {
  const revealedFields = fieldOrder.filter((f) => data[f.key]);
  const totalFields = fieldOrder.length;
  const progress = revealedFields.length / totalFields;

  if (revealedFields.length === 0) return null;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Company Profile
          </CardTitle>
          <Badge
            variant={step === 'complete' ? 'default' : 'secondary'}
            className="text-xs"
          >
            {Math.round(progress * 100)}% complete
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence mode="popLayout">
          {revealedFields.map((field, i) => (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="flex gap-3"
            >
              <span className="w-24 shrink-0 text-xs text-muted-foreground">
                {field.label}
              </span>
              <span className="text-sm text-foreground">
                {field.key === 'website' && data[field.key] ? (
                  <a
                    href={data[field.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    {data[field.key]}
                  </a>
                ) : field.key === 'aiMaturity' ? (
                  <Badge variant="outline" className="text-xs">
                    {data[field.key]}
                  </Badge>
                ) : (
                  data[field.key]
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Unrevealed placeholders */}
        {fieldOrder
          .filter((f) => !data[f.key])
          .map((field) => (
            <div key={field.key} className="flex gap-3">
              <span className="w-24 shrink-0 text-xs text-muted-foreground">
                {field.label}
              </span>
              <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
