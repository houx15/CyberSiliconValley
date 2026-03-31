'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

interface AwakeningScreenProps {
  onComplete: () => void;
}

function TypewriterText({
  text,
  onComplete,
  speed = 40,
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayed((prev) => prev + text[index]);
        setIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else if (onComplete) {
      const timer = setTimeout(onComplete, 1200);
      return () => clearTimeout(timer);
    }
  }, [index, text, speed, onComplete]);

  return (
    <span className="font-serif text-xl md:text-2xl text-foreground/90 leading-relaxed">
      {displayed}
      {index < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-[2px] h-[1.2em] bg-foreground/60 ml-0.5 align-middle"
        />
      )}
    </span>
  );
}

export function AwakeningScreen({ onComplete }: AwakeningScreenProps) {
  const t = useTranslations('onboarding');
  const [phase, setPhase] = useState<'avatar' | 'greeting' | 'done'>('avatar');

  useEffect(() => {
    const timer = setTimeout(() => setPhase('greeting'), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      {/* AI Avatar */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="relative mb-12"
      >
        {/* Outer glow */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.2) 50%, transparent 70%)',
            width: 160,
            height: 160,
            margin: -20,
          }}
        />
        {/* Main orb */}
        <motion.div
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="w-[120px] h-[120px] rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6)',
          }}
        />
        {/* Inner circle */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[100px] rounded-full bg-background"
        />
        {/* Center glow */}
        <motion.div
          animate={{
            scale: [0.8, 1, 0.8],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60px] h-[60px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.6) 0%, rgba(59,130,246,0.3) 60%, transparent 100%)',
          }}
        />
      </motion.div>

      {/* Greeting text */}
      <AnimatePresence>
        {phase === 'greeting' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-lg"
          >
            <TypewriterText
              text={t('greeting')}
              onComplete={() => setPhase('done')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue indicator */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onComplete}
            className="mt-12 px-8 py-3 rounded-full border border-foreground/20 text-foreground/70 hover:text-foreground hover:border-foreground/40 transition-colors font-serif text-sm tracking-wide"
          >
            {t('continue')}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
