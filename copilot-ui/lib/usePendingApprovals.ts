'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingApprovals } from './api';

export function usePendingApprovals(pollIntervalMs = 30_000) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const list = await getPendingApprovals();
      setCount(list.length);
    } catch {
      // silently ignore — network errors shouldn't break the nav
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { count, refresh };
}
