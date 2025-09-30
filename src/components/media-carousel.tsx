'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Video, X, Heart } from 'lucide-react';

interface MediaCarouselProps {
  mediaUrls: string[];
  title: string;
  subreddit: string;
  postId: string;
  isFullScreen?: boolean;
  isUnplayableVideoFormat?: boolean;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  priority?: boolean;
}

/**
 * MediaCarousel component for displaying Reddit post media
 * Supports images, videos, galleries with navigation and fullscreen view
 */
export const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({
  mediaUrls,
  title,
  subreddit,
  postId,
  isFullScreen = false,
  isUnplayableVideoFormat = false,
  onToggleFavorite,
  isFavorite = false,
  priority = false
}) => {
  // State and Refs
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [imageError, setImageError] = useState<Set<number>>(new Set());
  const [shouldLoadVideo, setShouldLoadVideo] = useState(isFullScreen);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeThreshold = 50;

  // Derived State & Callbacks
  const validMediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];
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

  // Handle image load errors
  const handleImageError = useCallback(() => {
    setImageError(prev => new Set(prev).add(currentMediaIndex));
  }, [currentMediaIndex]);

  // Swipe Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isFullScreen || !showButtons) return;
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !isFullScreen || !showButtons) return;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || touchEndX.current === null || !isFullScreen || !showButtons) return;
    const diffX = touchStartX.current - touchEndX.current;
    if (Math.abs(diffX) > swipeThreshold) {
      if (diffX > 0) {
        nextMedia();
      } else {
        prevMedia();
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Effects
  useEffect(() => {
    setCurrentMediaIndex(0);
    setImageError(new Set());
  }, [mediaUrls]);

  // Keyboard navigation effect
  useEffect(() => {
    if (!isFullScreen || !showButtons) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        nextMedia();
      } else if (event.key === 'ArrowLeft') {
        prevMedia();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen, showButtons, nextMedia, prevMedia]);

  // Lazy load videos using Intersection Observer
  useEffect(() => {
    if (isFullScreen || shouldLoadVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoadVideo(true);
          }
        });
      },
      { rootMargin: '100px' } // Load videos 100px before they enter viewport
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [isFullScreen, shouldLoadVideo]);

  // Render Logic
  if (!validMediaUrls || validMediaUrls.length === 0) {
    return (
      <div className="w-full h-full aspect-square bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-muted-foreground">
        Media Error
      </div>
    );
  }

  // Unplayable Placeholder (Grid View Only)
  if (isUnplayableVideoFormat && !isFullScreen) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 p-2 text-center overflow-hidden">
        {currentMediaUrl && (
          <Image
            src={currentMediaUrl}
            alt={`${title} (Preview)`}
            fill
            sizes="300px"
            className="absolute inset-0 object-cover opacity-10 dark:opacity-5 blur-[2px]"
            priority={priority}
          />
        )}
        <div className="relative z-10 flex flex-col items-center">
          <Video className="w-6 h-6 mb-1 opacity-40" />
          <p className="text-xs font-semibold leading-tight line-clamp-2" title={title}>
            {title}
          </p>
          <p className="text-xs font-medium leading-tight">Video format not supported</p>
          <a
            href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 text-xs underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            View on Reddit
          </a>
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
      {/* Top Control Bar (Rendered only when fullscreen) */}
      {isFullScreen && (
        <div className="absolute top-0 left-0 right-0 z-40 p-2 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex justify-between items-center">
          {/* Left side - Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-white hover:bg-white/20 active:scale-90"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
          >
            <Heart className={cn("h-5 w-5", isFavorite ? "fill-current" : "")} />
          </Button>

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
          <button
            onClick={prevMedia}
            aria-label="Previous Media"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextMedia}
            aria-label="Next Media"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"
          >
            <ChevronRight size={24} />
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
            {validMediaUrls.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-2 w-2 rounded-full transition-all duration-300',
                  index === currentMediaIndex
                    ? 'bg-white scale-110'
                    : 'bg-gray-400 opacity-50 scale-90'
                )}
              />
            ))}
          </div>
        </>
      )}

      {/* Media Content Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {isUnplayableVideoFormat && isFullScreen ? (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-gray-900 text-white p-4 text-center">
            {currentMediaUrl && !imageError.has(currentMediaIndex) && (
              <Image
                src={currentMediaUrl}
                alt={`${title} (Preview)`}
                width={800}
                height={600}
                sizes="(max-width: 768px) 95vw, 90vw"
                className="max-w-full max-h-[70vh] object-contain mb-4 bg-gray-700"
                placeholder="empty"
                onError={handleImageError}
              />
            )}
            <Video className="w-10 h-10 mb-2 opacity-60" />
            <p className="text-base font-semibold mb-2">Video format not supported in this app.</p>
            <a
              href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base underline text-blue-400 hover:text-blue-300"
            >
              View Original Post on Reddit
            </a>
          </div>
        ) : isVideo ? (
          shouldLoadVideo ? (
            <video
              key={`${currentMediaUrl}-${currentMediaIndex}`}
              src={currentMediaUrl}
              className={cn(
                "object-contain block",
                isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'h-auto w-full'
              )}
              controls={isFullScreen}
              muted={!isFullScreen}
              playsInline
              autoPlay={isFullScreen}
              loop
            />
          ) : (
            <div className="w-full h-64 bg-gray-800 flex items-center justify-center">
              <Video className="w-8 h-8 text-gray-400 animate-pulse" />
            </div>
          )
        ) : (
          !imageError.has(currentMediaIndex) && (
            <Image
              key={`${currentMediaUrl}-${currentMediaIndex}`}
              src={currentMediaUrl}
              alt={title}
              width={isFullScreen ? 1200 : 300}
              height={isFullScreen ? 800 : 300}
              sizes={isFullScreen ? '(max-width: 768px) 95vw, 90vw' : '(max-width: 768px) 33vw, 16vw'}
              className={cn(
                "block bg-gray-200 dark:bg-gray-800",
                isFullScreen
                  ? 'max-h-[90vh] max-w-[95vw] object-contain'
                  : 'h-auto w-full object-cover'
              )}
              placeholder="empty"
              priority={priority}
              onError={handleImageError}
            />
          )
        )}

        {!isFullScreen && !isUnplayableVideoFormat && (
          <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" />
        )}

        {isFullScreen && !isUnplayableVideoFormat && (
          <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white p-4 z-30 pointer-events-none">
            <p className="text-base md:text-lg font-semibold">
              {title} (From:{' '}
              <a
                href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                r/{subreddit}
              </a>
              )
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

MediaCarousel.displayName = 'MediaCarousel';