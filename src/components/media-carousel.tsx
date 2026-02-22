'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DialogClose } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, X, Video, Heart, Share2, Download } from 'lucide-react';
import { ProgressiveImage, ProgressiveVideo } from '@/components/progressive-image';
import { useIsMobile } from '@/hooks/use-mobile';

// --- MediaCarousel Component (Updated with Top Control Bar) ---
export interface MediaCarouselProps {
  mediaUrls: string[];
  fullQualityUrls?: string[];
  title: string;
  subreddit: string;
  postId: string;
  isFullScreen?: boolean;
  isUnplayableVideoFormat?: boolean;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  onClose?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
}

export const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({
    mediaUrls, fullQualityUrls, title, subreddit, postId, isFullScreen = false, isUnplayableVideoFormat = false,
    onToggleFavorite, isFavorite = false, onClose, onShare, onDownload
}) => {
    // --- State and Refs ---
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const isMobile = useIsMobile();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const touchStartX = React.useRef<number | null>(null);
    const touchEndX = React.useRef<number | null>(null);
    const touchStartY = React.useRef<number | null>(null);
    const touchEndY = React.useRef<number | null>(null);
    const swipeThreshold = 50;

    // --- Derived State & Callbacks ---
    // Use full quality URLs for fullscreen, thumbnails for grid
    const urlsToUse = isFullScreen && fullQualityUrls && fullQualityUrls.length > 0 ? fullQualityUrls : mediaUrls;
    const validMediaUrls = Array.isArray(urlsToUse) ? urlsToUse : [];
    const showButtons = validMediaUrls.length > 1 && !isUnplayableVideoFormat;

    const nextMedia = useCallback(() => {
        if (validMediaUrls.length > 0) {
           setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % validMediaUrls.length);
        }
    }, [validMediaUrls.length]);

    const prevMedia = useCallback(() => {
        if (validMediaUrls.length > 0) {
            setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + validMediaUrls.length) % validMediaUrls.length);
        }
    }, [validMediaUrls.length]);

    const currentMediaUrl = validMediaUrls[currentMediaIndex];
    const isVideo = currentMediaUrl?.endsWith('.mp4') && !isUnplayableVideoFormat;

    // --- Swipe Handlers ---
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!isFullScreen) return;
      touchEndX.current = null;
      touchEndY.current = null;
      touchStartX.current = e.targetTouches[0].clientX;
      touchStartY.current = e.targetTouches[0].clientY;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current || !isFullScreen) return;
        touchEndX.current = e.targetTouches[0].clientX;
        touchEndY.current = e.targetTouches[0].clientY;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current || !touchStartY.current || touchEndX.current === null || touchEndY.current === null || !isFullScreen) return;

        const diffX = touchStartX.current - touchEndX.current;
        const diffY = touchStartY.current - touchEndY.current;

        // Determine if this is a vertical or horizontal swipe
        if (Math.abs(diffY) > Math.abs(diffX)) {
            // Vertical swipe - check if it's upward and exceeds threshold
            if (diffY > swipeThreshold && onClose) {
                // Swipe up detected - close the dialog
                onClose();
            }
        } else if (showButtons) {
            // Horizontal swipe - navigate media only if there are multiple items
            if (Math.abs(diffX) > swipeThreshold) {
                if (diffX > 0) { nextMedia(); }
                else { prevMedia(); }
            }
        }

        touchStartX.current = null;
        touchEndX.current = null;
        touchStartY.current = null;
        touchEndY.current = null;
    };

    // --- Effects ---
    // Reset index when media changes
    useEffect(() => { setCurrentMediaIndex(0); }, [mediaUrls]);

    // Keyboard navigation effect
    useEffect(() => {
      if (!isFullScreen || !showButtons) return;
      const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'ArrowRight') { nextMedia(); }
          else if (event.key === 'ArrowLeft') { prevMedia(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => { window.removeEventListener('keydown', handleKeyDown); };
    }, [isFullScreen, showButtons, nextMedia, prevMedia]);


    // --- Render Logic ---
    // No Media Placeholder
    if (!validMediaUrls || validMediaUrls.length === 0) {
      return <div className="w-full h-full aspect-square bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-muted-foreground">Media Error</div>;
    }

    // Unplayable Placeholder (Grid View Only)
    if (isUnplayableVideoFormat && !isFullScreen) {
      return (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-2 text-center overflow-hidden">
              {currentMediaUrl && ( <img src={currentMediaUrl} alt={title + " (Preview)"} className="absolute inset-0 w-full h-full object-cover opacity-10 dark:opacity-5 blur-[2px]" loading="lazy" /> )}
              <div className="relative z-10 flex flex-col items-center">
                   <Video className="w-6 h-6 mb-1 opacity-40" />
                   <p className="text-xs font-semibold leading-tight line-clamp-2" title={title}>
                         {title}
                     </p>
                   <p className="text-xs font-medium leading-tight">Video format not supported</p>
                   <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 text-xs underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"> View on Reddit </a>
              </div>
          </div>
      );
    }

    // Main Render (Playable Content or Fullscreen)
    return (
        <div
            className="relative group w-full h-full bg-black select-none"
            onTouchStart={isFullScreen ? handleTouchStart : undefined}
            onTouchMove={isFullScreen ? handleTouchMove : undefined}
            onTouchEnd={isFullScreen ? handleTouchEnd : undefined}
            ref={containerRef}
        >
            {/* === Top Control Bar (Rendered only when fullscreen) === */}
            {isFullScreen && (
                <div className="absolute top-0 left-0 right-0 z-40 p-2 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex justify-between items-center">
                    {/* Left side - Favorite and Share Buttons */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-white hover:bg-white/20 active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite?.();
                            }}
                            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Heart className={cn("h-5 w-5", isFavorite ? "fill-current" : "")} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-white hover:bg-white/20 active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShare?.();
                            }}
                            aria-label="Share post"
                        >
                            <Share2 className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-white hover:bg-white/20 active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDownload?.();
                            }}
                            aria-label="Download media"
                        >
                            <Download className="h-5 w-5" />
                        </Button>
                    </div>

                    {/* Right side - Close Button */}
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Close dialog"
                            className="rounded-full h-8 w-8 text-white hover:bg-white/20 active:scale-90 focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-0"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </DialogClose>
                </div>
            )}

            {/* Navigation Arrows & Dots */}
            {showButtons && (
                <>
                 <button onClick={prevMedia} aria-label="Previous Media" className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"> <ChevronLeft size={24}/> </button>
                 <button onClick={nextMedia} aria-label="Next Media" className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"> <ChevronRight size={24}/> </button>
                 <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
                    {validMediaUrls.map((_, index) => ( <span key={index} className={cn( 'h-2 w-2 rounded-full transition-all duration-300', index === currentMediaIndex ? 'bg-white scale-110' : 'bg-gray-400 opacity-50 scale-90' )} /> ))}
                 </div>
                </>
            )}

            {/* Media Content Container */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                 {isUnplayableVideoFormat && isFullScreen ? (
                     <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
                         {currentMediaUrl && ( <img src={currentMediaUrl} alt={title + " (Preview)"} className="max-w-full max-h-[70vh] object-contain mb-4"/> )}
                         <Video className="w-10 h-10 mb-2 opacity-60" />
                         <p className="text-base font-semibold mb-2">Video format not supported in this app.</p>
                         <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" className="text-base underline text-blue-400 hover:text-blue-300"> View Original Post on Reddit </a>
                     </div>
                 ) : isVideo ? (
                    <ProgressiveVideo
                      key={`${currentMediaUrl}-${currentMediaIndex}`}
                      src={currentMediaUrl}
                      className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'h-auto w-full')}
                      controls={isFullScreen}
                      muted={!isFullScreen}
                      playsInline
                      autoPlay={isFullScreen}
                      loop
                      preload={isFullScreen ? "auto" : "metadata"}
                    />
                 ) : (
                    <ProgressiveImage
                      key={`${currentMediaUrl}-${currentMediaIndex}`}
                      src={currentMediaUrl}
                      alt={title}
                      className={cn("object-cover block w-full", isFullScreen ? 'max-h-[90vh] max-w-[95vw] object-contain' : 'h-auto')}
                      loading={!isFullScreen ? "lazy" : "eager"}
                    />
                 )}

                 {!isFullScreen && !isUnplayableVideoFormat && ( <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" /> )}

                 {isFullScreen && !isUnplayableVideoFormat && (
                     <div
                        className={cn(
                          "absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white p-4 z-30 pointer-events-none",
                          isMobile && "pb-20" // Extra padding for mobile action bar
                        )}
                      >
                         <p className="text-base md:text-lg font-semibold">
                             {title} (From: <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" className="underline pointer-events-auto" onClick={(e) => e.stopPropagation()} > r/{subreddit} </a>)
                         </p>
                     </div>
                 )}

                 {/* === Mobile Bottom Action Bar === */}
                 {isFullScreen && isMobile && (
                   <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm border-t border-white/10">
                     <div className="flex justify-around items-center py-3 px-4">
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-12 w-12 rounded-full text-white hover:bg-white/20 active:scale-90"
                         onClick={(e) => {
                           e.stopPropagation();
                           onToggleFavorite?.();
                         }}
                         aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                       >
                         <Heart className={cn("h-6 w-6", isFavorite ? "fill-current text-pink-500" : "")} />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-12 w-12 rounded-full text-white hover:bg-white/20 active:scale-90"
                         onClick={(e) => {
                           e.stopPropagation();
                           onShare?.();
                         }}
                         aria-label="Share post"
                       >
                         <Share2 className="h-6 w-6" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-12 w-12 rounded-full text-white hover:bg-white/20 active:scale-90"
                         onClick={(e) => {
                           e.stopPropagation();
                           onDownload?.();
                         }}
                         aria-label="Download media"
                       >
                         <Download className="h-6 w-6" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-12 w-12 rounded-full text-white hover:bg-white/20 active:scale-90"
                         onClick={(e) => {
                           e.stopPropagation();
                           onClose?.();
                         }}
                         aria-label="Close"
                       >
                         <X className="h-6 w-6" />
                       </Button>
                     </div>
                   </div>
                 )}
            </div>
        </div>
    );
});
MediaCarousel.displayName = 'MediaCarousel';
