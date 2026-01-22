'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PromptInputMessage {
  text?: string;
  files?: File[];
}

interface PromptInputContextValue {
  message: PromptInputMessage;
  setMessage: React.Dispatch<React.SetStateAction<PromptInputMessage>>;
  onSubmit?: (message: PromptInputMessage) => void;
  disabled?: boolean;
}

const PromptInputContext = React.createContext<PromptInputContextValue | null>(null);

function usePromptInput() {
  const context = React.useContext(PromptInputContext);
  if (!context) {
    throw new Error('usePromptInput must be used within a PromptInput');
  }
  return context;
}

export interface PromptInputProps extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  onSubmit?: (message: PromptInputMessage) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const PromptInput = React.forwardRef<HTMLFormElement, PromptInputProps>(
  ({ className, onSubmit, disabled, children, ...props }, ref) => {
    const [message, setMessage] = React.useState<PromptInputMessage>({ text: '' });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (message.text?.trim() || message.files?.length) {
        onSubmit?.(message);
        setMessage({ text: '' });
      }
    };

    return (
      <PromptInputContext.Provider value={{ message, setMessage, onSubmit, disabled }}>
        <form
          ref={ref}
          onSubmit={handleSubmit}
          className={cn(
            'relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm transition-all focus-within:border-zinc-300 focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-800 dark:focus-within:border-zinc-600',
            className
          )}
          {...props}
        >
          {children}
        </form>
      </PromptInputContext.Provider>
    );
  }
);
PromptInput.displayName = 'PromptInput';

export interface PromptInputTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'value' | 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  ({ className, value, onChange, placeholder = 'Type a message...', ...props }, ref) => {
    const { message, setMessage, disabled } = usePromptInput();
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const controlledValue = value !== undefined ? value : message.text;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Always update internal state for submit button to work
      setMessage((prev) => ({ ...prev, text: e.target.value }));
      // Also call external onChange if provided
      if (onChange) {
        onChange(e);
      }

      // Auto-resize
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.currentTarget.form?.requestSubmit();
      }
    };

    return (
      <textarea
        ref={(node) => {
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
          (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }}
        value={controlledValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          'flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100 dark:placeholder-zinc-400',
          'min-h-[36px] max-h-[200px]',
          className
        )}
        {...props}
      />
    );
  }
);
PromptInputTextarea.displayName = 'PromptInputTextarea';

export type PromptInputSubmitStatus = 'ready' | 'streaming' | 'disabled';

export interface PromptInputSubmitProps extends React.ComponentProps<'button'> {
  status?: PromptInputSubmitStatus;
}

export const PromptInputSubmit = React.forwardRef<HTMLButtonElement, PromptInputSubmitProps>(
  ({ className, status = 'ready', disabled, ...props }, ref) => {
    const { message, disabled: contextDisabled } = usePromptInput();
    const isDisabled = disabled || contextDisabled || status === 'disabled' || (!message.text?.trim() && !message.files?.length);
    const isStreaming = status === 'streaming';

    return (
      <button
        ref={ref}
        type="submit"
        disabled={isDisabled}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
          isStreaming
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:brightness-110',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100',
          className
        )}
        {...props}
      >
        {isStreaming ? (
          <svg className="h-4 w-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </button>
    );
  }
);
PromptInputSubmit.displayName = 'PromptInputSubmit';
