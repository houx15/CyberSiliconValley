'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Upload, Link, MessageSquare, Mic } from 'lucide-react';

interface EntryPathsProps {
  onSelect: (path: string) => void;
}

const pathConfig = [
  {
    id: 'resume',
    icon: Upload,
    available: false,
  },
  {
    id: 'link',
    icon: Link,
    available: false,
  },
  {
    id: 'conversation',
    icon: MessageSquare,
    available: true,
  },
  {
    id: 'voice',
    icon: Mic,
    available: false,
  },
] as const;

export function EntryPaths({ onSelect }: EntryPathsProps) {
  const t = useTranslations('onboarding');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-12 max-w-lg"
      >
        <p className="font-serif text-xl md:text-2xl text-foreground/90 leading-relaxed">
          {t('entryPrompt')}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full px-4">
        {pathConfig.map((path, index) => {
          const Icon = path.icon;
          return (
            <motion.button
              key={path.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              onClick={() => path.available && onSelect(path.id)}
              disabled={!path.available}
              className={`group relative flex items-start gap-4 p-6 rounded-xl border text-left transition-all ${
                path.available
                  ? 'border-foreground/20 hover:border-foreground/40 hover:bg-foreground/5 cursor-pointer'
                  : 'border-foreground/10 opacity-50 cursor-not-allowed'
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                  path.available
                    ? 'bg-foreground/10 group-hover:bg-foreground/15'
                    : 'bg-foreground/5'
                }`}
              >
                <Icon className="w-5 h-5 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground mb-1">
                  {t(`entry.${path.id}.title`)}
                </h3>
                <p className="text-sm text-foreground/60">
                  {t(`entry.${path.id}.description`)}
                </p>
                {!path.available && (
                  <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-foreground/10 text-foreground/50">
                    {t('comingSoon')}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
