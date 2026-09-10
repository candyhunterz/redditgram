'use client';

import React, { useEffect, useRef, useState } from 'react';

// One observer for the entire feed, including across pagination updates.
const listeners = new Map<Element, (entry: IntersectionObserverEntry) => void>();
let observer: IntersectionObserver | undefined;

interface WindowedPostProps {
  children: React.ReactNode;
  initialVisible: boolean;
  gap: number;
}

/** Retain inexpensive, measured placeholders while distant media is unmounted. */
export function WindowedPost({ children, initialVisible, gap }: WindowedPostProps) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initialVisible);
  const ratio = useRef('1 / 1');

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => listeners.get(entry.target)?.(entry));
      }, { rootMargin: '1000px 0px' });
    }
    listeners.set(node, entry => {
      if (entry.isIntersecting || node.contains(document.activeElement)) {
        setVisible(true);
      } else {
        const { width, height } = entry.boundingClientRect;
        if (width > 0 && height > 0) ratio.current = `${width} / ${height}`;
        setVisible(false);
      }
    });
    observer.observe(node);
    return () => {
      observer?.unobserve(node);
      listeners.delete(node);
      if (listeners.size === 0) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  }, []);

  return (
    <div ref={element} style={{ marginBottom: gap, ...(!visible ? { aspectRatio: ratio.current } : {}) }}>
      {visible ? children : null}
    </div>
  );
}
