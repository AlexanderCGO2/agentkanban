'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ReasoningProps extends React.ComponentProps<'div'> {
  expanded?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}

export const Reasoning = React.forwardRef<HTMLDivElement, ReasoningProps>(
  ({ className, expanded = false, onToggle, children, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(expanded);

    const handleToggle = () => {
      setIsExpanded(!isExpanded);
      onToggle?.();
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-purple-50/80 overflow-hidden transition-all',
          'dark:border-violet-800/40 dark:from-violet-950/30 dark:to-purple-950/30',
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors',
            'hover:bg-violet-100/50 dark:hover:bg-violet-900/20'
          )}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
            <svg
              className={cn(
                'h-3.5 w-3.5 text-violet-600 dark:text-violet-400 transition-transform duration-200',
                isExpanded && 'rotate-90'
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            Reasoning
          </span>
          <svg
            className="ml-auto h-4 w-4 text-violet-400 dark:text-violet-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </button>
        {isExpanded && (
          <div className="border-t border-violet-200/60 dark:border-violet-800/40">
            {children}
          </div>
        )}
      </div>
    );
  }
);
Reasoning.displayName = 'Reasoning';

export interface ReasoningContentProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const ReasoningContent = React.forwardRef<HTMLDivElement, ReasoningContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-4 py-3 text-sm text-violet-800 dark:text-violet-200',
          'animate-in fade-in-0 slide-in-from-top-1 duration-200',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ReasoningContent.displayName = 'ReasoningContent';

export interface ReasoningStepProps extends React.ComponentProps<'div'> {
  step: number;
  title: string;
  status?: 'pending' | 'running' | 'complete' | 'error';
  children?: React.ReactNode;
}

export const ReasoningStep = React.forwardRef<HTMLDivElement, ReasoningStepProps>(
  ({ className, step, title, status = 'pending', children, ...props }, ref) => {
    const statusIcons = {
      pending: (
        <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      ),
      running: (
        <div className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
      ),
      complete: (
        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
      error: (
        <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-start gap-3 py-2', className)}
        {...props}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-medium text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
          {step}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-violet-800 dark:text-violet-200">
              {title}
            </span>
            {statusIcons[status]}
          </div>
          {children && (
            <div className="mt-1 text-xs text-violet-600 dark:text-violet-400">
              {children}
            </div>
          )}
        </div>
      </div>
    );
  }
);
ReasoningStep.displayName = 'ReasoningStep';
