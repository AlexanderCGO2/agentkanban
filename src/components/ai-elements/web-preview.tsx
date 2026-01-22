'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface WebPreviewContextValue {
  src?: string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const WebPreviewContext = React.createContext<WebPreviewContextValue | null>(null);

function useWebPreview() {
  const context = React.useContext(WebPreviewContext);
  if (!context) {
    throw new Error('useWebPreview must be used within a WebPreview');
  }
  return context;
}

export interface WebPreviewProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const WebPreview = React.forwardRef<HTMLDivElement, WebPreviewProps>(
  ({ className, children, ...props }, ref) => {
    const [isLoading, setIsLoading] = React.useState(false);

    return (
      <WebPreviewContext.Provider value={{ isLoading, setIsLoading }}>
        <div
          ref={ref}
          className={cn('flex size-full flex-col bg-zinc-50 dark:bg-zinc-900', className)}
          {...props}
        >
          {children}
        </div>
      </WebPreviewContext.Provider>
    );
  }
);
WebPreview.displayName = 'WebPreview';

export interface WebPreviewNavigationProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const WebPreviewNavigation = React.forwardRef<HTMLDivElement, WebPreviewNavigationProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800',
          className
        )}
        {...props}
      >
        {/* Browser-style buttons */}
        <div className="flex gap-1.5 mr-2">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-yellow-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        {children}
      </div>
    );
  }
);
WebPreviewNavigation.displayName = 'WebPreviewNavigation';

export interface WebPreviewUrlProps extends Omit<React.ComponentProps<'input'>, 'type'> {
  value?: string;
}

export const WebPreviewUrl = React.forwardRef<HTMLInputElement, WebPreviewUrlProps>(
  ({ className, value, placeholder = 'Enter URL...', ...props }, ref) => {
    const { isLoading } = useWebPreview();

    return (
      <div className="relative flex-1">
        <input
          ref={ref}
          type="text"
          value={value}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 placeholder-zinc-400',
            'focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
            'dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200 dark:placeholder-zinc-500',
            className
          )}
          {...props}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500 dark:border-zinc-600 dark:border-t-indigo-400" />
          </div>
        )}
      </div>
    );
  }
);
WebPreviewUrl.displayName = 'WebPreviewUrl';

export interface WebPreviewBodyProps extends React.ComponentProps<'div'> {
  src?: string;
  fallback?: React.ReactNode;
}

export const WebPreviewBody = React.forwardRef<HTMLDivElement, WebPreviewBodyProps>(
  ({ className, src, fallback, ...props }, ref) => {
    const { setIsLoading } = useWebPreview();
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
      if (src) {
        setIsLoading(true);
        setError(false);
      }
    }, [src, setIsLoading]);

    const handleLoad = () => {
      setIsLoading(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setError(true);
    };

    if (!src) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-800',
            className
          )}
          {...props}
        >
          {fallback || (
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Preview will appear here
              </p>
            </div>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-800',
            className
          )}
          {...props}
        >
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">
              Failed to load preview
            </p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn('flex-1 overflow-hidden bg-white dark:bg-zinc-900', className)}
        {...props}
      >
        <iframe
          src={src}
          className="h-full w-full border-0"
          title="Preview"
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>
    );
  }
);
WebPreviewBody.displayName = 'WebPreviewBody';
