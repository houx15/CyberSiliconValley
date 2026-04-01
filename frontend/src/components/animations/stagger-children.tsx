'use client';

import type { ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22 },
  },
};

export function StaggerChildren({
  children,
  className,
  staggerMs = 90,
}: StaggerChildrenProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: staggerMs / 1000 },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
