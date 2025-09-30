/**
 * Hook for prefetching next page of posts
 * Starts loading when user scrolls to 80% of current content
 */

import { useEffect, useRef, useState } from 'react';

interface UsePrefetchOptions {
  onPrefetch: () => void;
  enabled: boolean;
  threshold?: number; // Percentage (0-100) at which to trigger prefetch
}

export function usePrefetch({
  onPrefetch,
  enabled,
  threshold = 80,
}: UsePrefetchOptions) {
  const [isPrefetching, setIsPrefetching] = useState(false);
  const prefetchTriggeredRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      // Don't trigger multiple prefetches
      if (prefetchTriggeredRef.current || isPrefetching) return;

      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Calculate scroll percentage
      const scrollPercentage = ((scrollTop + windowHeight) / docHeight) * 100;

      // Trigger prefetch when reaching threshold
      if (scrollPercentage >= threshold) {
        prefetchTriggeredRef.current = true;
        setIsPrefetching(true);
        onPrefetch();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [enabled, threshold, onPrefetch, isPrefetching]);

  // Reset prefetch trigger when new content is loaded
  const resetPrefetch = () => {
    prefetchTriggeredRef.current = false;
    setIsPrefetching(false);
  };

  return { isPrefetching, resetPrefetch };
}
