// src/app/page.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
// *** Standard Imports ***
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RedditPost, getPosts, SortType, TimeFrame } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Video, Copy as GalleryIcon, Filter, Loader2, ArrowUp, Heart, Sun, Moon, ArrowUpCircle, MessageCircle, Share2, Download, TrendingUp, HelpCircle, Keyboard, Search, Grid3X3, LayoutGrid, Grid2X2, Settings } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useSubredditHistory, POPULAR_SUBREDDITS } from "@/hooks/use-subreddit-history";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatRelativeTime, formatNumber } from "@/lib/format-time";
import { sharePost } from "@/lib/share";
import { downloadMedia } from "@/lib/download";
import { usePostSearch } from "@/hooks/use-post-search";
import { useGridDensity, DENSITY_CONFIG } from "@/hooks/use-grid-density";
import { useSettings } from "@/hooks/use-settings";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { SettingsModal } from "@/components/settings-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose // Keep DialogClose import as it's used within MediaCarousel now
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Masonry from 'react-masonry-css';
import { ProgressiveImage, ProgressiveVideo } from '@/components/progressive-image';
import {
  getCachedPosts,
  setCachedPosts,
  clearOldCache,
  getAllFavorites,
  saveAllFavorites,
  getAllSavedLists,
  saveAllLists,
  FeedPreset,
} from '@/lib/indexed-db';
import { FeedPresetBar } from '@/components/feed-preset-bar';
import { usePrefetch } from '@/hooks/use-prefetch';
// *** End Standard Imports ***


// --- Helper Functions & Constants ---
const isValidSubreddit = (subreddit: string): boolean => {
  return /^[a-zA-Z0-9_]+$/.test(subreddit) && subreddit.length > 0;
};

const parseSubreddits = (input: string): string[] => {
  return input.split(',').map(s => s.trim()).filter(s => s !== '');
};

const POSTS_PER_LOAD = 20;

// --- Define Types ---
type CachedRedditResponse = {
    posts: RedditPost[];
    after: string | null;
};
type CacheKey = string;

// --- Define Favorites Types ---
interface FavoritePostInfo {
    postId: string;
    title: string;
    subreddit: string;
    thumbnailUrl: string | undefined;
    mediaUrls?: string[];
    fullQualityUrls?: string[];
}
type FavoritesMap = { [postId: string]: FavoritePostInfo };


// --- MediaCarousel Component (Updated with Top Control Bar) ---
interface MediaCarouselProps {
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

const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({
    mediaUrls, fullQualityUrls, title, subreddit, postId, isFullScreen = false, isUnplayableVideoFormat = false,
    onToggleFavorite, isFavorite = false, onClose, onShare, onDownload
}) => {
    // --- State and Refs ---
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const isMobile = useIsMobile();
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const touchEndY = useRef<number | null>(null);
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


// --- Interleaving Helper ---
const interleavePosts = (groupedPosts: RedditPost[][]): RedditPost[] => {
    if (!groupedPosts || groupedPosts.length === 0) return [];
    const interleaved: RedditPost[] = [];
    const groupCount = groupedPosts.length;
    const maxLength = Math.max(...groupedPosts.map(group => group.length));
    for (let j = 0; j < maxLength; j++) {
        for (let i = 0; i < groupCount; i++) {
            if (j < groupedPosts[i].length) interleaved.push(groupedPosts[i][j]);
        }
    }
    return interleaved;
};


// --- Home Page Component ---
export default function Home() {
  // --- State Variables ---
  const [subredditInput, setSubredditInput] = useState<string>('');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [afterTokens, setAfterTokens] = useState<{ [subreddit: string]: string | null }>({});
  const [hasMore, setHasMore] = useState(true);
  const [fetchInitiated, setFetchInitiated] = useState(false);
  const [favorites, setFavorites] = useState<FavoritesMap>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortType, setSortType] = useState<SortType>('hot');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [presets, setPresets] = useState<FeedPreset[]>([]);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [favoritesLoadComplete, setFavoritesLoadComplete] = useState(false);

  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { history: subredditHistory, addToHistory, getSuggestions } = useSubredditHistory();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Centralized settings
  const {
    settings,
    updateSetting,
    resetSettings,
    resolvedTheme,
  } = useSettings();

  // Phase 3 hooks
  const { density, setDensity, cycleDensity, config: densityConfig, gridStyle } = useGridDensity();

  // Sync settings.gridDensity with useGridDensity hook
  useEffect(() => {
    if (settings.gridDensity !== density) {
      setDensity(settings.gridDensity);
    }
  }, [settings.gridDensity, density, setDensity]);

  // --- Cache ---
  const apiCache = useRef(new Map<CacheKey, CachedRedditResponse>()).current;
  const generateCacheKey = ( sub: string, sort: SortType, time?: TimeFrame, after?: string | null ): CacheKey => {
      const timeKey = sort === 'top' ? (time || 'all') : 'hot';
      const afterKey = after || 'initial';
      return `${sub}::${sort}::${timeKey}::${afterKey}`;
  };

  // --- Filtered Posts with Search ---
  const basePosts = useMemo(() => {
    let result: RedditPost[];

    if (!showFavoritesOnly) {
        // When showing all posts, return the fetched posts array directly
        // Ensure the isUnplayable flag from fetch is preserved
        result = posts.map(p => ({...p, isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false}));
    } else {
        // When showing only favorites, map the favorites map values
        result = Object.values(favorites).map((favInfo): RedditPost => {
            // Use stored arrays; fall back to thumbnailUrl for old favorites
            const mediaUrls = favInfo.mediaUrls?.length ? favInfo.mediaUrls
                : (favInfo.thumbnailUrl ? [favInfo.thumbnailUrl] : []);
            const fullQualityUrls = favInfo.fullQualityUrls?.length ? favInfo.fullQualityUrls
                : mediaUrls;

            return {
              postId: favInfo.postId,
              title: favInfo.title,
              subreddit: favInfo.subreddit,
              mediaUrls,
              fullQualityUrls,
              isUnplayableVideoFormat: false
            };
        });
    }

    return result;
  }, [posts, favorites, showFavoritesOnly]);

  // Apply search filter
  const { searchQuery, setSearchQuery, filteredPosts: postsToDisplay, clearSearch, highlightMatch } = usePostSearch(basePosts);

  // --- Load/Save Feed Presets (IndexedDB) ---
  useEffect(() => {
    const loadLists = async () => {
      try {
        // Clear old cache on mount
        await clearOldCache();

        // Load feed presets from IndexedDB
        const loadedPresets = await getAllSavedLists();
        if (loadedPresets.length > 0) {
          setPresets(loadedPresets);
        }

        // Mark initial load as complete
        setInitialLoadComplete(true);
      } catch (err) {
        console.error("Failed to load presets:", err);
        setInitialLoadComplete(true);
      }
    };
    loadLists();
  }, []);

  useEffect(() => {
    // Don't save until initial load is complete
    if (!initialLoadComplete) return;

    const saveLists = async () => {
      try {
        await saveAllLists(presets);
      } catch (err) {
        console.error("Failed to save presets:", err);
        toast({
          variant: "destructive",
          title: "Save Error",
          description: "Failed to save presets to storage."
        });
      }
    };
    saveLists();
  }, [presets, toast, initialLoadComplete]);

  // --- Load/Save Favorites (IndexedDB) ---
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getAllFavorites();
        if (Object.keys(favs).length > 0) {
          setFavorites(favs);
        }

        // Mark favorites load as complete
        setFavoritesLoadComplete(true);
      } catch (err) {
        console.error("Failed to load favorites:", err);
        setFavoritesLoadComplete(true);
      }
    };
    loadFavorites();
  }, []);

  useEffect(() => {
    // Don't save until initial load is complete
    if (!favoritesLoadComplete) return;

    const saveFavorites = async () => {
      try {
        await saveAllFavorites(favorites);
      } catch (err) {
        console.error("Failed to save favorites:", err);
        toast({
          variant: "destructive",
          title: "Save Error",
          description: "Failed to save favorites to storage."
        });
      }
    };
    saveFavorites();
  }, [favorites, toast, favoritesLoadComplete]);

  // --- Favorites Handlers ---
  const toggleFavorite = useCallback((post: RedditPost) => {
    setFavorites(currentFavorites => {
      const newFavorites = { ...currentFavorites };
      if (!currentFavorites[post.postId]) {
        // Add to favorites
        newFavorites[post.postId] = {
          postId: post.postId,
          title: post.title,
          subreddit: post.subreddit,
          thumbnailUrl: post.mediaUrls?.[0],
          mediaUrls: post.mediaUrls || [],
          fullQualityUrls: post.fullQualityUrls || post.mediaUrls || [],
        };
        toast({ description: "Added to favorites" });
      } else {
        // Remove from favorites
        delete newFavorites[post.postId];
        toast({ description: "Removed from favorites" });
      }
      return newFavorites;
    });
  }, [toast]);

  // --- Infinite Scroll ---
  const observer = useRef<IntersectionObserver>();
  const loadMorePostsRef = useRef<() => Promise<void>>();
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || showFavoritesOnly) return; // Don't observe when showing favorites
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && hasMore && fetchInitiated) { loadMorePostsRef.current?.(); }
      }, { threshold: 0.5 });
      if (node) observer.current.observe(node);
    }, [isLoading, hasMore, fetchInitiated, showFavoritesOnly]);

   // --- Data Fetching (with Caching) ---
   const performFetch = useCallback(async (
      subredditsToFetch: string[],
      currentSortType: SortType,
      currentTimeFrame: TimeFrame | undefined,
      currentAfterTokens: { [subreddit: string]: string | null }
   ): Promise<{
        groupedPosts: RedditPost[][];
        updatedAfterTokens: { [subreddit: string]: string | null };
        anyHasMore: boolean;
    }> => {

    if (subredditsToFetch.length === 0) return { groupedPosts: [], updatedAfterTokens: {}, anyHasMore: false };
    if (!subredditsToFetch.every(isValidSubreddit)) throw new Error("Invalid subreddit name found.");

    type SuccessfulFetchValue = { posts: RedditPost[]; after: string | null; sub: string; };
    let overallError: Error | null = null;
    const fetchPromises: Promise<SuccessfulFetchValue>[] = [];
    const subOrderForResults: string[] = [];

    for (const sub of subredditsToFetch) {
        const afterParam = currentAfterTokens[sub] ?? undefined;
        const cacheKey = generateCacheKey(sub, currentSortType, currentSortType === 'top' ? currentTimeFrame : undefined, afterParam);
        subOrderForResults.push(sub);

        // Check in-memory cache first (fastest)
        if (apiCache.has(cacheKey)) {
            console.log(`%cMemory Cache HIT for key: ${cacheKey}`, 'color: green');
            const cachedData = apiCache.get(cacheKey)!;
            const postsWithMetadata = cachedData.posts.map(p => ({
                ...p,
                subreddit: sub,
                isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false
            }));
            fetchPromises.push(Promise.resolve({
                posts: postsWithMetadata,
                after: cachedData.after,
                sub: sub
            }));
        } else {
            // Check IndexedDB cache (persistent)
            fetchPromises.push(
                (async () => {
                    const idbCached = await getCachedPosts(cacheKey);
                    if (idbCached) {
                        console.log(`%cIndexedDB Cache HIT for key: ${cacheKey}`, 'color: blue');
                        // Store in memory cache for faster subsequent access
                        apiCache.set(cacheKey, { posts: idbCached.posts, after: idbCached.after });
                        const postsWithMetadata = idbCached.posts.map(p => ({
                            ...p,
                            subreddit: sub,
                            isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false
                        }));
                        return { posts: postsWithMetadata, after: idbCached.after, sub: sub };
                    }

                    // Cache miss - fetch from API
                    console.log(`%cCache MISS for key: ${cacheKey}`, 'color: orange');
                    const response = await getPosts(sub, currentSortType, {
                        timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
                        after: afterParam,
                        limit: POSTS_PER_LOAD
                    });

                    // Store in both caches
                    const dataToCache: CachedRedditResponse = { posts: response.posts, after: response.after };
                    apiCache.set(cacheKey, dataToCache);
                    await setCachedPosts(cacheKey, response.posts, response.after, {
                        subreddit: sub,
                        sortType: currentSortType,
                        timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
                    });
                    console.log(`%cStored in both caches: ${cacheKey}`, 'color: purple');

                    const postsWithMetadata = response.posts.map(p => ({
                        ...p,
                        subreddit: sub,
                        isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false
                    }));
                    return { posts: postsWithMetadata, after: response.after, sub: sub };
                })()
            );
        }
    }

    try {
        const results: PromiseSettledResult<SuccessfulFetchValue>[] = await Promise.allSettled(fetchPromises);
        const successfulResults: SuccessfulFetchValue[] = [];
        const errors: { sub: string, reason: unknown }[] = [];
        const updatedAfterTokens: { [subreddit: string]: string | null } = {};

        results.forEach((result, index) => {
            const sub = subOrderForResults[index];
            if (result.status === 'fulfilled') {
                successfulResults.push(result.value);
                updatedAfterTokens[sub] = result.value.after;
            } else {
                console.error(`Failed to fetch/process for r/${sub}:`, result.reason);
                errors.push({ sub: sub, reason: result.reason });
                updatedAfterTokens[sub] = currentAfterTokens[sub] ?? null;
                if (!overallError) { overallError = result.reason instanceof Error ? result.reason : new Error(`Fetch failed for r/${sub}: ${String(result.reason)}`); }
            }
        });

       if (overallError && successfulResults.length === 0) throw new Error(`All subreddit fetches failed. First error: ${overallError}`);
       else if (overallError) toast({ variant: "destructive", title: "Fetch Warning", description: `Could not load some subreddits. Check console.`});

      const groupedPosts = successfulResults.map(res => res.posts);
      const anyHasMore = Object.values(updatedAfterTokens).some(token => token !== null);
      const finalUpdatedTokens = {...currentAfterTokens, ...updatedAfterTokens};

      return { groupedPosts, updatedAfterTokens: finalUpdatedTokens, anyHasMore };

    } catch (e) { if (e instanceof Error) { throw e; } else { throw new Error('An unexpected error occurred during the fetch process.'); } }
   }, [apiCache, toast, generateCacheKey]);

   const fetchInitialPosts = useCallback(async (inputOverride?: string) => {
     setShowFavoritesOnly(false); // Reset favorites filter when fetching new posts
     setShowSuggestions(false); // Hide suggestions when fetching
     const inputToUse = inputOverride ?? subredditInput;
     let subsToUse = parseSubreddits(inputToUse);

     // Save searched subreddits to history
     subsToUse.forEach(sub => {
       if (isValidSubreddit(sub)) {
         addToHistory(sub);
       }
     });
     if (subsToUse.length === 0) {
        setError("Please enter at least one valid subreddit name.");
        setPosts([]); setFetchInitiated(false); setHasMore(false); return;
     }

     console.log("Clearing initial cache for relevant keys...");
     subsToUse.forEach(sub => {
         const initialCacheKey = generateCacheKey(sub, sortType, sortType === 'top' ? timeFrame : undefined, undefined);
         if (apiCache.has(initialCacheKey)) {
             apiCache.delete(initialCacheKey);
             console.log(`%cCleared initial cache key: ${initialCacheKey}`, 'color: red');
         }
     });

     setIsLoading(true); setError(null); setPosts([]); setAfterTokens({}); setHasMore(true); setFetchInitiated(true);
     try {
         const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch( subsToUse, sortType, timeFrame, {} );
         const interleavedInitialPosts = interleavePosts(groupedPosts);
         setPosts(interleavedInitialPosts); setAfterTokens(updatedAfterTokens); setHasMore(anyHasMore);
          if (interleavedInitialPosts.length === 0 && anyHasMore === false && !error) {
               if (subsToUse.every(isValidSubreddit)) {
                  toast({ description: `No posts found for "${subsToUse.join(', ')}" with the current filters.` });
               } else { toast({ description: "No posts found." }); }
          }
     } catch (e) {
         if (e instanceof Error) { setError(`Fetch error: ${e.message}`); }
         else { setError('An unknown error occurred during the initial fetch.'); }
         setHasMore(false); setPosts([]);
     } finally { setIsLoading(false); }
   }, [subredditInput, sortType, timeFrame, toast, performFetch, apiCache, generateCacheKey]);

   const loadMorePosts = useCallback(async () => {
     if (isLoading || !hasMore || !fetchInitiated) return;
     let subsToUse = parseSubreddits(subredditInput);
     if (subsToUse.length === 0) { setHasMore(false); return; }
     const subsWithPotentialMore = subsToUse.filter(sub => afterTokens[sub] !== null && afterTokens[sub] !== undefined);
     if (subsWithPotentialMore.length === 0) { setHasMore(false); return; }

     setIsLoading(true); setError(null);
     try {
          const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch( subsWithPotentialMore, sortType, timeFrame, afterTokens );
         const interleavedNewPosts = interleavePosts(groupedPosts);
         setPosts(prevPosts => [...prevPosts, ...interleavedNewPosts]);
         setAfterTokens(updatedAfterTokens); setHasMore(anyHasMore);
     } catch (e) {
         if (e instanceof Error) { setError(`Load more error: ${e.message}`); }
         else { setError('An unknown error occurred while loading more posts.'); }
         setHasMore(false);
     } finally { setIsLoading(false); }
   }, [isLoading, hasMore, fetchInitiated, afterTokens, subredditInput, sortType, timeFrame, toast, performFetch, apiCache]);

   useEffect(() => { loadMorePostsRef.current = loadMorePosts; }, [loadMorePosts]);

   // --- Prefetch next page at 80% scroll ---
   const { resetPrefetch } = usePrefetch({
     onPrefetch: loadMorePosts,
     enabled: !isLoading && hasMore && fetchInitiated && !showFavoritesOnly,
     threshold: 80,
   });

   // Reset prefetch trigger when new posts are loaded
   useEffect(() => {
     if (!isLoading && posts.length > 0) {
       resetPrefetch();
     }
   }, [posts.length, isLoading, resetPrefetch]);

   // --- Scroll Listener Effect for Scroll-to-Top Button ---
  useEffect(() => {
    const checkScrollTop = () => {
      if (!showScrollTop && window.scrollY > 400) {
        setShowScrollTop(true);
      } else if (showScrollTop && window.scrollY <= 400) {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', checkScrollTop);
    return () => window.removeEventListener('scroll', checkScrollTop);
  }, [showScrollTop]);


  // --- Event Handlers ---
  const handleThumbnailClick = useCallback((post: RedditPost) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(() => { setSelectedPost(null); }, 300);
  }, []);

  // --- Share Handler ---
  const handleShare = useCallback(async (post: RedditPost) => {
    const result = await sharePost({
      title: post.title,
      subreddit: post.subreddit,
      postId: post.postId,
    });
    if (result.shared) {
      if (result.method === 'clipboard') {
        toast({ description: "Link copied to clipboard" });
      }
    } else {
      toast({ variant: "destructive", description: "Failed to share" });
    }
  }, [toast]);

  // --- Download Handler ---
  const handleDownload = useCallback(async (post: RedditPost) => {
    const urlToDownload = post.fullQualityUrls?.[0] || post.mediaUrls?.[0];
    if (!urlToDownload) {
      toast({ variant: "destructive", description: "No media to download" });
      return;
    }

    toast({ description: "Starting download..." });

    const success = await downloadMedia({
      url: urlToDownload,
      subreddit: post.subreddit,
      postId: post.postId,
    });

    if (success) {
      toast({ description: "Download complete" });
    } else {
      toast({ variant: "destructive", description: "Download failed" });
    }
  }, [toast]);

  // --- Feed Preset Handlers ---
   const handleSavePreset = useCallback(() => {
        const currentInput = subredditInput.trim();
        if (!currentInput) { toast({ variant: "destructive", description: "Input field is empty." }); return; }
        const presetName = window.prompt("Enter a name for this preset:", "");
        if (presetName === null) return;
        const trimmedName = presetName.trim();
        if (!trimmedName) { toast({ variant: "destructive", description: "Preset name cannot be empty." }); return; }
        if (presets.some(p => p.name === trimmedName)) { toast({ variant: "destructive", description: `A preset named "${trimmedName}" already exists.` }); return; }
        const newPreset: FeedPreset = {
          name: trimmedName,
          subreddits: currentInput,
          sortType,
          timeFrame,
          order: Date.now(),
          timestamp: Date.now(),
        };
        setPresets(prev => [...prev, newPreset]);
        setActivePresetName(trimmedName);
        toast({ description: `Preset "${trimmedName}" saved.` });
   }, [subredditInput, sortType, timeFrame, presets, toast]);

   const handleLoadPreset = useCallback((preset: FeedPreset) => {
        setSubredditInput(preset.subreddits);
        setSortType(preset.sortType as SortType);
        setTimeFrame(preset.timeFrame as TimeFrame);
        setActivePresetName(preset.name);
        fetchInitialPosts(preset.subreddits);
   }, [fetchInitialPosts]);

   const handleUpdatePreset = useCallback((presetName: string) => {
        const currentInput = subredditInput.trim();
        if (!currentInput) { toast({ variant: "destructive", description: "Input field is empty." }); return; }
        setPresets(prev => prev.map(p =>
          p.name === presetName
            ? { ...p, subreddits: currentInput, sortType, timeFrame, timestamp: Date.now() }
            : p
        ));
        toast({ description: `Preset "${presetName}" updated.` });
   }, [subredditInput, sortType, timeFrame, toast]);

   const handleDeletePreset = useCallback((presetName: string) => {
        if (window.confirm(`Delete preset "${presetName}"?`)) {
            setPresets(prev => prev.filter(p => p.name !== presetName));
            if (activePresetName === presetName) setActivePresetName(null);
            toast({ description: `Preset "${presetName}" deleted.` });
        }
   }, [activePresetName, toast]);

   const handleRenamePreset = useCallback((oldName: string) => {
        const newName = window.prompt("Enter new name:", oldName);
        if (newName === null) return;
        const trimmed = newName.trim();
        if (!trimmed) { toast({ variant: "destructive", description: "Name cannot be empty." }); return; }
        if (trimmed !== oldName && presets.some(p => p.name === trimmed)) { toast({ variant: "destructive", description: `A preset named "${trimmed}" already exists.` }); return; }
        setPresets(prev => prev.map(p => p.name === oldName ? { ...p, name: trimmed } : p));
        if (activePresetName === oldName) setActivePresetName(trimmed);
        toast({ description: `Preset renamed to "${trimmed}".` });
   }, [presets, activePresetName, toast]);

   // --- Scroll to Top Function ---
   const scrollToTop = () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};

   // --- Masonry Breakpoint Configuration (uses grid density) ---
   const breakpointColumnsObj = useMemo(() => ({
     default: densityConfig.columns.wide,
     1280: densityConfig.columns.desktop,
     1024: densityConfig.columns.tablet,
     768: densityConfig.columns.mobile
   }), [densityConfig]);

   // --- Render ---
  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-screen flex flex-col">
      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="max-w-xl mx-auto space-y-3">
            {/* Header Controls */}
            <div className="flex justify-end gap-1" role="toolbar" aria-label="Main controls">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                aria-label="Show keyboard shortcuts"
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={theme === 'dark'}
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </div>
            {/* Input and Fetch Button */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
                 <div className="relative flex-grow">
                   <Input
                      type="text" aria-label="Enter subreddit names separated by commas"
                      placeholder="Enter subreddits..." value={subredditInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSubredditInput(value);
                        // Get the last word being typed for suggestions
                        const parts = value.split(',');
                        const lastPart = parts[parts.length - 1].trim();
                        if (lastPart.length >= 2) {
                          const matches = getSuggestions(lastPart);
                          setSuggestions(matches.slice(0, 5));
                          setShowSuggestions(matches.length > 0);
                        } else {
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        const parts = subredditInput.split(',');
                        const lastPart = parts[parts.length - 1].trim();
                        if (lastPart.length >= 2) {
                          const matches = getSuggestions(lastPart);
                          setSuggestions(matches.slice(0, 5));
                          setShowSuggestions(matches.length > 0);
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding to allow click on suggestion
                        setTimeout(() => setShowSuggestions(false), 150);
                      }}
                      className="flex-grow text-base w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchInitialPosts(); }}
                   />
                   {/* Suggestions Dropdown */}
                   {showSuggestions && suggestions.length > 0 && (
                     <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg">
                       {suggestions.map((suggestion) => (
                         <button
                           key={suggestion}
                           className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                           onMouseDown={(e) => {
                             e.preventDefault();
                             // Replace the last part with the suggestion
                             const parts = subredditInput.split(',');
                             parts[parts.length - 1] = ' ' + suggestion;
                             setSubredditInput(parts.join(',').replace(/^,\s*/, '').trim());
                             setShowSuggestions(false);
                           }}
                         >
                           r/{suggestion}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
                 <Button onClick={() => fetchInitialPosts()} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform">
                     {isLoading && posts.length === 0 ? "Fetching..." : "Fetch"}
                 </Button>
             </div>
             {/* Popular Subreddits */}
             <div className="flex flex-wrap justify-center gap-1.5">
               <span className="flex items-center text-xs text-muted-foreground mr-1">
                 <TrendingUp className="h-3 w-3 mr-1" />
                 Popular:
               </span>
               {POPULAR_SUBREDDITS.slice(0, 6).map((sub) => (
                 <Button
                   key={sub}
                   variant="ghost"
                   size="sm"
                   className="h-6 px-2 text-xs hover:bg-accent"
                   onClick={() => {
                     setSubredditInput(sub);
                     setTimeout(() => fetchInitialPosts(), 0);
                   }}
                 >
                   r/{sub}
                 </Button>
               ))}
             </div>
             {/* Feed Preset Bar - Always visible */}
             <div className="flex justify-center">
               <FeedPresetBar
                 presets={presets}
                 activePresetName={activePresetName}
                 onLoadPreset={handleLoadPreset}
                 onSavePreset={handleSavePreset}
                 onUpdatePreset={handleUpdatePreset}
                 onDeletePreset={handleDeletePreset}
                 onRenamePreset={handleRenamePreset}
                 disabled={isLoading}
               />
             </div>
             {/* Collapsible Controls */}
            <Collapsible open={isControlsOpen} onOpenChange={setIsControlsOpen}>
                 <div className="flex justify-center mb-2">
                     <CollapsibleTrigger asChild>
                         <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-transform">
                            <Filter className="h-4 w-4 mr-1" /> {isControlsOpen ? "Hide Options" : "Show Options"}
                         </Button>
                     </CollapsibleTrigger>
                 </div>
                <CollapsibleContent className="space-y-3 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    {/* Sort/Timeframe Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
                        <RadioGroup defaultValue="hot" className="flex gap-4" value={sortType} onValueChange={(value) => { if(!isLoading) setSortType(value as SortType)}} aria-label="Sort posts by" >
                            <Label htmlFor="sort-hot" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading}/> <span>Hot</span> </Label>
                            <Label htmlFor="sort-top" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="top" id="sort-top" disabled={isLoading}/> <span>Top</span> </Label>
                        </RadioGroup>
                        {sortType === 'top' && ( <Select value={timeFrame} onValueChange={(value) => {if(!isLoading) setTimeFrame(value as TimeFrame)}} disabled={isLoading} > <SelectTrigger className="w-[180px]" aria-label="Time frame"> <SelectValue placeholder="Time frame" /> </SelectTrigger> <SelectContent> <SelectItem value="day">Today</SelectItem> <SelectItem value="week">This Week</SelectItem> <SelectItem value="month">This Month</SelectItem> <SelectItem value="year">This Year</SelectItem> <SelectItem value="all">All Time</SelectItem> </SelectContent> </Select> )}
                    </div>
                    {/* Search Posts */}
                    {postsToDisplay.length > 0 && (
                      <div className="relative pt-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search loaded posts..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 text-sm"
                            />
                            {searchQuery && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                                onClick={clearSearch}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {searchQuery && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Found {postsToDisplay.length} matching posts
                          </p>
                        )}
                      </div>
                    )}
                    {/* Grid Density and Favorites Toggles */}
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-sm active:scale-95 transition-transform"
                            onClick={cycleDensity}
                            title={`Grid: ${densityConfig.label}`}
                        >
                            {density === 'compact' ? (
                              <Grid3X3 className="h-4 w-4 mr-2" />
                            ) : density === 'comfortable' ? (
                              <LayoutGrid className="h-4 w-4 mr-2" />
                            ) : (
                              <Grid2X2 className="h-4 w-4 mr-2" />
                            )}
                            {densityConfig.label}
                        </Button>
                        <Button
                            variant={showFavoritesOnly ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "text-sm active:scale-95 transition-transform",
                                showFavoritesOnly && "bg-pink-600 hover:bg-pink-700"
                            )}
                            onClick={() => setShowFavoritesOnly(prev => !prev)}
                            disabled={isLoading || Object.keys(favorites).length === 0}
                        >
                            <Heart className={cn(
                                "h-4 w-4 mr-2",
                                showFavoritesOnly && "fill-current"
                            )} />
                            {showFavoritesOnly ? "Showing" : "Show"} Favorites ({Object.keys(favorites).length})
                        </Button>
                    </div>
                </CollapsibleContent>
            </Collapsible>
         </div>
         {/* Error Message - Improved */}
         {error && (
           <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 max-w-md mx-auto">
             <p className="text-destructive text-center text-sm font-medium mb-3">{error}</p>
             <div className="flex justify-center gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => fetchInitialPosts()}
                 disabled={isLoading}
                 className="text-xs"
               >
                 {isLoading ? (
                   <>
                     <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                     Retrying...
                   </>
                 ) : (
                   'Try Again'
                 )}
               </Button>
             </div>
           </div>
         )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow mt-2" role="main" aria-label="Reddit posts gallery">
        {/* Screen reader live region for status updates */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading && posts.length === 0 ? 'Loading posts...' : ''}
          {isLoading && posts.length > 0 ? 'Loading more posts...' : ''}
          {!isLoading && postsToDisplay.length > 0 ? `Showing ${postsToDisplay.length} posts` : ''}
          {!isLoading && fetchInitiated && postsToDisplay.length === 0 ? 'No posts found' : ''}
        </div>

        {/* Initial Loading Skeletons */}
        {isLoading && posts.length === 0 && !error && (
            <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex gap-1.5" columnClassName="my-masonry-grid_column">
                 {Array.from({ length: 18 }).map((_, index) => ( <Skeleton key={`skeleton-${index}`} className="h-64 w-full mb-1.5" /> ))}
            </Masonry>
        )}
        {/* No Posts Message - Improved */}
        {fetchInitiated && postsToDisplay.length === 0 && !isLoading && !error && (
          <div className="text-center mt-10 space-y-4">
            <p className="text-muted-foreground text-lg">No posts found</p>
            <div className="text-sm text-muted-foreground/80 max-w-md mx-auto space-y-2">
              <p>Try the following:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check the subreddit name spelling</li>
                <li>Try a different time frame for &quot;Top&quot; posts</li>
                <li>Some subreddits may have less media content</li>
              </ul>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <p className="text-xs text-muted-foreground w-full">Popular subreddits:</p>
              {['pics', 'aww', 'funny', 'memes', 'earthporn'].map((sub) => (
                <Button
                  key={sub}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSubredditInput(sub);
                    setTimeout(() => fetchInitialPosts(), 0);
                  }}
                  className="text-xs"
                >
                  r/{sub}
                </Button>
              ))}
            </div>
          </div>
        )}
        {/* Posts Grid */}
        {postsToDisplay.length > 0 && (
          <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex" columnClassName="my-masonry-grid_column" style={gridStyle} role="list" aria-label="Media posts">
            {postsToDisplay.map((post, index) => {
                const firstUrl=post?.mediaUrls?.[0];
                const isVideoPost=firstUrl&&firstUrl.endsWith('.mp4');
                const isGalleryPost=post?.mediaUrls?.length>1;
                const isUnplayable = post.isUnplayableVideoFormat ?? false;
                const mediaType = isVideoPost ? 'video' : isGalleryPost ? 'gallery' : 'image';
                return (
                <div key={`${post.subreddit}-${post.postId}`}
                     ref={!showFavoritesOnly && postsToDisplay[postsToDisplay.length-1]===post ? lastPostRef : null}
                     className="mb-1.5" style={{ marginBottom: `${densityConfig.gap}px` }}
                     role="listitem">
                 <Card onClick={()=> !isUnplayable && handleThumbnailClick(post)}
                       onKeyDown={(e) => {
                         if (!isUnplayable && (e.key === 'Enter' || e.key === ' ')) {
                           e.preventDefault();
                           handleThumbnailClick(post);
                         }
                       }}
                       tabIndex={isUnplayable ? -1 : 0}
                       role="button"
                       aria-label={`${post.title} - ${mediaType} from r/${post.subreddit}${post.ups ? `, ${formatNumber(post.ups)} upvotes` : ''}${favorites[post.postId] ? ', favorited' : ''}`}
                       className={cn(
                            "group relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                            !isUnplayable && "hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer",
                            isUnplayable && "cursor-default"
                       )}>
                     {/* Indicators */}
                     {(isVideoPost || isGalleryPost || isUnplayable) && (
                        <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100">
                            {isUnplayable ? <Video className="h-3 w-3 opacity-70"/> :
                             isVideoPost ? <Video className="h-3 w-3"/> :
                             <GalleryIcon className="h-3 w-3"/>}
                        </div>
                     )}
                     {/* Metadata Overlay */}
                     <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                       <div className="flex items-center justify-between text-white text-xs">
                         <div className="flex items-center gap-2">
                           <span className="flex items-center gap-0.5" title="Upvotes">
                             <ArrowUpCircle className="h-3 w-3" />
                             {formatNumber(post.ups ?? 0)}
                           </span>
                           <span className="flex items-center gap-0.5" title="Comments">
                             <MessageCircle className="h-3 w-3" />
                             {formatNumber(post.numComments ?? 0)}
                           </span>
                         </div>
                         {post.createdUtc && (
                           <span className="text-white/80" title={new Date((post.createdUtc ?? 0) * 1000).toLocaleString()}>
                             {formatRelativeTime(post.createdUtc)}
                           </span>
                         )}
                       </div>
                     </div>
                     {/* Grid Item Media Carousel */}
                     <MediaCarousel
                        mediaUrls={post.mediaUrls}
                        fullQualityUrls={post.fullQualityUrls}
                        title={post.title}
                        subreddit={post.subreddit}
                        postId={post.postId}
                        isUnplayableVideoFormat={isUnplayable}
                        onToggleFavorite={() => toggleFavorite(post)}
                        isFavorite={!!favorites[post.postId]}
                     />
                 </Card>
                </div>);
            })}
           </Masonry>
        )}
        {/* Loading More Indicator */}
        {isLoading && postsToDisplay.length > 0 && !showFavoritesOnly && (
          <div className="flex justify-center items-center gap-2 text-center mt-6 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading more...
          </div>
        )}
        {/* End Reached Message */}
        {!hasMore && fetchInitiated && postsToDisplay.length > 0 && !showFavoritesOnly && (
          <p className="text-center mt-6 p-4 text-muted-foreground">You've reached the end!</p>
        )}
      </main>
       {/* --- Scroll-to-Top Button --- */}
      {showScrollTop && (
          <Button
             onClick={scrollToTop}
             variant="secondary"
             size="icon"
             aria-label="Scroll to top"
             className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full shadow-md active:scale-90 transition-all duration-200"
           >
              <ArrowUp className="h-5 w-5" />
           </Button>
      )}

      {/* Fullscreen Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
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
                    onToggleFavorite={() => toggleFavorite(selectedPost)}
                    isFavorite={!!favorites[selectedPost.postId]}
                    onClose={handleDialogClose}
                    onShare={() => handleShare(selectedPost)}
                    onDownload={() => handleDownload(selectedPost)}
                 />
              ) : ( <div className="text-white text-xl">Loading content...</div> )}

              {/* The Close Button is now rendered INSIDE MediaCarousel */}

              {/* --- Content Ends Above --- */}
           </div>
           {/* *** End Inner Wrapper *** */}
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showKeyboardShortcuts} onOpenChange={setShowKeyboardShortcuts}>
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
            <Button variant="outline" size="sm" onClick={() => setShowKeyboardShortcuts(false)}>
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={resetSettings}
        resolvedTheme={resolvedTheme}
      />

      {/* Footer */}
      <footer className="mt-16 md:mt-24 text-center text-sm text-muted-foreground flex-shrink-0 pb-6">
        <p> Built with ❤️ </p>
      </footer>
    </div>
   );
}