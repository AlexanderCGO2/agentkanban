'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ConversationContextValue {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const ConversationContext = React.createContext<ConversationContextValue | null>(null);

export function useConversation() {
  const context = React.useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within a Conversation');
  }
  return context;
}

export interface ConversationProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  ({ className, children, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);

    return (
      <ConversationContext.Provider value={{ scrollRef }}>
        <div
          ref={ref}
          className={cn('flex flex-col h-full', className)}
          {...props}
        >
          {children}
        </div>
      </ConversationContext.Provider>
    );
  }
);
Conversation.displayName = 'Conversation';

export interface ConversationContentProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
}

export const ConversationContent = React.forwardRef<HTMLDivElement, ConversationContentProps>(
  ({ className, children, ...props }, ref) => {
    const { scrollRef } = useConversation();
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when children change
    React.useEffect(() => {
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    }, [children]);

    return (
      <div
        ref={(node) => {
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
          (contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn(
          'flex-1 overflow-y-auto space-y-4 scroll-smooth',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ConversationContent.displayName = 'ConversationContent';
