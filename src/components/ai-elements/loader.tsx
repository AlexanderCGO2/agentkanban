'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LoaderProps extends React.ComponentProps<'div'> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dots' | 'spinner' | 'pulse';
}

export const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  ({ className, size = 'md', variant = 'dots', ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-1 w-1',
      md: 'h-1.5 w-1.5',
      lg: 'h-2 w-2',
    };

    const gapClasses = {
      sm: 'gap-0.5',
      md: 'gap-1',
      lg: 'gap-1.5',
    };

    if (variant === 'spinner') {
      const spinnerSizes = {
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-3',
      };

      return (
        <div
          ref={ref}
          className={cn(
            'animate-spin rounded-full border-zinc-200 border-t-indigo-500 dark:border-zinc-700 dark:border-t-indigo-400',
            spinnerSizes[size],
            className
          )}
          {...props}
        />
      );
    }

    if (variant === 'pulse') {
      const pulseSizes = {
        sm: 'h-3 w-12',
        md: 'h-4 w-16',
        lg: 'h-5 w-20',
      };

      return (
        <div
          ref={ref}
          className={cn(
            'animate-pulse rounded-full bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-200 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700',
            pulseSizes[size],
            className
          )}
          {...props}
        />
      );
    }

    // Default: dots
    return (
      <div
        ref={ref}
        className={cn('flex items-center', gapClasses[size], className)}
        {...props}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'rounded-full bg-current opacity-60',
              sizeClasses[size]
            )}
            style={{
              animation: 'bounce 1.4s infinite ease-in-out both',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
        <style jsx>{`
          @keyframes bounce {
            0%, 80%, 100% {
              transform: scale(0);
            }
            40% {
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }
);
Loader.displayName = 'Loader';
