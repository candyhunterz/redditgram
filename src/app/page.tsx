// src/app/page.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Import updated service function and types
import { RedditPost, getPosts, SortType, TimeFrame } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
// Added/updated icons: Filter, Loader2
import { ChevronLeft, ChevronRight, Trash2, Save, X, Video, Copy as GalleryIcon, Filter, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton"; // Added Skeleton
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogHeader,
  DialogTrigger
} from "@/components/ui/dialog";
// Import UI components for sorting & save/load
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
// Import Collapsible components
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


// --- Helper Functions ---

const isValidSubreddit = (subreddit: string): boolean => {
  // Basic validation, allows alphanumeric and underscore, non-empty
  return /^[a-zA-Z0-9_]+$/.test(subreddit) && subreddit.length > 0;
};

const parseSubreddits = (input: string): string[] => {
  // Trims whitespace and filters out empty strings after splitting by comma
  return input.split(',').map(s => s.trim()).filter(s => s !== '');
};

const POSTS_PER_LOAD = 20; // Number of posts to fetch *per subreddit* per request
const LOCAL_STORAGE_SAVED_LISTS_KEY = "savedSubredditLists"; // Key for localStorage

// --- MediaCarousel Component (Memoized, with Tap Overlay Fix, Keyboard Nav, Enhanced Dots, Swipe Gestures) ---
interface MediaCarouselProps {
  mediaUrls: string[];
  title: string;
  subreddit: string;
  postId: string;
  isFullScreen?: boolean;
}

const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({ mediaUrls, title, subreddit, postId, isFullScreen = false }) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'bottom'>('top');

  // Refs for swipe detection
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeThreshold = 50; // Minimum pixels to trigger swipe

  const validMediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];
  const showButtons = validMediaUrls.length > 1; // Determine if nav is needed

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
  const isVideo = currentMediaUrl?.endsWith('.mp4');

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const updateOverlayPosition = useCallback(() => {
    if (containerRef.current && currentMediaUrl && !isVideo) {
      const img = new Image();
      img.src = currentMediaUrl;
      img.onload = () => {
        if (img.height > 0) {
            const aspectRatio = img.width / img.height;
            setOverlayPosition(aspectRatio < 1 ? 'bottom' : 'top');
        } else { setOverlayPosition('top'); }
      };
      img.onerror = () => { setOverlayPosition('top'); }
    } else if (isVideo) { setOverlayPosition('top'); }
  }, [currentMediaUrl, isVideo]);

  useEffect(() => {
    if (isFullScreen) { updateOverlayPosition(); }
    setIsHovered(false);
  }, [isFullScreen, updateOverlayPosition]);

  // Reset index only when the array instance changes (new post selected)
  useEffect(() => {
     setCurrentMediaIndex(0);
     setIsHovered(false);
  }, [mediaUrls]);

  // --- Keyboard Navigation for Dialog ---
  useEffect(() => {
    if (!isFullScreen || !showButtons) return; // Only apply when fullscreen dialog is open and has multiple items

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowRight') {
            nextMedia();
        } else if (event.key === 'ArrowLeft') {
            prevMedia();
        }
        // Note: 'Escape' key handling is usually done by the Dialog component itself
    };

    window.addEventListener('keydown', handleKeyDown);
    // Cleanup function to remove event listener
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen, showButtons, nextMedia, prevMedia]); // Add dependencies

  // --- Swipe Event Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (!isFullScreen || !showButtons) return; // Only for fullscreen carousel
      touchEndX.current = null; // Reset end position
      touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!touchStartX.current || !isFullScreen || !showButtons) return;
      touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartX.current || touchEndX.current === null || !isFullScreen || !showButtons) return; // Check touchEndX explicitly

      const diffX = touchStartX.current - touchEndX.current;

      if (Math.abs(diffX) > swipeThreshold) { // Check if swipe distance is significant
          if (diffX > 0) {
              // Swiped Left (Next)
              nextMedia();
          } else {
              // Swiped Right (Previous)
              prevMedia();
          }
      }

      // Reset refs
      touchStartX.current = null;
      touchEndX.current = null;
  };


  if (!validMediaUrls || validMediaUrls.length === 0) {
    return <div className="w-full h-full aspect-square bg-gray-200 flex items-center justify-center text-muted-foreground">No Media</div>;
  }

  return (
    <div
      className="relative group w-full h-full bg-black select-none" // Added select-none
      onMouseEnter={isFullScreen ? handleMouseEnter : undefined}
      onMouseLeave={isFullScreen ? handleMouseLeave : undefined}
      // Add touch handlers ONLY when fullscreen
      onTouchStart={isFullScreen ? handleTouchStart : undefined}
      onTouchMove={isFullScreen ? handleTouchMove : undefined}
      onTouchEnd={isFullScreen ? handleTouchEnd : undefined}
      ref={containerRef}
    >
      {/* Navigation Buttons */}
      {showButtons && (
        <>
          <button onClick={prevMedia} aria-label="Previous Media" className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"> <ChevronLeft size={24} /> </button>
          <button onClick={nextMedia} aria-label="Next Media" className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"> <ChevronRight size={24}/> </button>
          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
            {validMediaUrls.map((_, index) => (
              <span
                key={index}
                className={cn( 'h-2 w-2 rounded-full transition-all duration-300', index === currentMediaIndex ? 'bg-white scale-110' : 'bg-gray-400 opacity-50 scale-90' )}
              />
             ))}
          </div>
        </>
      )}
      {/* Media Content Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
         {isVideo ? (
            <video key={`${currentMediaUrl}-${currentMediaIndex}`} src={currentMediaUrl} className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full')} controls={isFullScreen} muted playsInline autoPlay={isFullScreen} loop />
         ) : (
            <img key={`${currentMediaUrl}-${currentMediaIndex}`} src={currentMediaUrl} alt={title} className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full')} loading="lazy" />
         )}
         {/* Grid Tap Overlay */}
         {!isFullScreen && ( <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" /> )}
         {/* Fullscreen Title Overlay */}
         {isFullScreen && (
           <div className={cn( "absolute left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white transition-opacity duration-300 p-4 z-20 pointer-events-none", overlayPosition === 'top' ? 'top-0 bg-gradient-to-b' : 'bottom-0 bg-gradient-to-t', isHovered ? 'opacity-100' : 'opacity-0' )} >
             <DialogTitle className="text-base md:text-lg font-semibold line-clamp-2">
                {title} (From: <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" className="underline pointer-events-auto" onClick={(e) => e.stopPropagation()} > r/{subreddit} </a>)
             </DialogTitle>
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

// --- Define Saved Lists Type ---
type SavedLists = { [name: string]: string };

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
  const [favorites, setFavorites] = useState<string[]>([]); // Kept separate
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortType, setSortType] = useState<SortType>('hot');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [savedLists, setSavedLists] = useState<SavedLists>({});
  const [selectedListName, setSelectedListName] = useState<string>("");
  const [isControlsOpen, setIsControlsOpen] = useState(false); // State for collapsible

  const { toast } = useToast();

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
         try { localStorage.setItem(LOCAL_STORAGE_SAVED_LISTS_KEY, JSON.stringify(savedLists)); }
         catch (err) { console.error("Failed to save lists:", err); toast({ variant: "destructive", title: "Storage Error" }); }
    } else { localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY); }
  }, [savedLists, toast]);

  // --- Infinite Scroll ---
  const observer = useRef<IntersectionObserver>();
  const loadMorePostsRef = useRef<() => Promise<void>>();
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && hasMore && fetchInitiated) { loadMorePostsRef.current?.(); }
      }, { threshold: 0.5 });
      if (node) observer.current.observe(node);
    }, [isLoading, hasMore, fetchInitiated] );

   // --- Data Fetching ---
   const performFetch = useCallback(async (
      subredditsToFetch: string[], currentSortType: SortType,
      currentTimeFrame: TimeFrame | undefined, currentAfterTokens: { [subreddit: string]: string | null }
   ): Promise<{ groupedPosts: RedditPost[][]; updatedAfterTokens: { [subreddit: string]: string | null }; anyHasMore: boolean; }> => {
    if (subredditsToFetch.length === 0) return { groupedPosts: [], updatedAfterTokens: {}, anyHasMore: false };
    if (!subredditsToFetch.every(isValidSubreddit)) throw new Error("Invalid subreddit name found.");
    type SuccessfulFetchValue = { posts: RedditPost[]; after: string | null; sub: string; };
    let overallError: Error | null = null;
    try {
      const results: PromiseSettledResult<SuccessfulFetchValue>[] = await Promise.allSettled(
        subredditsToFetch.map(async sub => {
          const afterParam = currentAfterTokens[sub] ?? undefined;
          const response = await getPosts( sub, currentSortType, { timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined, after: afterParam, limit: POSTS_PER_LOAD });
           const postsWithSubreddit = response.posts.map(p => ({ ...p, subreddit: sub }));
           return { posts: postsWithSubreddit, after: response.after, sub: sub };
        })
      );
      const successfulResults: SuccessfulFetchValue[] = []; const errors: { sub: string, reason: unknown }[] = [];
      const updatedAfterTokens: { [subreddit: string]: string | null } = {};
      results.forEach((result, index) => {
          const sub = subredditsToFetch[index];
          if (result.status === 'fulfilled') { successfulResults.push(result.value); updatedAfterTokens[sub] = result.value.after; }
          else {
              console.error(`Failed to fetch from r/${sub}:`, result.reason); errors.push({ sub: sub, reason: result.reason });
              updatedAfterTokens[sub] = currentAfterTokens[sub] ?? null;
              if (!overallError) { overallError = result.reason instanceof Error ? result.reason : new Error(`Fetch failed for r/${sub}: ${String(result.reason)}`); }
          }
      });
       if (overallError && successfulResults.length === 0) throw new Error(`All subreddit fetches failed. First error`);
       else if (overallError) toast({ variant: "destructive", title: "Fetch Warning", description: `Could not load posts from some subreddits. Check console.`});
      const groupedPosts = successfulResults.map(res => res.posts);
      const anyHasMore = Object.values(updatedAfterTokens).some(token => token !== null);
      const finalUpdatedTokens = {...currentAfterTokens, ...updatedAfterTokens};
      return { groupedPosts, updatedAfterTokens: finalUpdatedTokens, anyHasMore };
    } catch (e) { if (e instanceof Error) { throw e; } else { throw new Error('An unexpected error occurred during the fetch process.'); } }
   }, [toast]);

   const fetchInitialPosts = useCallback(async () => {
     let subsToUse = parseSubreddits(subredditInput);
     if (subsToUse.length === 0 && favorites.length > 0) { subsToUse = favorites; }
     else if (subsToUse.length === 0) { setError("Please enter at least one subreddit name or add favorites."); return; }
     setIsLoading(true); setError(null); setPosts([]); setAfterTokens({}); setHasMore(true); setFetchInitiated(true);
     try {
         const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch( subsToUse, sortType, timeFrame, {} );
         const interleavedInitialPosts = interleavePosts(groupedPosts);
         setPosts(interleavedInitialPosts); setAfterTokens(updatedAfterTokens); setHasMore(anyHasMore);
          if (interleavedInitialPosts.length === 0 && anyHasMore === false && !error) { toast({ description: "No posts found." }); }
     } catch (e) { if (e instanceof Error) { setError(`Failed to fetch posts: ${e.message}`); } else { setError('Unknown initial fetch error.'); } setHasMore(false);
     } finally { setIsLoading(false); }
   }, [subredditInput, favorites, sortType, timeFrame, toast, performFetch]);

   const loadMorePosts = useCallback(async () => {
     if (isLoading || !hasMore || !fetchInitiated) return;
     let subsToUse = parseSubreddits(subredditInput);
     if (subsToUse.length === 0 && favorites.length > 0) { subsToUse = favorites; }
     else if (subsToUse.length === 0) { setHasMore(false); return; }
     const subsWithPotentialMore = subsToUse.filter(sub => afterTokens[sub] !== null);
       if (subsWithPotentialMore.length === 0) { setHasMore(false); return; }
     setIsLoading(true); setError(null);
     try {
          const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch( subsWithPotentialMore, sortType, timeFrame, afterTokens );
         const interleavedNewPosts = interleavePosts(groupedPosts);
         setPosts(prevPosts => [...prevPosts, ...interleavedNewPosts]);
         setAfterTokens(updatedAfterTokens); setHasMore(anyHasMore);
     } catch (e) { if (e instanceof Error) { setError(`Failed to load more posts: ${e.message}`); } else { setError('Unknown error loading more posts.'); } setHasMore(false);
     } finally { setIsLoading(false); }
   }, [isLoading, hasMore, fetchInitiated, afterTokens, subredditInput, favorites, sortType, timeFrame, toast, performFetch]);

   useEffect(() => { loadMorePostsRef.current = loadMorePosts; }, [loadMorePosts]);

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

   // --- Render ---
   const savedListNames = Object.keys(savedLists);

  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-screen flex flex-col">
      <header className="mb-6 flex-shrink-0">

        <div className="max-w-xl mx-auto space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
                 <Input type="text" aria-label="Enter subreddit names separated by commas" placeholder="Enter subreddits..." value={subredditInput} onChange={(e) => setSubredditInput(e.target.value)} className="flex-grow text-base" onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchInitialPosts(); }} />
                 <Button onClick={fetchInitialPosts} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform">
                     {isLoading && posts.length === 0 ? "Fetching..." : "Fetch"}
                 </Button>
             </div>
            <Collapsible open={isControlsOpen} onOpenChange={setIsControlsOpen}>
                 <div className="flex justify-center mb-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-transform">
                            <Filter className="h-4 w-4 mr-1" /> {isControlsOpen ? "Hide Options" : "Show Options"}
                        </Button>
                    </CollapsibleTrigger>
                 </div>
                <CollapsibleContent className="space-y-3 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
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
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
                        <RadioGroup defaultValue="hot" className="flex gap-4" value={sortType} onValueChange={(value) => { if(!isLoading) setSortType(value as SortType)}} aria-label="Sort posts by" >
                            <Label htmlFor="sort-hot" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading}/> <span>Hot</span> </Label>
                            <Label htmlFor="sort-top" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="top" id="sort-top" disabled={isLoading}/> <span>Top</span> </Label>
                        </RadioGroup>
                        {sortType === 'top' && ( <Select value={timeFrame} onValueChange={(value) => {if(!isLoading) setTimeFrame(value as TimeFrame)}} disabled={isLoading} > <SelectTrigger className="w-[180px]" aria-label="Time frame"> <SelectValue placeholder="Time frame" /> </SelectTrigger> <SelectContent> <SelectItem value="day">Today</SelectItem> <SelectItem value="week">This Week</SelectItem> <SelectItem value="month">This Month</SelectItem> <SelectItem value="year">This Year</SelectItem> <SelectItem value="all">All Time</SelectItem> </SelectContent> </Select> )}
                    </div>
                </CollapsibleContent>
            </Collapsible>
         </div>
         {error && <p className="text-red-500 mt-2 text-center text-sm">{error}</p>}
      </header>

      

      <main className="flex-grow mt-2">
        {isLoading && posts.length === 0 && !error && ( <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5"> {Array.from({ length: 18 }).map((_, index) => ( <Skeleton key={`skeleton-${index}`} className="aspect-square" /> ))} </div> )}
        {fetchInitiated && posts.length === 0 && !isLoading && !error && ( <p className="text-center text-muted-foreground mt-10">No posts found.</p> )}
        {posts.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5">
            {posts.map((post) => {
                const firstUrl=post?.mediaUrls?.[0]; const isVideoPost=firstUrl&&firstUrl.endsWith('.mp4'); const isGalleryPost=post?.mediaUrls?.length>1;
                return (
                <div key={`${post.subreddit}-${post.postId}`} ref={posts[posts.length-1]===post?lastPostRef:null}>
                 <Card onClick={()=>handleThumbnailClick(post)} className="group relative overflow-hidden cursor-pointer aspect-square bg-gray-100 dark:bg-gray-800 hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center">
                     {(isVideoPost || isGalleryPost) && ( <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100"> {isVideoPost && <Video className="h-3 w-3" />} {isGalleryPost && !isVideoPost && <GalleryIcon className="h-3 w-3"/>} </div> )}
                     <MediaCarousel mediaUrls={post.mediaUrls} title={post.title} subreddit={post.subreddit} postId={post.postId} />
                 </Card>
                </div>);
            })}
           </div>
        )}
        {isLoading && posts.length > 0 && ( <div className="flex justify-center items-center gap-2 text-center mt-6 p-4 text-muted-foreground"> <Loader2 className="h-4 w-4 animate-spin" /> Loading more... </div> )}
        {!hasMore && fetchInitiated && posts.length > 0 && ( <p className="text-center mt-6 p-4 text-muted-foreground">You've reached the end!</p> )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent
          // Removed relative here, using wrapper below
          className="max-w-none w-[95vw] h-[95vh] p-0 sm:p-0 bg-black/80 border-none overflow-hidden backdrop-blur-sm"
        >
          {/* Accessibility titles first */}
          <DialogTitle className="sr-only">
            Expanded view: {selectedPost?.title || 'Reddit Post'}
          </DialogTitle>
          <DialogDescription className="sr-only">
             Expanded view of Reddit post: {selectedPost?.title || 'Content'} from subreddit r/{selectedPost?.subreddit || ''}. Use arrow keys or buttons to navigate media if available. Press Escape or click the close button to exit.
          </DialogDescription>

          {/* === Add a Positioned Wrapper for Content + Close Button === */}
          <div className="relative w-full h-full flex items-center justify-center"> {/* This wrapper is now relative and centers content */}

            {/* Conditional Content Area */}
            {selectedPost ? (
               <MediaCarousel
                  mediaUrls={selectedPost.mediaUrls} title={selectedPost.title}
                  subreddit={selectedPost.subreddit} postId={selectedPost.postId}
                  isFullScreen={true}
               />
            ) : (
               <div className="text-white text-xl">Loading content...</div>
            )}

            {/* Custom Close Button (positioned relative to the new wrapper) */}
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close dialog"
                // Still absolute, but now relative to the div above
                className="absolute top-2 right-2 z-50 rounded-full h-8 w-8 bg-black/30 text-white hover:bg-black/50 hover:text-white active:scale-90"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>

          </div>
          {/* === End Positioned Wrapper === */}

        </DialogContent>
      </Dialog>
      <footer className="mt-16 md:mt-24 text-center text-sm text-muted-foreground flex-shrink-0 pb-6">
        <p> Built with ❤️ </p>
      </footer>
    </div>
  );
}