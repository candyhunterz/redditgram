"use client";

import React, { useState, useRef, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RedditPost, getHotPosts } from "@/services/reddit";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"

const isValidSubreddit = (subreddit: string): boolean => {
  // Basic validation, can be expanded
  return /^[a-zA-Z0-9_]+$/.test(subreddit);
};

const POSTS_PER_LOAD = 20; // Number of posts to load each time

// MediaCarousel component to handle multiple images/videos
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

  const nextMedia = () => {
    setCurrentMediaIndex((prevIndex) => (prevIndex + 1) % mediaUrls.length);
  };

  const prevMedia = () => {
    setCurrentMediaIndex((prevIndex) => (prevIndex - 1 + mediaUrls.length) % mediaUrls.length);
  };

  const currentMediaUrl = mediaUrls[currentMediaIndex];

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Determine overlay position based on aspect ratio
  const updateOverlayPosition = useCallback(() => {
    if (containerRef.current) {
      const img = new Image();
      img.src = currentMediaUrl;
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setOverlayPosition(aspectRatio < 1 ? 'bottom' : 'top');
      };
    }
  }, [currentMediaUrl]);

  React.useEffect(() => {
    if (isFullScreen) {
      updateOverlayPosition();
    }
  }, [isFullScreen, currentMediaUrl, updateOverlayPosition]);


  return (
    <div className="relative"
      onMouseEnter={isFullScreen ? handleMouseEnter : undefined}
      onMouseLeave={isFullScreen ? handleMouseLeave : undefined}
      ref={containerRef}
    >
      {mediaUrls.length > 1 && (
        <>
          <button
            onClick={prevMedia}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/20 text-white p-2 rounded-full z-10"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={nextMedia}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/20 text-white p-2 rounded-full z-10"
          >
            <ChevronRight />
          </button>
          <div className="absolute bottom-2 left-0 right-0 flex justify-center space-x-2 z-10">
            {mediaUrls.map((_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${index === currentMediaIndex ? 'bg-white' : 'bg-gray-500'}`}
              />
            ))}
          </div>
        </>
      )}

      <div className="relative">
        {mediaUrls[currentMediaIndex].endsWith('.mp4') ? (
          <video
            src={mediaUrls[currentMediaIndex]}
            alt={title}
            className={cn(
              "w-full h-auto object-contain",
              isFullScreen ? 'max-h-[90vh] max-w-full' : 'aspect-square'
            )}
            controls
            muted
            playsInline
            autoPlay={isFullScreen}
          />
        ) : (
          <img
            src={mediaUrls[currentMediaIndex]}
            alt={title}
             className={cn(
              "w-full h-auto object-contain",
              isFullScreen ? 'max-h-[90vh] max-w-full' : 'aspect-square'
            )}
          />
        )}

        {isFullScreen && (
          <div
            className={cn(
              "absolute left-0 w-full bg-black/50 text-white transition-opacity duration-300 p-4",
              overlayPosition === 'top' ? 'top-0' : 'bottom-0',
              isHovered ? 'opacity-100' : 'opacity-0'
            )}
          >
            <DialogTitle className="text-lg font-semibold">{title} (From: <a href={`https://www.reddit.com/r/${subreddit}/comments/${postId}`} target="_blank" rel="noopener noreferrer" className="underline">r/{subreddit}</a>)</DialogTitle>
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const [subreddits, setSubreddits] = useState<string>('');
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<RedditPost | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [after, setAfter] = useState<string | null>(null); // Pagination token
  const [hasMore, setHasMore] = useState(true);
  const [fetchInitiated, setFetchInitiated] = useState(false); // Track if fetch has been initiated
  const [cache, setCache] = useState<{ [key: string]: RedditPost[] }>({}); // Add cache state
    const [favorites, setFavorites] = useState<string[]>([]);
    const [open, setOpen] = React.useState(false)


  const { toast } = useToast();

  const observer = useRef<IntersectionObserver>();
  const lastPostRef = useCallback(
    (node: HTMLDivElement) => {
      if (isLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && hasMore && fetchInitiated) {
          // Only trigger if fetch has been initiated
          loadMorePosts();
        }
      });

      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore, fetchInitiated]
  );

  const fetchPosts = async () => {
    setIsLoading(true);
    setError(null);
    setPosts([]);
    setAfter(null); // Reset pagination
    setHasMore(true);
    setFetchInitiated(true); // Mark that fetch has been initiated
    setCache({}); // Clear cache

    const subs = subreddits.split(',').map(s => s.trim()).filter(s => s !== '');

    if (subs.length === 0) {
      setSubreddits(favorites);
    }

    if (subs.every(isValidSubreddit)) {
      try {
        const initialPosts = await Promise.all(
          subs.map(async sub => {
            const { posts: fetchedPosts, after: newAfter } = await getHotPosts(sub, undefined, POSTS_PER_LOAD);
            setCache(prevCache => ({ ...prevCache, [sub]: fetchedPosts }));
            return { sub, posts: fetchedPosts, after: newAfter };
          })
        );

        const flattenedPosts = initialPosts.reduce((acc, curr) => {
          return acc.concat(curr.posts.map(post => ({ ...post, subreddit: curr.sub })));
        }, []);

        setPosts(flattenedPosts);

        // Set 'after' value based on last subreddit's response
        if (initialPosts.length > 0) {
          setAfter(initialPosts[initialPosts.length - 1].after);
          setHasMore(initialPosts.some(result => result.after !== null));
        } else {
          setAfter(null);
          setHasMore(false);
        }

      } catch (e: any) {
        setError(`Failed to fetch posts: ${e.message}`);
      }
    } else {
      setError("Invalid subreddit name. Please use only alphanumeric characters and underscores.");
    }
    setIsLoading(false);
  };

  const loadMorePosts = async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    const subs = subreddits.split(',').map(s => s.trim()).filter(s => s !== '');
    if (subs.length === 0) {
      setSubreddits(favorites);
    }

    if (subs.every(isValidSubreddit)) {
      try {
        const newPosts = await Promise.all(
          subs.map(async sub => {
            const { posts: fetchedPosts, after: newAfter } = await getHotPosts(sub, after, POSTS_PER_LOAD);
            return { sub, posts: fetchedPosts, newAfter };
          })
        );

        const flattenedPosts = newPosts.reduce((acc, curr) => {
          return acc.concat(curr.posts.map(post => ({ ...post, subreddit: curr.sub })));
        }, []);

        setPosts(prevPosts => [...prevPosts, ...flattenedPosts]);

        // Update 'after' and 'hasMore' based on the responses
        if (newPosts.length > 0) {
          setAfter(newPosts[newPosts.length - 1].newAfter);
          setHasMore(newPosts.some(result => result.newAfter !== null));
        } else {
          setAfter(null);
          setHasMore(false);
        }

      } catch (e: any) {
        setError(`Failed to fetch more posts: ${e.message}`);
        setHasMore(false);
      }
    }
    setIsLoading(false);
  };

  const handleThumbnailClick = (post: RedditPost) => {
    setSelectedPost(post);
    setOpen(true);
  };

  const handleDialogClose = () => {
    setSelectedPost(null);
    setOpen(false);
  };

    const toggleFavorite = (subredditName: string) => {
        setFavorites(prevFavorites => {
            if (prevFavorites.includes(subredditName)) {
                return prevFavorites.filter(fav => fav !== subredditName);
            } else {
                return [...prevFavorites, subredditName];
            }
        });
    };

    const isFavorite = (subredditName: string) => favorites.includes(subredditName);


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Sub Gallery</h1>

      {/* Subreddit Input */}
      <div className="flex flex-col mb-4">
        <Input
          type="text"
          placeholder="Enter subreddit names separated by commas (e.g., pics, videos)"
          value={subreddits}
          onChange={(e) => setSubreddits(e.target.value)}
        />
        <Button onClick={fetchPosts} disabled={isLoading} className="mt-2 w-fit">
          {isLoading ? "Fetching..." : "Fetch Posts"}
        </Button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Media Gallery */}
      <div className="grid gap-0 md:grid-cols-3 lg:grid-cols-4">
        {posts.map((post, index) => (
          <div key={index} className="relative" ref={posts.length === index + 1 ? lastPostRef : null}>
            <Card onClick={() => handleThumbnailClick(post)} className="overflow-hidden cursor-pointer">
              <MediaCarousel mediaUrls={post.mediaUrls} title={post.title} subreddit={post.subreddit} postId={post.postId} />
            </Card>
          </div>
        ))}
      </div>

      {isLoading && <div>Loading more posts...</div>}
      {!hasMore && <p>No more posts to load.</p>}

      {/* Expanded View Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[1024px]">
          {selectedPost && (
            <>
              <MediaCarousel mediaUrls={selectedPost.mediaUrls} title={selectedPost.title} subreddit={selectedPost.subreddit} postId={selectedPost.postId} isFullScreen={true} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="mt-8 text-center text-muted-foreground">
        <p>
          Built with ❤️ by Firebase Studio
        </p>
      </footer>
    </div>
  );
}

