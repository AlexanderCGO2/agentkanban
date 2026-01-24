'use client';

import { useState } from 'react';
import { AgentMessage } from '@/types/agent';

// Cloudflare worker base URL for serving R2 files
const WORKER_BASE_URL = 'https://agentkanban-worker.alexander-53b.workers.dev';

interface MessageListProps {
  messages: AgentMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) return null;

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

/**
 * Extract image URLs from tool results (handles Replicate output format)
 */
function extractImageUrls(content: string): string[] {
  const urls: string[] = [];

  try {
    const parsed = JSON.parse(content);

    // Check for our R2-stored imageUrl (preferred)
    if (parsed.imageUrl) {
      // Convert relative R2 path to full URL
      const url = parsed.imageUrl.startsWith('/')
        ? `${WORKER_BASE_URL}${parsed.imageUrl}`
        : parsed.imageUrl;
      urls.push(url);
    }

    // Check for storedFiles array (all R2-stored files)
    if (parsed.storedFiles && Array.isArray(parsed.storedFiles)) {
      for (const file of parsed.storedFiles) {
        if (file.r2Url) {
          const url = file.r2Url.startsWith('/')
            ? `${WORKER_BASE_URL}${file.r2Url}`
            : file.r2Url;
          if (!urls.includes(url)) {
            urls.push(url);
          }
        }
      }
    }

    // Fallback: Check original Replicate output URLs
    if (urls.length === 0 && parsed.output) {
      if (typeof parsed.output === 'string' && isImageUrl(parsed.output)) {
        urls.push(parsed.output);
      } else if (Array.isArray(parsed.output)) {
        for (const item of parsed.output) {
          if (typeof item === 'string' && isImageUrl(item)) {
            urls.push(item);
          }
        }
      }
    }
  } catch {
    // Not JSON, check for raw URLs in content
    const urlRegex = /https?:\/\/[^\s"']+\.(png|jpg|jpeg|gif|webp)(\?[^\s"']*)?/gi;
    const matches = content.match(urlRegex);
    if (matches) {
      urls.push(...matches);
    }
  }

  return urls;
}

function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url) ||
         url.includes('replicate.delivery') ||
         url.includes('pbxt.replicate.delivery');
}

function MessageItem({ message }: { message: AgentMessage }) {
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getMessageStyles = () => {
    switch (message.type) {
      case 'user':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'assistant':
        return 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700';
      case 'system':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'tool_use':
        return 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800';
      case 'tool_result':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'result':
        return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
      default:
        return 'bg-zinc-50 border-zinc-200 dark:bg-zinc-800/50 dark:border-zinc-700';
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case 'user':
        return (
          <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'assistant':
        return (
          <svg className="h-4 w-4 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'tool_use':
        return (
          <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'tool_result':
        return (
          <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="h-4 w-4 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'result':
        return (
          <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getLabel = () => {
    switch (message.type) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'Assistant';
      case 'tool_use':
        return message.toolName || 'Tool';
      case 'tool_result':
        return 'Tool Result';
      case 'system':
        return 'System';
      case 'result':
        return 'Result';
      default:
        return message.type;
    }
  };

  // Extract images from tool results
  const imageUrls = message.type === 'tool_result' ? extractImageUrls(message.content) : [];

  return (
    <div className={`rounded-lg border p-4 ${getMessageStyles()}`}>
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {getLabel()}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {formatTime(message.timestamp)}
        </span>
      </div>

      {/* Display images if present */}
      {imageUrls.length > 0 && (
        <div className="mb-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
          {imageUrls.map((url, index) => (
            <ImagePreview key={index} url={url} />
          ))}
        </div>
      )}

      <div className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
        {message.content}
      </div>

      {message.toolInput !== undefined && message.toolInput !== null ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
            Show input
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Image preview component with loading state and error handling
 */
function ImagePreview({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}
      {error ? (
        <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">
          Failed to load image
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Generated image"
            className={`w-full h-auto max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity ${loading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </a>
      )}
    </div>
  );
}
