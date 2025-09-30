'use client';

import React, { forwardRef } from 'react';
import Masonry from 'react-masonry-css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Video, Copy as GalleryIcon, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaCarousel } from './media-carousel';
import type { RedditPost } from '@/services/reddit';

interface PostsGridProps {
  posts: RedditPost[];
  isLoading: boolean;
  hasMore: boolean;
  fetchInitiated: boolean;
  showFavoritesOnly: boolean;
  favorites: { [postId: string]: unknown };
  onPostClick: (post: RedditPost) => void;
  onToggleFavorite: (post: RedditPost) => void;
  lastPostRef?: (node: HTMLDivElement | null) => void;
}

/**
 * Grid component for displaying Reddit posts in a masonry layout
 */
export const PostsGrid = forwardRef<HTMLDivElement, PostsGridProps>(
  ({
    posts,
    isLoading,
    hasMore,
    fetchInitiated,
    showFavoritesOnly,
    favorites,
    onPostClick,
    onToggleFavorite,
    lastPostRef,
  }, ref) => {
    const breakpointColumnsObj = { 
      default: 6, 
      1280: 5, 
      1024: 4, 
      768: 3 
    };

    // Initial Loading Skeletons
    if (isLoading && posts.length === 0 && !showFavoritesOnly) {
      return (
        <Masonry 
          breakpointCols={breakpointColumnsObj} 
          className="my-masonry-grid flex gap-1.5" 
          columnClassName="my-masonry-grid_column"
        >
          {Array.from({ length: 18 }).map((_, index) => (
            <Skeleton key={`skeleton-${index}`} className="h-64 w-full mb-1.5" />
          ))}
        </Masonry>
      );
    }

    // No Posts Message
    if (fetchInitiated && posts.length === 0 && !isLoading) {
      return (
        <p className="text-center text-muted-foreground mt-10">
          {showFavoritesOnly ? 'No favorites saved yet.' : 'No posts found.'}
        </p>
      );
    }

    // Posts Grid
    if (posts.length === 0) {
      return null;
    }

    return (
      <div ref={ref}>
        <Masonry 
          breakpointCols={breakpointColumnsObj} 
          className="my-masonry-grid flex gap-1.5" 
          columnClassName="my-masonry-grid_column"
        >
          {posts.map((post, index) => {
            const firstUrl = post?.mediaUrls?.[0];
            const isVideoPost = firstUrl && firstUrl.endsWith('.mp4');
            const isGalleryPost = post?.mediaUrls?.length > 1;
            const isUnplayable = post.isUnplayableVideoFormat ?? false;
            const isLastPost = !showFavoritesOnly && posts[posts.length - 1] === post;
            const shouldPrioritize = index < 8; // Priority load first 8 images

            return (
              <div
                key={`${post.subreddit}-${post.postId}`}
                ref={isLastPost ? lastPostRef : null}
                className="mb-1.5"
              >
                <Card
                  onClick={() => !isUnplayable && onPostClick(post)}
                  className={cn(
                    "group relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200",
                    !isUnplayable && "hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer",
                    isUnplayable && "cursor-default"
                  )}
                >
                  {/* Favorite Button */}
                  <div className="absolute top-1 left-1 z-20">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white active:scale-90"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(post);
                      }}
                    >
                      <Heart className={cn("h-4 w-4", favorites[post.postId] ? "fill-current" : "")} />
                    </Button>
                  </div>

                  {/* Media Type Indicators */}
                  {(isVideoPost || isGalleryPost || isUnplayable) && (
                    <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100">
                      {isUnplayable ? (
                        <Video className="h-3 w-3 opacity-70" />
                      ) : isVideoPost ? (
                        <Video className="h-3 w-3" />
                      ) : (
                        <GalleryIcon className="h-3 w-3" />
                      )}
                    </div>
                  )}

                  {/* Media Content */}
                  <MediaCarousel
                    mediaUrls={post.mediaUrls}
                    title={post.title}
                    subreddit={post.subreddit}
                    postId={post.postId}
                    isUnplayableVideoFormat={isUnplayable}
                    onToggleFavorite={() => onToggleFavorite(post)}
                    isFavorite={!!favorites[post.postId]}
                    priority={shouldPrioritize}
                  />
                </Card>
              </div>
            );
          })}
        </Masonry>

        {/* Loading More Indicator */}
        {isLoading && posts.length > 0 && !showFavoritesOnly && (
          <div className="flex justify-center items-center gap-2 text-center mt-6 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more...
          </div>
        )}

        {/* End Reached Message */}
        {!hasMore && fetchInitiated && posts.length > 0 && !showFavoritesOnly && (
          <p className="text-center mt-6 p-4 text-muted-foreground">
            You've reached the end!
          </p>
        )}
      </div>
    );
  }
);

PostsGrid.displayName = 'PostsGrid';