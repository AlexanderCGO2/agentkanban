'use client';

import { useState, useCallback } from 'react';

interface V0Response {
  id: string;
  demo: string;
  code?: string;
}

interface V0State {
  isLoading: boolean;
  error: string | null;
  response: V0Response | null;
  isConfigured: boolean | null;
}

export function useV0() {
  const [state, setState] = useState<V0State>({
    isLoading: false,
    error: null,
    response: null,
    isConfigured: null,
  });

  const [chatId, setChatId] = useState<string | null>(null);

  // Check if v0 is configured
  const checkConfiguration = useCallback(async () => {
    try {
      const res = await fetch('/api/v0');
      const data = await res.json();
      setState(prev => ({ ...prev, isConfigured: data.configured }));
      return data.configured;
    } catch {
      setState(prev => ({ ...prev, isConfigured: false }));
      return false;
    }
  }, []);

  // Generate a component with v0
  const generate = useCallback(async (message: string): Promise<V0Response | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch('/api/v0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to generate');
      }

      const data: V0Response = await res.json();
      setChatId(data.id);
      setState(prev => ({
        ...prev,
        isLoading: false,
        response: data,
      }));
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [chatId]);

  // Reset the conversation
  const reset = useCallback(() => {
    setChatId(null);
    setState({
      isLoading: false,
      error: null,
      response: null,
      isConfigured: state.isConfigured,
    });
  }, [state.isConfigured]);

  return {
    ...state,
    chatId,
    generate,
    reset,
    checkConfiguration,
  };
}
