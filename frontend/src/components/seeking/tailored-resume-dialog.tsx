'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderResumeHtml(markdown: string) {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<p></p>')
    .replace(/\n/g, '<br />');
}

interface TailoredResumeResponse {
  markdown: string;
  talentName: string;
  jobTitle: string;
  companyName: string;
}

interface TailoredResumeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  talentId: string;
  jobId: string;
}

export function TailoredResumeDialog({
  open,
  onOpenChange,
  talentId,
  jobId,
}: TailoredResumeDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resume, setResume] = useState<TailoredResumeResponse | null>(null);
  const t = useTranslations('seeking');

  useEffect(() => {
    if (!open || !jobId || !talentId) {
      return;
    }

    let disposed = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setResume(null);

      try {
        const response = await fetch('/api/v1/resume/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ talentId, jobId }),
        });

        if (!response.ok) {
          throw new Error('resume generation failed');
        }

        const payload = await response.json();
        if (!disposed) {
          setResume(payload.data);
        }
      } catch {
        if (!disposed) {
          setError(t('resumeError'));
        }
      } finally {
        if (!disposed) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      disposed = true;
    };
  }, [jobId, open, talentId, t]);

  function handleDownload() {
    if (!resume) {
      return;
    }

    const blob = new Blob(
      [
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${resume.talentName}</title></head><body>${renderResumeHtml(
          resume.markdown
        )}</body></html>`,
      ],
      { type: 'text/html' }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resume-${resume.talentName}-${resume.companyName}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {resume ? t('resumeReady', { company: resume.companyName }) : t('generatingResume')}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('generatingResume')}
            </div>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {resume && (
          <div
            className="rounded-xl border border-border/60 p-6 text-sm leading-7 text-foreground [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:font-medium [&_li]:ml-5 [&_li]:list-disc"
            dangerouslySetInnerHTML={{ __html: renderResumeHtml(resume.markdown) }}
          />
        )}

        <DialogFooter>
          {resume && (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              HTML
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
