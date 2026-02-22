'use client';

import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard } from 'lucide-react';
import { MediaCarousel } from '@/components/media-carousel';
import type { RedditPost } from '@/types/reddit';

// --- FullscreenDialog Component ---
interface FullscreenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPost: RedditPost | null;
  favorites: Record<string, any>;
  onToggleFavorite: (post: RedditPost) => void;
  onShare: (post: RedditPost) => void;
  onDownload: (post: RedditPost) => void;
}

export function FullscreenDialog({
  isOpen,
  onClose,
  selectedPost,
  favorites,
  onToggleFavorite,
  onShare,
  onDownload,
}: FullscreenDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Keep DialogContent itself without padding if needed */}
      <DialogContent className="max-w-none w-[95vw] h-[95vh] p-0 bg-transparent border-none overflow-hidden flex items-center justify-center">

         {/* *** MODIFIED: Added padding (e.g., p-4) to this inner wrapper *** */}
         <div className="relative w-full h-full flex items-center justify-center bg-black/90 backdrop-blur-sm p-6">
            {/* --- Content Starts Below --- */}

            <DialogTitle className="sr-only"> Expanded view: {selectedPost?.title || 'Reddit Post'} </DialogTitle>
            <DialogDescription className="sr-only"> Expanded view of Reddit post: {selectedPost?.title || 'Content'}... </DialogDescription>

            {selectedPost ? (
               <MediaCarousel
                  mediaUrls={selectedPost.mediaUrls}
                  fullQualityUrls={selectedPost.fullQualityUrls}
                  title={selectedPost.title}
                  subreddit={selectedPost.subreddit}
                  postId={selectedPost.postId}
                  isFullScreen={true}
                  isUnplayableVideoFormat={selectedPost.isUnplayableVideoFormat ?? false}
                  onToggleFavorite={() => onToggleFavorite(selectedPost)}
                  isFavorite={!!favorites[selectedPost.postId]}
                  onClose={onClose}
                  onShare={() => onShare(selectedPost)}
                  onDownload={() => onDownload(selectedPost)}
               />
            ) : ( <div className="text-white text-xl">Loading content...</div> )}

            {/* The Close Button is now rendered INSIDE MediaCarousel */}

            {/* --- Content Ends Above --- */}
         </div>
         {/* *** End Inner Wrapper *** */}
      </DialogContent>
    </Dialog>
  );
}

// --- KeyboardShortcutsDialog Component ---
interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({
  isOpen,
  onClose,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Keyboard className="h-5 w-5" />
          Keyboard Shortcuts
        </DialogTitle>
        <DialogDescription>
          Use these shortcuts to navigate faster
        </DialogDescription>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Fullscreen View</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">←</kbd>
                <span className="text-sm">Previous image</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">→</kbd>
                <span className="text-sm">Next image</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">Esc</kbd>
                <span className="text-sm">Close fullscreen</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Search</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">Enter</kbd>
                <span className="text-sm">Fetch posts</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Mobile Gestures</h4>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• Swipe left/right to navigate images</p>
              <p>• Swipe up to close fullscreen</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
