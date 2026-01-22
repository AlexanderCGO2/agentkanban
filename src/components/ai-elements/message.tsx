'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type MessageFrom = 'user' | 'assistant' | 'system' | 'tool';

interface MessageContextValue {
  from: MessageFrom;
}

const MessageContext = React.createContext<MessageContextValue | null>(null);

export function useMessage() {
  const context = React.useContext(MessageContext);
  if (!context) {
    throw new Error('useMessage must be used within a Message');
  }
  return context;
}

export interface MessageProps extends React.ComponentProps<'div'> {
  from: MessageFrom;
  children: React.ReactNode;
}

export const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, from, children, ...props }, ref) => {
    const isUser = from === 'user';

    return (
      <MessageContext.Provider value={{ from }}>
        <div
          ref={ref}
          className={cn(
            'flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
            isUser ? 'flex-row-reverse' : 'flex-row',
            className
          )}
          {...props}
        >
          <MessageAvatar from={from} />
          <div
            className={cn(
              'flex flex-col gap-1 max-w-[85%]',
              isUser ? 'items-end' : 'items-start'
            )}
          >
            {children}
          </div>
        </div>
      </MessageContext.Provider>
    );
  }
);
Message.displayName = 'Message';

export interface MessageAvatarProps extends React.ComponentProps<'div'> {
  from: MessageFrom;
}

export const MessageAvatar = React.forwardRef<HTMLDivElement, MessageAvatarProps>(
  ({ className, from, ...props }, ref) => {
    const avatarStyles = {
      user: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white',
      assistant: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white',
      system: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
      tool: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    };

    const icons = {
      user: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      assistant: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      system: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      tool: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm',
          avatarStyles[from],
          className
        )}
        {...props}
      >
        {icons[from]}
      </div>
    );
  }
);
MessageAvatar.displayName = 'MessageAvatar';

export interface MessageContentProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, children, ...props }, ref) => {
    const { from } = useMessage();
    const isUser = from === 'user';

    const contentStyles = {
      user: 'bg-blue-600 text-white',
      assistant: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
      system: 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100 border border-amber-200 dark:border-amber-800',
      tool: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100 border border-emerald-200 dark:border-emerald-800',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser ? 'rounded-br-md' : 'rounded-bl-md',
          contentStyles[from],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
MessageContent.displayName = 'MessageContent';

export interface MessageTimestampProps extends React.ComponentProps<'span'> {
  children: React.ReactNode;
}

export const MessageTimestamp = React.forwardRef<HTMLSpanElement, MessageTimestampProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('text-xs text-zinc-500 dark:text-zinc-400 px-1', className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);
MessageTimestamp.displayName = 'MessageTimestamp';
