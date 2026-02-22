'use client';

import React from 'react';
import Masonry from 'react-masonry-css';
import { Loader2 } from 'lucide-react';
import { PostCard } from '@/components/post-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { RedditPost, FavoritesMap } from '@/types/reddit';

interface PostGridProps {
  posts: RedditPost[];
  isLoading: boolean;
  hasMore: boolean;
  fetchInitiated: boolean;
  showFavoritesOnly: boolean;
  error: string | null;
  favorites: FavoritesMap;
  breakpointColumnsObj: Record<string | number, number>;
  gridStyle: React.CSSProperties;
  densityGap: number;
  lastPostRef: (node: HTMLDivElement | null) => void;
  onToggleFavorite: (post: RedditPost) => void;
  onOpenDialog: (post: RedditPost) => void;
  onRetry: () => void;
  rawPostCount: number;
  onSubredditClick: (sub: string) => void;
}

export function PostGrid({
  posts,
  isLoading,
  hasMore,
  fetchInitiated,
  showFavoritesOnly,
  error,
  favorites,
  breakpointColumnsObj,
  gridStyle,
  densityGap,
  lastPostRef,
  onToggleFavorite,
  onOpenDialog,
  onRetry,
  rawPostCount,
  onSubredditClick,
}: PostGridProps) {
  return (
    <>
      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 max-w-md mx-auto">
          <p className="text-destructive text-center text-sm font-medium mb-3">{error}</p>
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
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

      {/* Main Content Area */}
      <main className="flex-grow mt-2" role="main" aria-label="Reddit posts gallery">
        {/* Screen reader live region for status updates */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading && rawPostCount === 0 ? 'Loading posts...' : ''}
          {isLoading && rawPostCount > 0 ? 'Loading more posts...' : ''}
          {!isLoading && posts.length > 0 ? `Showing ${posts.length} posts` : ''}
          {!isLoading && fetchInitiated && posts.length === 0 ? 'No posts found' : ''}
        </div>

        {/* Initial Loading Skeletons */}
        {isLoading && rawPostCount === 0 && !error && (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid flex gap-1.5"
            columnClassName="my-masonry-grid_column"
          >
            {Array.from({ length: 18 }).map((_, index) => (
              <Skeleton key={`skeleton-${index}`} className="h-64 w-full mb-1.5" />
            ))}
          </Masonry>
        )}

        {/* No Posts Message */}
        {fetchInitiated && posts.length === 0 && !isLoading && !error && (
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
                  onClick={() => onSubredditClick(sub)}
                  className="text-xs"
                >
                  r/{sub}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Posts Grid */}
        {posts.length > 0 && (
          <Masonry
            breakpointCols={breakpointColumnsObj}
            className="my-masonry-grid flex"
            columnClassName="my-masonry-grid_column"
            style={gridStyle}
            role="list"
            aria-label="Media posts"
          >
            {posts.map((post, index) => {
              const isLast = !showFavoritesOnly && index === posts.length - 1;
              return (
                <PostCard
                  key={`${post.subreddit}-${post.postId}`}
                  ref={isLast ? lastPostRef : null}
                  post={post}
                  isFavorite={!!favorites[post.postId]}
                  onToggleFavorite={() => onToggleFavorite(post)}
                  onClick={() => onOpenDialog(post)}
                  gap={densityGap}
                />
              );
            })}
          </Masonry>
        )}

        {/* Loading More Indicator */}
        {isLoading && posts.length > 0 && !showFavoritesOnly && (
          <div className="flex justify-center items-center gap-2 text-center mt-6 p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading more...
          </div>
        )}

        {/* End Reached Message */}
        {!hasMore && fetchInitiated && posts.length > 0 && !showFavoritesOnly && (
          <p className="text-center mt-6 p-4 text-muted-foreground">You&apos;ve reached the end!</p>
        )}
      </main>
    </>
  );
}
