'use client';

import { motion } from 'framer-motion';

const COLOR_MAP = {
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
} as const;

interface PulseDotProps {
  color?: keyof typeof COLOR_MAP;
  size?: number;
  className?: string;
}

export function PulseDot({
  color = 'green',
  size = 8,
  className = '',
}: PulseDotProps) {
  return (
    <span className={`relative inline-flex ${className}`}>
      <motion.span
        className={`absolute inline-flex h-full w-full rounded-full ${COLOR_MAP[color]} opacity-70`}
        animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span
        className={`relative inline-flex rounded-full ${COLOR_MAP[color]}`}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
