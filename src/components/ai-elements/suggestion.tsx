'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SuggestionsProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const Suggestions = React.forwardRef<HTMLDivElement, SuggestionsProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-wrap gap-2 mb-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-500',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Suggestions.displayName = 'Suggestions';

export interface SuggestionProps extends React.ComponentProps<'button'> {
  suggestion: string;
}

export const Suggestion = React.forwardRef<HTMLButtonElement, SuggestionProps>(
  ({ className, suggestion, onClick, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-all',
          'hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md hover:scale-[1.02]',
          'dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-700',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300',
          className
        )}
        {...props}
      >
        <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {children || suggestion}
      </button>
    );
  }
);
Suggestion.displayName = 'Suggestion';
