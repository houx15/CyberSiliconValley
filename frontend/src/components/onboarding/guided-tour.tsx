'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Home, Target, BarChart3, Map, ArrowRight, Check } from 'lucide-react';

interface GuidedTourProps {
  onComplete: () => void;
}

const tourSteps = [
  {
    id: 'home',
    icon: Home,
    gradient: 'from-violet-500/20 to-blue-500/20',
  },
  {
    id: 'coach',
    icon: Target,
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'seeking',
    icon: BarChart3,
    gradient: 'from-cyan-500/20 to-emerald-500/20',
  },
  {
    id: 'fair',
    icon: Map,
    gradient: 'from-emerald-500/20 to-violet-500/20',
  },
] as const;

export function GuidedTour({ onComplete }: GuidedTourProps) {
  const t = useTranslations('onboarding');
  const [currentStep, setCurrentStep] = useState(0);

  const step = tourSteps[currentStep]!;
  const isLast = currentStep === tourSteps.length - 1;
  const Icon = step.icon;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      {/* Progress dots */}
      <div className="flex gap-2 mb-12">
        {tourSteps.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep
                ? 'bg-foreground/80'
                : i < currentStep
                  ? 'bg-foreground/40'
                  : 'bg-foreground/15'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center max-w-md"
        >
          {/* Icon */}
          <div
            className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center mb-8`}
          >
            <Icon className="w-10 h-10 text-foreground/70" />
          </div>

          {/* Title */}
          <h2 className="font-serif text-2xl text-foreground mb-3">
            {t(`tour.${step.id}.title`)}
          </h2>

          {/* Description */}
          <p className="text-foreground/60 text-sm leading-relaxed mb-8">
            {t(`tour.${step.id}.description`)}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <motion.button
        onClick={handleNext}
        className="flex items-center gap-2 px-8 py-3 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/80 hover:text-foreground transition-colors text-sm font-medium"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {isLast ? (
          <>
            {t('tour.start')}
            <Check className="w-4 h-4" />
          </>
        ) : (
          <>
            {t('tour.next')}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </motion.button>

      {/* Skip */}
      <button
        onClick={onComplete}
        className="mt-4 text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
      >
        {t('tour.skip')}
      </button>
    </div>
  );
}
