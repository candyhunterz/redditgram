import { useState, useCallback } from 'react';
import type { RedditPost } from '@/types/reddit';

/**
 * Manages the fullscreen dialog open/close state and the selected post.
 *
 * Clearing the selected post is deferred by 300ms on close so the dialog
 * exit animation has time to complete before the content unmounts.
 */
export function useFullscreenDialog() {
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const openDialog = useCallback((post: RedditPost) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(() => { setSelectedPost(null); }, 300);
  }, []);

  return { selectedPost, isDialogOpen, openDialog, closeDialog };
}
