'use client';

import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { cn } from '@/lib/utils';

interface AutoTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxRows?: number;
}

export const AutoTextarea = forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
  ({ className, maxRows = 6, onChange, value, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current!);

    function resize() {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10);
      const maxHeight = lineHeight * maxRows;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }

    useEffect(() => {
      resize();
    });

    return (
      <textarea
        ref={innerRef}
        rows={1}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          resize();
        }}
        className={cn(
          'flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

AutoTextarea.displayName = 'AutoTextarea';
