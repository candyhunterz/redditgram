// src/app/page.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RedditPost, getHotPosts } from "@/services/reddit"; // Assuming getHotPosts returns { posts: RedditPost[], after: string | null }
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  // DialogDescription, // DialogDescription wasn't used
  DialogTitle,
} from "@/components/ui/dialog";

// --- Helper Functions ---

const isValidSubreddit = (subreddit: string): boolean => {
  // Basic validation, allows alphanumeric and underscore
  return /^[a-zA-Z0-9_]+$/.test(subreddit) && subreddit.length > 0;
};

const parseSubreddits = (input: string): string[] => {
  return input.split(',').map(s => s.trim()).filter(s => s !== '');
};

const POSTS_PER_LOAD = 20; // Number of posts to load each time

// --- MediaCarousel Component (Updated with Button Fixes) ---
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
  const [overlayPosition, setOverlayPosition] = useState<'top' | 'bottom'>('top'); // Default position

  // Ensure mediaUrls is always an array
  const validMediaUrls = Array.isArray(mediaUrls) ? mediaUrls : [];

  const nextMedia = () => {
    // No stopPropagation needed here for basic functionality
    if (validMediaUrls.length > 0) {
       setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % validMediaUrls.length);
    }
  };

  const prevMedia = () => {
    // No stopPropagation needed here for basic functionality
     if (validMediaUrls.length > 0) {
        setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + validMediaUrls.length) % validMediaUrls.length);
     }
  };

  // Use validMediaUrls for calculations and rendering
  const currentMediaUrl = validMediaUrls[currentMediaIndex];
  const isVideo = currentMediaUrl?.endsWith('.mp4');

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  // Determine overlay position based on aspect ratio for IMAGES only
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
      // Reset index only if the specific post changes (mediaUrls array instance changes)
      // setCurrentMediaIndex(0); // This was likely resetting index too often, removed for now
    }
     setIsHovered(false);
  }, [isFullScreen, updateOverlayPosition]); // Removed mediaUrls from deps here

  // Reset index ONLY if the actual array of URLs changes (meaning a new post is selected)
  useEffect(() => {
     setCurrentMediaIndex(0);
     setIsHovered(false); // Also reset hover
  }, [mediaUrls]); // Use the original mediaUrls prop here to detect post change


  if (!validMediaUrls || validMediaUrls.length === 0) {
    return <div className="w-full h-full aspect-square bg-gray-200 flex items-center justify-center text-muted-foreground">No Media</div>;
  }

  // Check if buttons should be shown AFTER confirming validMediaUrls has length
  const showButtons = validMediaUrls.length > 1;

  return (
    <div
      className="relative group w-full h-full bg-black" // Added bg-black for consistent background
      onMouseEnter={isFullScreen ? handleMouseEnter : undefined}
      onMouseLeave={isFullScreen ? handleMouseLeave : undefined}
      ref={containerRef}
    >
      {/* Navigation Buttons - Increased z-index */}
      {showButtons && (
        <>
          <button
            onClick={prevMedia} // Pass function reference directly
            aria-label="Previous Media"
            // Increased z-index to 30, ensured visibility on hover
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={nextMedia} // Pass function reference directly
            aria-label="Next Media"
            // Increased z-index to 30, ensured visibility on hover
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full z-30 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <ChevronRight size={24}/>
          </button>
          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-1.5 z-20 pointer-events-none"> {/* Adjusted z-index */}
            {validMediaUrls.map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index === currentMediaIndex ? 'bg-white scale-110' : 'bg-gray-400 opacity-70'} transition-all`}
              />
            ))}
          </div>
        </>
      )}

      {/* Media Content */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {/* Added a key tied to the index AND url to force re-render on change */}
         {isVideo ? (
            <video
               key={`${currentMediaUrl}-${currentMediaIndex}`}
               src={currentMediaUrl}
               className={cn(
                 "object-contain block",
                 isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full' // Allow slightly larger in fullscreen
               )}
               controls
               muted
               playsInline
               autoPlay={isFullScreen}
               loop
            />
         ) : (
            <img
                key={`${currentMediaUrl}-${currentMediaIndex}`}
                src={currentMediaUrl}
                alt={title}
                className={cn(
                "object-contain block",
                isFullScreen ? 'max-h-[90vh] max-w-[95vw]' : 'w-full h-full' // Allow slightly larger in fullscreen
                )}
                loading="lazy"
            />
         )}


        {/* Title Overlay (Fullscreen only) */}
        {isFullScreen && (
          <div
            // Increased z-index to 20 to be above media but below buttons
            className={cn(
              "absolute left-0 w-full bg-gradient-to-t from-black/70 via-black/40 to-transparent text-white transition-opacity duration-300 p-4 z-20 pointer-events-none",
              overlayPosition === 'top' ? 'top-0 bg-gradient-to-b' : 'bottom-0 bg-gradient-to-t',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
             <DialogTitle className="text-base md:text-lg font-semibold line-clamp-2">
                {title} (From: <a
                    href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline pointer-events-auto"
                    onClick={(e) => e.stopPropagation()} // Keep stopPropagation specifically for the link inside overlay
                    >
                    r/{subreddit}
                </a>)
             </DialogTitle>
          </div>
        )}
      </div>
    </div>
  );
};


// --- Home Page Component ---
export default function Home() {
  const [subredditInput, setSubredditInput] = useState<string>('');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [after, setAfter] = useState<string | null>(null); // Unified pagination token (see comment above)
  const [hasMore, setHasMore] = useState(true);
  const [fetchInitiated, setFetchInitiated] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]); // Needs persistence (e.g., localStorage) to be useful
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { toast } = useToast();

  // --- Infinite Scroll ---
  const observer = useRef<IntersectionObserver>();
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => { // Allow null for cleanup
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(entries => {
        // Check intersectionRatio for better reliability in some browsers
        if (entries[0]?.isIntersecting && hasMore && fetchInitiated) { // Added optional chaining for entries[0]
          loadMorePosts();
        }
      }, { threshold: 0.5 }); // Trigger when 50% visible

      if (node) observer.current.observe(node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isLoading, hasMore, fetchInitiated] // Dependencies for useCallback - include loadMorePosts if it weren't stable
  );

  // --- Data Fetching ---
  const performFetch = async (subredditsToFetch: string[], currentAfter: string | null): Promise<{posts: RedditPost[], newAfter: string | null, anyHasMore: boolean}> => {
    if (subredditsToFetch.length === 0) {
        return { posts: [], newAfter: null, anyHasMore: false };
    }

    if (!subredditsToFetch.every(isValidSubreddit)) {
      throw new Error("Invalid subreddit name found. Please use only alphanumeric characters and underscores.");
    }

    try {
      const results = await Promise.all(
        subredditsToFetch.map(async sub => {
          // *** FIX APPLIED HERE for null vs undefined ***
          const afterParam = currentAfter === null ? undefined : currentAfter;
          // **********************************************
          const { posts: fetchedPosts, after: subAfter } = await getHotPosts(sub, afterParam, POSTS_PER_LOAD);
          // Add subreddit context to each post
          const postsWithSubreddit = fetchedPosts.map(post => ({ ...post, subreddit: sub }));
          return { sub, posts: postsWithSubreddit, after: subAfter };
        })
      );

      const flattenedPosts = results.reduce((acc, curr) => acc.concat(curr.posts), [] as RedditPost[]);
      const anyHasMore = results.some(result => result.after !== null);
       // **Pagination Limitation:** Using the 'after' from the *last* result for the next unified fetch.
       // This isn't perfect for parallel fetching but simplifies state.
      const newAfter = results.length > 0 ? results[results.length - 1].after : null;

      return { posts: flattenedPosts, newAfter, anyHasMore };

    } catch (e) {
       if (e instanceof Error) {
           // Error state is set by the calling function to avoid setting it multiple times
           throw e; // Rethrow to be caught by caller
       } else {
           throw new Error('An unknown error occurred during fetching.');
       }
    }
  };

  const fetchInitialPosts = useCallback(async () => { // Wrap in useCallback
    let subsToUse = parseSubreddits(subredditInput);
    if (subsToUse.length === 0 && favorites.length > 0) {
      subsToUse = favorites;
    } else if (subsToUse.length === 0) {
        setError("Please enter at least one subreddit name or add favorites.");
        return; // Don't start loading if no subs
    }

    setIsLoading(true);
    setError(null);
    setPosts([]); // Clear existing posts
    setAfter(null);
    setHasMore(true);
    setFetchInitiated(true); // Mark fetch as started

    try {
        const { posts: initialPosts, newAfter, anyHasMore } = await performFetch(subsToUse, null);
        setPosts(initialPosts);
        setAfter(newAfter);
        setHasMore(anyHasMore);
         if (initialPosts.length === 0 && !anyHasMore) {
            toast({ description: "No posts found for the selected subreddit(s)." });
        }
    } catch (e) {
        if (e instanceof Error) {
            setError(`Failed to fetch posts: ${e.message}`);
        } else {
            setError('An unknown error occurred during initial fetch.');
        }
        setHasMore(false); // Stop pagination on error
    } finally {
        setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subredditInput, favorites, toast]); // Dependencies for useCallback

  const loadMorePosts = useCallback(async () => { // Wrap in useCallback
    if (isLoading || !hasMore || !after) return; // Don't load if already loading, no more posts, or no 'after' token

    let subsToUse = parseSubreddits(subredditInput);
     if (subsToUse.length === 0 && favorites.length > 0) {
       subsToUse = favorites;
     } else if (subsToUse.length === 0) {
        setHasMore(false);
        return;
     }

    setIsLoading(true);
    setError(null); // Clear previous errors when loading more

    try {
        const { posts: newPosts, newAfter, anyHasMore } = await performFetch(subsToUse, after);
        setPosts(prevPosts => [...prevPosts, ...newPosts]);
        setAfter(newAfter);
        setHasMore(anyHasMore);
        if (newPosts.length === 0 && !anyHasMore) {
             // Optional: Toast if load more returned nothing but hasMore was true before
             // toast({ description: "No more posts found." });
        }
    } catch (e) {
         if (e instanceof Error) {
            setError(`Failed to load more posts: ${e.message}`);
        } else {
            setError('An unknown error occurred while loading more posts.');
        }
        setHasMore(false); // Stop pagination on error
    } finally {
        setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasMore, after, subredditInput, favorites]); // Dependencies for useCallback


  // --- Event Handlers ---
  const handleThumbnailClick = (post: RedditPost) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    // Delay clearing selected post slightly to avoid UI glitch during close animation
    setTimeout(() => {
        setSelectedPost(null);
    }, 300);
  };

  // --- Favorites (Example - Needs Persistence) ---
  const toggleFavorite = (subredditName: string) => {
    setFavorites(prevFavorites => {
      const updatedFavorites = prevFavorites.includes(subredditName)
        ? prevFavorites.filter(fav => fav !== subredditName)
        : [...prevFavorites, subredditName];
      // Persist favorites (example using localStorage)
      try {
        localStorage.setItem('subredditFavorites', JSON.stringify(updatedFavorites));
      } catch (e) {
          console.error("Failed to save favorites to localStorage", e);
          toast({ variant: "destructive", title: "Error saving favorites", description: "Could not save favorites to local storage." });
      }
      return updatedFavorites;
    });
  };

  const isFavorite = (subredditName: string) => favorites.includes(subredditName);

  // Effect to load favorites from localStorage on initial mount
  useEffect(() => {
    const storedFavorites = localStorage.getItem('subredditFavorites');
    if (storedFavorites) {
      try {
        const parsedFavorites = JSON.parse(storedFavorites);
        if (Array.isArray(parsedFavorites) && parsedFavorites.every(item => typeof item === 'string')) {
           setFavorites(parsedFavorites);
        } else {
            console.warn("Invalid favorites data found in localStorage.");
            localStorage.removeItem('subredditFavorites'); // Clear invalid data
        }
      } catch (e) {
          console.error("Failed to parse favorites from localStorage", e);
          localStorage.removeItem('subredditFavorites'); // Clear corrupted data
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount


  // --- Render ---
  return (
    <div className="container mx-auto p-4 min-h-screen flex flex-col"> {/* Ensure container takes height */}
      <header className="mb-6 flex-shrink-0"> {/* Prevent header from shrinking */}
        <h1 className="text-3xl font-bold text-center mb-4">Sub Gallery</h1>
        {/* Subreddit Input Area */}
        <div className="flex flex-col sm:flex-row items-center gap-2 mb-4 max-w-xl mx-auto">
          <Input
            type="text"
            aria-label="Enter subreddit names separated by commas"
            placeholder="Enter subreddits (e.g., pics, aww)"
            value={subredditInput}
            onChange={(e) => setSubredditInput(e.target.value)}
            className="flex-grow"
            onKeyDown={(e) => { if (e.key === 'Enter') fetchInitialPosts(); }} // Allow fetch on Enter key
          />
          <Button onClick={fetchInitialPosts} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0"> {/* Prevent button shrink */}
            {isLoading && !posts.length ? "Fetching..." : "Fetch Posts"}
          </Button>
        </div>
         {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
      </header>

      {/* Media Gallery Area */}
      <main className="flex-grow"> {/* Allow main content to grow */}
        {fetchInitiated && posts.length === 0 && !isLoading && !error && (
            <p className="text-center text-muted-foreground mt-10">No posts found. Try different subreddits.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
            {posts.map((post, index) => (
            // Use post.id if available and unique, otherwise combine subreddit and postId
            <div key={`${post.subreddit}-${post.postId}-${index}`} ref={posts.length === index + 1 ? lastPostRef : null}>
                <Card
                    onClick={() => handleThumbnailClick(post)}
                    className="overflow-hidden cursor-pointer aspect-square bg-gray-100 dark:bg-gray-800 hover:shadow-lg transition-shadow duration-200 flex items-center justify-center" // Added flex centering
                >
                    {/* Pass necessary props to MediaCarousel */}
                    <MediaCarousel
                        mediaUrls={post.mediaUrls}
                        title={post.title}
                        subreddit={post.subreddit} // Pass subreddit down
                        postId={post.postId}     // Pass postId down
                    />
                </Card>
            </div>
            ))}
        </div>

        {/* Loading/End Indicators */}
        {isLoading && posts.length > 0 && (
            <div className="text-center mt-4 p-4 text-muted-foreground">Loading more posts...</div>
        )}
        {!hasMore && fetchInitiated && posts.length > 0 && (
            <p className="text-center mt-4 p-4 text-muted-foreground">You've reached the end!</p>
        )}
      </main>


      {/* Expanded View Dialog */}
      {/* Use Radix Dialog primitive directly if needed for more control, or ensure ShadCN Dialog is used */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-none w-[95vw] h-[95vh] p-1 sm:p-2 bg-black/90 border-none flex items-center justify-center overflow-hidden">
          {/* Conditional rendering ensures MediaCarousel mounts only when needed */}
          {selectedPost && (
             <MediaCarousel
                mediaUrls={selectedPost.mediaUrls}
                title={selectedPost.title}
                subreddit={selectedPost.subreddit}
                postId={selectedPost.postId}
                isFullScreen={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-12 text-center text-sm text-muted-foreground flex-shrink-0 pb-4"> {/* Prevent footer shrink */}
        <p>
          Built with ❤️ {/* Consider removing "by Firebase Studio" if not applicable */}
        </p>
      </footer>
    </div>
  );
}