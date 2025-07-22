// src/app/page.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
// *** Standard Imports ***
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RedditPost, getPosts, SortType, TimeFrame } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Trash2, Save, X, Video, Copy as GalleryIcon, Filter, Loader2, ArrowUp, Heart } from "lucide-react";
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Masonry from 'react-masonry-css';
// *** End Standard Imports ***


// --- Helper Functions & Constants ---
const isValidSubreddit = (subreddit: string): boolean => {
  return /^[a-zA-Z0-9_]+$/.test(subreddit) && subreddit.length > 0;
};

const parseSubreddits = (input: string): string[] => {
  return input.split(',').map(s => s.trim()).filter(s => s !== '');
};

const POSTS_PER_LOAD = 20;
const LOCAL_STORAGE_SAVED_LISTS_KEY = "savedSubredditLists";
const LOCAL_STORAGE_FAVORITES_KEY = "favoritePosts";


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
}
type FavoritesMap = { [postId: string]: FavoritePostInfo };

// --- Define Saved Lists Type ---
type SavedLists = { [name: string]: string };


// --- MediaCarousel Component (Updated with Top Control Bar) ---
interface MediaCarouselProps {
  mediaUrls: string[];
  title: string;
  subreddit: string;
  postId: string;
  isFullScreen?: boolean;
  isUnplayableVideoFormat?: boolean;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
}

const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({
    mediaUrls, title, subreddit, postId, isFullScreen = false, isUnplayableVideoFormat = false,
    onToggleFavorite, isFavorite = false
}) => {
    // --- State and Refs ---
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const swipeThreshold = 50;

    // --- Derived State & Callbacks ---
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

    // --- Swipe Handlers ---
    const handleTouchStart = (e: React.TouchEvent) => {
      if (!isFullScreen || !showButtons) return;
      touchEndX.current = null; touchStartX.current = e.targetTouches[0].clientX;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartX.current || !isFullScreen || !showButtons) return;
        touchEndX.current = e.targetTouches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartX.current || touchEndX.current === null || !isFullScreen || !showButtons) return;
        const diffX = touchStartX.current - touchEndX.current;
        if (Math.abs(diffX) > swipeThreshold) { if (diffX > 0) { nextMedia(); } else { prevMedia(); } }
        touchStartX.current = null; touchEndX.current = null;
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
                    <video key={`${currentMediaUrl}-${currentMediaIndex}`} src={currentMediaUrl} className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'h-auto w-full')} controls={isFullScreen} muted={!isFullScreen} playsInline autoPlay={isFullScreen} loop />
                 ) : (
                    <img key={`${currentMediaUrl}-${currentMediaIndex}`} src={currentMediaUrl} alt={title} className={cn("object-cover block w-full", isFullScreen ? 'max-h-[90vh] max-w-[95vw] object-contain' : 'h-auto')} loading="lazy" />
                 )}

                 {!isFullScreen && !isUnplayableVideoFormat && ( <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" /> )}

                 {isFullScreen && !isUnplayableVideoFormat && (
                     <div
                        className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white p-4 z-30 pointer-events-none"
                      >
                         <p className="text-base md:text-lg font-semibold">
                             {title} (From: <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" className="underline pointer-events-auto" onClick={(e) => e.stopPropagation()} > r/{subreddit} </a>)
                         </p>
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
  const [savedLists, setSavedLists] = useState<SavedLists>({});
  const [selectedListName, setSelectedListName] = useState<string>("");
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { toast } = useToast();

  // --- Cache ---
  const apiCache = useRef(new Map<CacheKey, CachedRedditResponse>()).current;
  const generateCacheKey = ( sub: string, sort: SortType, time?: TimeFrame, after?: string | null ): CacheKey => {
      const timeKey = sort === 'top' ? (time || 'all') : 'hot';
      const afterKey = after || 'initial';
      return `${sub}::${sort}::${timeKey}::${afterKey}`;
  };

  // --- Filtered Posts ---
  const postsToDisplay = useMemo(() => {
    if (!showFavoritesOnly) {
        // When showing all posts, return the fetched posts array directly
        // Ensure the isUnplayable flag from fetch is preserved
        return posts.map(p => ({...p, isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false}));
    } else {
        // When showing only favorites, map the favorites map values
        return Object.values(favorites).map((favInfo): RedditPost => {
            const thumbnailUrl = favInfo.thumbnailUrl;

            return {
              postId: favInfo.postId,
              title: favInfo.title,
              subreddit: favInfo.subreddit,
              mediaUrls: thumbnailUrl ? [thumbnailUrl] : [], // Use thumbnail
              // *** FIX: Assume thumbnail is displayable, don't mark as unplayable video ***
              isUnplayableVideoFormat: false
            };
        });
    }
  }, [posts, favorites, showFavoritesOnly]);

  // --- Load/Save Saved Lists ---
  useEffect(() => {
    try {
        const storedLists = localStorage.getItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
        if (storedLists) {
            const parsed = JSON.parse(storedLists);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                 setSavedLists(parsed as SavedLists);
            } else { localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY); }
        }
    } catch (err) { console.error("Failed to load saved lists:", err); localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY); }
  }, []);

  useEffect(() => {
    if (Object.keys(savedLists).length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SAVED_LISTS_KEY, JSON.stringify(savedLists));
      } catch (err) {
        console.error("Failed to save lists:", err);
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
          toast({ 
            variant: "destructive", 
            title: "Storage Full",
            description: "Cannot save list. Local storage limit reached." 
          });
        } else {
          toast({ 
            variant: "destructive", 
            title: "Save Error",
            description: "Failed to save lists to storage." 
          });
        }
      }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
      } catch (err) {
        console.error("Failed to remove lists:", err);
      }
    }
  }, [savedLists, toast]);

  // --- Load/Save Favorites ---
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem(LOCAL_STORAGE_FAVORITES_KEY);
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites);
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          setFavorites(parsed as FavoritesMap);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_FAVORITES_KEY);
        }
      }
    } catch (err) {
      console.error("Failed to load favorites:", err);
      localStorage.removeItem(LOCAL_STORAGE_FAVORITES_KEY);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(favorites).length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
      } catch (err) {
        console.error("Failed to save favorites:", err);
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
          toast({ 
            variant: "destructive", 
            title: "Storage Full",
            description: "Cannot save favorites. Local storage limit reached." 
          });
        } else {
          toast({ 
            variant: "destructive", 
            title: "Save Error",
            description: "Failed to save favorites to storage." 
          });
        }
      }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_FAVORITES_KEY);
      } catch (err) {
        console.error("Failed to remove favorites:", err);
      }
    }
  }, [favorites, toast]);

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
          thumbnailUrl: post.mediaUrls?.[0]
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

        if (apiCache.has(cacheKey)) {
            console.log(`%cCache HIT for key: ${cacheKey}`, 'color: green');
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
            console.log(`%cCache MISS for key: ${cacheKey}`, 'color: orange');
            fetchPromises.push(
                getPosts(sub, currentSortType, {
                    timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
                    after: afterParam,
                    limit: POSTS_PER_LOAD
                }).then(response => {
                    const dataToCache: CachedRedditResponse = { posts: response.posts, after: response.after };
                    apiCache.set(cacheKey, dataToCache);
                    console.log(`%cStored in cache: ${cacheKey}`, 'color: blue');
                    const postsWithMetadata = response.posts.map(p => ({
                        ...p,
                        subreddit: sub,
                        isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false
                    }));
                    return { posts: postsWithMetadata, after: response.after, sub: sub };
                })
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

   const fetchInitialPosts = useCallback(async () => {
     setShowFavoritesOnly(false); // Reset favorites filter when fetching new posts
     let subsToUse = parseSubreddits(subredditInput);
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
  const handleThumbnailClick = useCallback((post: RedditPost) => { setSelectedPost(post); setIsDialogOpen(true); }, []);
  const handleDialogClose = useCallback(() => { setIsDialogOpen(false); setTimeout(() => { setSelectedPost(null); }, 300); }, []);

  // --- Saved Lists Handlers ---
   const handleSaveList = useCallback(() => {
        const currentInput = subredditInput.trim(); if (!currentInput) { toast({ variant: "destructive", description: "Input field is empty." }); return; }
        const listName = window.prompt("Enter a name for this list:", ""); if (listName === null) return;
        const trimmedName = listName.trim(); if (!trimmedName) { toast({ variant: "destructive", description: "List name cannot be empty." }); return; }
        if (trimmedName === "Load a saved list...") { toast({ variant: "destructive", description: `Invalid list name.` }); return; }
        setSavedLists(prev => ({ ...prev, [trimmedName]: currentInput })); toast({ description: `List "${trimmedName}" saved.` }); setSelectedListName(trimmedName);
   }, [subredditInput, toast]);

   const handleLoadList = useCallback((listName: string) => {
        if (listName && savedLists[listName]) { setSubredditInput(savedLists[listName]); setSelectedListName(listName); setTimeout(() => { fetchInitialPosts(); }, 0); }
        else if (listName === "" || !savedLists[listName]) { setSelectedListName(""); }
   }, [savedLists, fetchInitialPosts]);

   const handleDeleteList = useCallback(() => {
        if (!selectedListName) { toast({ variant: "destructive", description: "No list selected to delete." }); return; }
        if (window.confirm(`Delete list "${selectedListName}"?`)) {
            setSavedLists(prev => { const newState = { ...prev }; delete newState[selectedListName]; return newState; });
            setSelectedListName(""); toast({ description: `List "${selectedListName}" deleted.` });
        }
   }, [selectedListName, toast]);

   // --- Scroll to Top Function ---
   const scrollToTop = () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};

   // --- Masonry Breakpoint Configuration ---
   const breakpointColumnsObj = { default: 6, 1280: 5, 1024: 4, 768: 3 };

   // --- Render ---
   const savedListNames = Object.keys(savedLists);

  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-screen flex flex-col">
      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="max-w-xl mx-auto space-y-3">
            {/* Input and Fetch Button */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
                 <Input
                    type="text" aria-label="Enter subreddit names separated by commas"
                    placeholder="Enter subreddits..." value={subredditInput}
                    onChange={(e) => setSubredditInput(e.target.value)}
                    className="flex-grow text-base"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchInitialPosts(); }}
                 />
                 <Button onClick={fetchInitialPosts} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform">
                     {isLoading && posts.length === 0 ? "Fetching..." : "Fetch"}
                 </Button>
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
                    {/* Save/Load/Delete List Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-2">
                        <Select value={selectedListName} onValueChange={handleLoadList} disabled={isLoading}>
                            <SelectTrigger className="flex-grow" aria-label="Load saved list"><SelectValue placeholder="Load saved list..." /></SelectTrigger>
                            <SelectContent><SelectGroup><SelectLabel>Saved Lists</SelectLabel>
                                {savedListNames.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No lists saved</div>}
                                {savedListNames.map(name => ( <SelectItem key={name} value={name}>{name}</SelectItem> ))}
                            </SelectGroup></SelectContent>
                        </Select>
                        <Button onClick={handleSaveList} variant="outline" size="icon" aria-label="Save current list" title="Save current list" className="active:scale-95 transition-transform" disabled={isLoading || !subredditInput.trim()}><Save className="h-4 w-4" /></Button>
                        <Button onClick={handleDeleteList} variant="destructive" size="icon" aria-label="Delete selected list" title="Delete selected list" disabled={!selectedListName || isLoading} className="active:scale-95 transition-transform"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    {/* Sort/Timeframe Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
                        <RadioGroup defaultValue="hot" className="flex gap-4" value={sortType} onValueChange={(value) => { if(!isLoading) setSortType(value as SortType)}} aria-label="Sort posts by" >
                            <Label htmlFor="sort-hot" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading}/> <span>Hot</span> </Label>
                            <Label htmlFor="sort-top" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="top" id="sort-top" disabled={isLoading}/> <span>Top</span> </Label>
                        </RadioGroup>
                        {sortType === 'top' && ( <Select value={timeFrame} onValueChange={(value) => {if(!isLoading) setTimeFrame(value as TimeFrame)}} disabled={isLoading} > <SelectTrigger className="w-[180px]" aria-label="Time frame"> <SelectValue placeholder="Time frame" /> </SelectTrigger> <SelectContent> <SelectItem value="day">Today</SelectItem> <SelectItem value="week">This Week</SelectItem> <SelectItem value="month">This Month</SelectItem> <SelectItem value="year">This Year</SelectItem> <SelectItem value="all">All Time</SelectItem> </SelectContent> </Select> )}
                    </div>
                    {/* Favorites Filter Toggle */}
                    <div className="flex justify-center pt-2">
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
         {/* Error Message */}
         {error && <p className="text-red-500 mt-2 text-center text-sm">{error}</p>}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow mt-2">
        {/* Initial Loading Skeletons */}
        {isLoading && posts.length === 0 && !error && (
            <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex gap-1.5" columnClassName="my-masonry-grid_column">
                 {Array.from({ length: 18 }).map((_, index) => ( <Skeleton key={`skeleton-${index}`} className="h-64 w-full mb-1.5" /> ))}
            </Masonry>
        )}
        {/* No Posts Message */}
        {fetchInitiated && postsToDisplay.length === 0 && !isLoading && !error && ( <p className="text-center text-muted-foreground mt-10">No posts found.</p> )}
        {/* Posts Grid */}
        {postsToDisplay.length > 0 && (
          <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex gap-1.5" columnClassName="my-masonry-grid_column">
            {postsToDisplay.map((post) => {
                const firstUrl=post?.mediaUrls?.[0];
                const isVideoPost=firstUrl&&firstUrl.endsWith('.mp4');
                const isGalleryPost=post?.mediaUrls?.length>1;
                const isUnplayable = post.isUnplayableVideoFormat ?? false;
                return (
                <div key={`${post.subreddit}-${post.postId}`} 
                     ref={!showFavoritesOnly && postsToDisplay[postsToDisplay.length-1]===post ? lastPostRef : null} 
                     className="mb-1.5">
                 <Card onClick={()=> !isUnplayable && handleThumbnailClick(post)}
                       className={cn(
                            "group relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200",
                            !isUnplayable && "hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer",
                            isUnplayable && "cursor-default"
                       )}>
                     {/* Indicators */}
                     <div className="absolute top-1 left-1 z-20">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white active:scale-90"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(post);
                          }}
                        >
                          <Heart className={cn("h-4 w-4", favorites[post.postId] ? "fill-current" : "")} />
                        </Button>
                     </div>
                     {(isVideoPost || isGalleryPost || isUnplayable) && (
                        <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100">
                            {isUnplayable ? <Video className="h-3 w-3 opacity-70"/> :
                             isVideoPost ? <Video className="h-3 w-3"/> :
                             <GalleryIcon className="h-3 w-3"/>}
                        </div>
                     )}
                     {/* Grid Item Media Carousel */}
                     <MediaCarousel
                        mediaUrls={post.mediaUrls} title={post.title} subreddit={post.subreddit}
                        postId={post.postId} isUnplayableVideoFormat={isUnplayable}
                        onToggleFavorite={() => toggleFavorite(post)} isFavorite={!!favorites[post.postId]}
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
                    // Pass props down as before
                    mediaUrls={selectedPost.mediaUrls} title={selectedPost.title}
                    subreddit={selectedPost.subreddit} postId={selectedPost.postId}
                    isFullScreen={true}
                    isUnplayableVideoFormat={selectedPost.isUnplayableVideoFormat ?? false}
                    onToggleFavorite={() => toggleFavorite(selectedPost)}
                    isFavorite={!!favorites[selectedPost.postId]}
                 />
              ) : ( <div className="text-white text-xl">Loading content...</div> )}

              {/* The Close Button is now rendered INSIDE MediaCarousel */}

              {/* --- Content Ends Above --- */}
           </div>
           {/* *** End Inner Wrapper *** */}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-16 md:mt-24 text-center text-sm text-muted-foreground flex-shrink-0 pb-6">
        <p> Built with ❤️ </p>
      </footer>
    </div>
   );
}