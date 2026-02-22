import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Manages the scroll-to-top button visibility and action.
 *
 * Uses a ref to mirror state so the scroll listener reads the current value
 * without including state in deps — listener is attached once (passive).
 */
export function useScrollToTop() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const showScrollTopRef = useRef(false);

  useEffect(() => {
    const checkScrollTop = () => {
      if (!showScrollTopRef.current && window.scrollY > 400) {
        showScrollTopRef.current = true;
        setShowScrollTop(true);
      } else if (showScrollTopRef.current && window.scrollY <= 400) {
        showScrollTopRef.current = false;
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', checkScrollTop, { passive: true });
    return () => window.removeEventListener('scroll', checkScrollTop);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return { showScrollTop, scrollToTop };
}
