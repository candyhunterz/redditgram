// src/app/page.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Import updated service function and types
import { RedditPost, getPosts, SortType, TimeFrame } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
// Import UI components for sorting
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


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


// --- MediaCarousel Component (Keep the previous version with button fixes) ---
interface MediaCarouselProps {
  mediaUrls: string[];
  title: string;
  subreddit: string;
  postId: string;
  isFullScreen?: boolean;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({ mediaUrls, title, subreddit, postId, isFullScreen = false }) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'bottom'>('top');

  const validMediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];

  const nextMedia = () => {
    if (validMediaUrls.length > 0) {
       setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % validMediaUrls.length);
    }
  };

  const prevMedia = () => {
     if (validMediaUrls.length > 0) {
        setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + validMediaUrls.length) % validMediaUrls.length);
     }
  };

  const currentMediaUrl = validMediaUrls[currentMediaIndex];
  const isVideo = currentMediaUrl?.endsWith('.mp4');

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const updateOverlayPosition = useCallback(() => {
    if (containerRef.current && currentMediaUrl && !isVideo) {
      const img = new Image();
      img.src = currentMediaUrl;
      img.onload = () => {
        if (img.height > 0) {
            const aspectRatio = img.width / img.height;
            setOverlayPosition(aspectRatio < 1 ? 'bottom' : 'top');
        } else {
             setOverlayPosition('top');
        }
      };
      img.onerror = () => {
          setOverlayPosition('top');
      }
    } else if (isVideo) {
        setOverlayPosition('top');
    }
  }, [currentMediaUrl, isVideo]);

  useEffect(() => {
    if (isFullScreen) {
      updateOverlayPosition();
    }
     setIsHovered(false);
  }, [isFullScreen, updateOverlayPosition]);

  useEffect(() => {
     setCurrentMediaIndex(0);
     setIsHovered(false);
  }, [mediaUrls]);


  if (!validMediaUrls || validMediaUrls.length === 0) {
    return <div className="w-full h-full aspect-square bg-gray-200 flex items-center justify-center text-muted-foreground">No Media</div>;
  }

  const showButtons = validMediaUrls.length > 1;

  return (
    <div
      className="relative group w-full h-full bg-black"
      onMouseEnter={isFullScreen ? handleMouseEnter : undefined}
      onMouseLeave={isFullScreen ? handleMouseLeave : undefined}
      ref={containerRef}
    >
      {showButtons && (
        <>
          <button
            onClick={prevMedia}
            aria-label="Previous Media"
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextMedia}
            aria-label="Next Media"
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ChevronRight size={24}/>
          </button>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none">
            {validMediaUrls.map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index === currentMediaIndex ? 'bg-white scale-110' : 'bg-gray-400 opacity-70'} transition-all`}
              />
            ))}
          </div>
        </>
      )}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
         {isVideo ? (
            <video
               key={`${currentMediaUrl}-${currentMediaIndex}`}
               src={currentMediaUrl}
               className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full')}
               controls muted playsInline autoPlay={isFullScreen} loop
            />
         ) : (
            <img
                key={`${currentMediaUrl}-${currentMediaIndex}`}
                src={currentMediaUrl}
                alt={title}
                className={cn("object-contain block", isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full')}
                loading="lazy"
            />
         )}
        {isFullScreen && (
          <div
            className={cn(
              "absolute left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white transition-opacity duration-300 p-4 z-20 pointer-events-none",
              overlayPosition === 'top' ? 'top-0 bg-gradient-to-b' : 'bottom-0 bg-gradient-to-t',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
             <DialogTitle className="text-base md:text-lg font-semibold line-clamp-2">
                {title} (From: <a
                    href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`}
                    target="_blank" rel="noopener noreferrer" className="underline pointer-events-auto"
                    onClick={(e) => e.stopPropagation()} >
                    r/{subreddit}
                </a>)
             </DialogTitle>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Interleaving Helper ---
const interleavePosts = (groupedPosts: RedditPost[][]): RedditPost[] => {
    if (!groupedPosts || groupedPosts.length === 0) {
        return [];
    }

    const interleaved: RedditPost[] = [];
    const groupCount = groupedPosts.length;
    // Find the length of the longest group to determine how many rounds are needed
    const maxLength = Math.max(...groupedPosts.map(group => group.length));

    for (let j = 0; j < maxLength; j++) { // Iterate column-wise (index within each group)
        for (let i = 0; i < groupCount; i++) { // Iterate row-wise (each group)
            if (j < groupedPosts[i].length) { // Check if the current group has an element at this index
                interleaved.push(groupedPosts[i][j]);
            }
        }
    }

    return interleaved;
};

// --- Home Page Component ---
export default function Home() {
  const [subredditInput, setSubredditInput] = useState<string>('');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [after, setAfter] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [fetchInitiated, setFetchInitiated] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [sortType, setSortType] = useState<SortType>('hot');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');

  const { toast } = useToast();

  // --- Infinite Scroll ---
  const observer = useRef<IntersectionObserver>();
  // Forward ref for loadMorePosts dependency in useCallback
  const loadMorePostsRef = useRef<() => Promise<void>>();

  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting && hasMore && fetchInitiated) {
          // Call the function via the ref
          loadMorePostsRef.current?.();
        }
      }, { threshold: 0.5 });
      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore, fetchInitiated] // loadMorePostsRef is stable
  );

   // --- Data Fetching (Corrected for TS errors and Interleaving) ---
   const performFetch = async (
      subredditsToFetch: string[],
      currentSortType: SortType,
      currentTimeFrame: TimeFrame | undefined,
      currentAfter: string | null
   ): Promise<{
        groupedPosts: RedditPost[][], // Return grouped posts
        newAfter: string | null,
        anyHasMore: boolean
    }> => {

    if (subredditsToFetch.length === 0) {
        return { groupedPosts: [], newAfter: null, anyHasMore: false };
    }
    if (!subredditsToFetch.every(isValidSubreddit)) {
      throw new Error("Invalid subreddit name found.");
    }

    // Define the expected shape of a successful result's 'value'
    type SuccessfulFetchValue = {
        posts: RedditPost[];
        after: string | null;
        sub: string;
    };

    let overallError: Error | null = null; // Keep track of the first error encountered

    try {
      // Use Promise.allSettled to handle individual fetch failures
      // Explicitly type the expected result structure
      const results: PromiseSettledResult<SuccessfulFetchValue>[] = await Promise.allSettled(
        subredditsToFetch.map(async sub => {
          const afterParam = currentAfter === null ? undefined : currentAfter;
          // Call the actual service function
          const response = await getPosts(
              sub,
              currentSortType,
              {
                  timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
                  after: afterParam,
                  limit: POSTS_PER_LOAD
              }
          );
           // Ensure subreddit context is added if getPosts doesn't guarantee it
           const postsWithSubreddit = response.posts.map(p => ({ ...p, subreddit: sub }));
           // Return the successful result shape
           return { posts: postsWithSubreddit, after: response.after, sub: sub };
        })
      );

      const successfulResults: SuccessfulFetchValue[] = []; // Use the defined type
      const errors: { sub: string, reason: unknown }[] = []; // reason is unknown/any

      results.forEach((result, index) => {
          const sub = subredditsToFetch[index];
          if (result.status === 'fulfilled') {
              // Access result.value explicitly
              successfulResults.push(result.value);
          } else {
              // result.status === 'rejected'
              console.error(`Failed to fetch from r/${sub}:`, result.reason);
              errors.push({ sub: sub, reason: result.reason });
              if (!overallError) {
                  // Ensure overallError is assigned an Error object
                  if (result.reason instanceof Error) {
                     overallError = result.reason;
                  } else {
                     // Convert non-Error reasons (strings, objects, etc.) to an Error
                     overallError = new Error(`Fetch failed for r/${sub}: ${String(result.reason)}`);
                  }
              }
          }
      });

       // Handle errors - throw only if ALL fetches failed
       if (overallError && successfulResults.length === 0) {
            // overallError is guaranteed to be an Error object here
            throw new Error(`All subreddit fetches failed. First error: ${overallError}`); // <-- Problem Line
       } else if (overallError) {
            // Show toast for partial failures but proceed with successful results
            toast({ variant: "destructive", title: "Fetch Warning", description: `Could not load posts from some subreddits. Check console.`});
       }

      // Group posts by subreddit for interleaving
      const groupedPosts = successfulResults.map(res => res.posts);

      // Determine aggregate 'hasMore' and 'newAfter'
      const anyHasMore = successfulResults.some(result => result.after !== null);
      // Use the 'after' token from the *last successful* fetch for simplicity in this strategy
      const newAfter = successfulResults.length > 0 ? successfulResults[successfulResults.length - 1].after : null;

      return { groupedPosts, newAfter, anyHasMore };

    } catch (e) { // Catch errors from setup or the aggregated throw above
       if (e instanceof Error) { throw e; }
       else { throw new Error('An unexpected error occurred during the fetch process.'); }
    }
  };

   const fetchInitialPosts = useCallback(async () => {
     let subsToUse = parseSubreddits(subredditInput);
     if (subsToUse.length === 0 && favorites.length > 0) {
       subsToUse = favorites;
       // Optionally update input field:
       // setSubredditInput(favorites.join(', '));
     } else if (subsToUse.length === 0) {
         setError("Please enter at least one subreddit name or add favorites.");
         return;
     }

     setIsLoading(true);
     setError(null);
     setPosts([]); // Clear posts immediately on new fetch
     setAfter(null);
     setHasMore(true);
     setFetchInitiated(true);

     try {
         const { groupedPosts, newAfter, anyHasMore } = await performFetch(
             subsToUse, sortType, timeFrame, null
         );
         const interleavedInitialPosts = interleavePosts(groupedPosts);
         setPosts(interleavedInitialPosts);
         setAfter(newAfter);
         setHasMore(anyHasMore);

          if (interleavedInitialPosts.length === 0 && anyHasMore === false && !error) { // Check error state from potential toast
             toast({ description: "No posts found for the selected subreddit(s) and options." });
         }
     } catch (e) {
         if (e instanceof Error) { setError(`Failed to fetch posts: ${e.message}`); }
         else { setError('An unknown error occurred during initial fetch.'); }
         setHasMore(false); // Stop pagination on error
     } finally {
         setIsLoading(false);
     }
   }, [subredditInput, favorites, sortType, timeFrame, toast]); // Added toast to dependencies

   const loadMorePosts = useCallback(async () => {
     // Prevent multiple simultaneous loads
     if (isLoading || !hasMore || !after || !fetchInitiated) return;

     let subsToUse = parseSubreddits(subredditInput);
      if (subsToUse.length === 0 && favorites.length > 0) {
        subsToUse = favorites;
      } else if (subsToUse.length === 0) {
         // Should not be reachable if fetchInitiated is true, but safety check
         setHasMore(false);
         return;
      }

     setIsLoading(true);
     setError(null); // Clear previous errors when loading more

     try {
          const { groupedPosts, newAfter, anyHasMore } = await performFetch(
             subsToUse, sortType, timeFrame, after
         );
         const interleavedNewPosts = interleavePosts(groupedPosts);

         // Append the interleaved new posts
         setPosts(prevPosts => [...prevPosts, ...interleavedNewPosts]);
         setAfter(newAfter);
         setHasMore(anyHasMore);

     } catch (e) {
          if (e instanceof Error) { setError(`Failed to load more posts: ${e.message}`); }
          else { setError('An unknown error occurred while loading more posts.'); }
         setHasMore(false); // Stop pagination on error
     } finally {
         setIsLoading(false);
     }
   }, [isLoading, hasMore, after, fetchInitiated, subredditInput, favorites, sortType, timeFrame, toast]); // Added toast

   // Assign loadMorePosts to the ref after it's defined
   useEffect(() => {
       loadMorePostsRef.current = loadMorePosts;
   }, [loadMorePosts]);


  // --- Event Handlers ---
  const handleThumbnailClick = (post: RedditPost) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setTimeout(() => { setSelectedPost(null); }, 300); // Delay for animation
  };

  // --- Favorites ---
   const toggleFavorite = (subredditName: string) => {
     // Basic toggle logic - persistence would require more state/effects
     setFavorites(prev => prev.includes(subredditName) ? prev.filter(f => f !== subredditName) : [...prev, subredditName]);
     // NOTE: Removed localStorage logic for brevity, add back if needed
     // Consider using a more robust state management or custom hook for this
   };
   // Add useEffect for loading/saving favorites if required (removed for brevity)


  // --- Render ---
  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col">
      <header className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-center mb-4">Sub Gallery</h1>

        {/* Input and Sorting Controls */}
        <div className="max-w-xl mx-auto space-y-4 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-2">
                <Input
                    type="text"
                    aria-label="Enter subreddit names separated by commas"
                    placeholder="Enter subreddits (e.g., pics, aww)"
                    value={subredditInput}
                    onChange={(e) => setSubredditInput(e.target.value)}
                    className="flex-grow"
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchInitialPosts(); }} // Prevent fetch while loading
                />
                <Button onClick={fetchInitialPosts} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0">
                    {isLoading && posts.length === 0 ? "Fetching..." : "Fetch Posts"} {/* Show Fetching only on initial load */}
                </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <RadioGroup
                    defaultValue="hot" className="flex gap-4" value={sortType}
                    onValueChange={(value) => { if(!isLoading) setSortType(value as SortType)}} // Prevent change while loading
                    aria-label="Sort posts by" >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading}/>
                        <Label htmlFor="sort-hot" className={cn(isLoading && "text-muted-foreground")}>Hot</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="top" id="sort-top" disabled={isLoading}/>
                        <Label htmlFor="sort-top" className={cn(isLoading && "text-muted-foreground")}>Top</Label>
                    </div>
                </RadioGroup>
                {sortType === 'top' && (
                    <Select value={timeFrame} onValueChange={(value) => {if(!isLoading) setTimeFrame(value as TimeFrame)}} disabled={isLoading} >
                        <SelectTrigger className="w-[180px]" aria-label="Time frame for top posts">
                            <SelectValue placeholder="Select time frame" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="day">Today</SelectItem>
                            <SelectItem value="week">This Week</SelectItem>
                            <SelectItem value="month">This Month</SelectItem>
                            <SelectItem value="year">This Year</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            </div>
        </div>
         {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
      </header>

      {/* Media Gallery Area */}
      <main className="flex-grow">
        {fetchInitiated && posts.length === 0 && !isLoading && !error && (
            <p className="text-center text-muted-foreground mt-10">No posts found. Try different subreddits or sorting options.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {posts.map((post, index) => (
            <div key={`${post.subreddit}-${post.postId}`} ref={posts.length === index + 1 ? lastPostRef : null}>
                <Card
                    onClick={() => handleThumbnailClick(post)}
                    className="overflow-hidden cursor-pointer aspect-square bg-gray-100 dark:bg-gray-800 hover:shadow-lg transition-shadow duration-200 flex items-center justify-center" >
                    <MediaCarousel
                        mediaUrls={post.mediaUrls} title={post.title}
                        subreddit={post.subreddit} postId={post.postId} />
                </Card>
            </div>
            ))}
        </div>

        {/* Loading/End Indicators */}
        {isLoading && posts.length > 0 && ( <div className="text-center mt-4 p-4 text-muted-foreground">Loading more posts...</div> )}
        {!hasMore && fetchInitiated && posts.length > 0 && ( <p className="text-center mt-4 p-4 text-muted-foreground">You've reached the end!</p> )}
      </main>

      {/* Expanded View Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-none w-[95vw] h-[95vh] p-1 sm:p-2 bg-black/90 border-none flex items-center justify-center overflow-hidden">
          {selectedPost && (
             <MediaCarousel
                mediaUrls={selectedPost.mediaUrls} title={selectedPost.title}
                subreddit={selectedPost.subreddit} postId={selectedPost.postId}
                isFullScreen={true} />
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-muted-foreground flex-shrink-0 pb-4">
        <p> Built with ❤️ </p>
      </footer>
    </div>
  );
}