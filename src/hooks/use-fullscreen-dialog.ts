import { useState, useCallback, useRef, useEffect } from 'react';
import type { RedditPost } from '@/types/reddit';

/**
 * Manages the fullscreen dialog open/close state and the selected post.
 *
 * Clearing the selected post is deferred by 300ms on close so the dialog
 * exit animation has time to complete before the content unmounts.
 */
export function useFullscreenDialog() {
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const openDialog = useCallback((post: RedditPost, mediaIndex = 0) => {
    clearTimeout(closeTimer.current);
    setSelectedPost(post);
    setSelectedMediaIndex(mediaIndex);
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { setSelectedPost(null); }, 300);
  }, []);

  return { selectedPost, selectedMediaIndex, isDialogOpen, openDialog, closeDialog };
}
