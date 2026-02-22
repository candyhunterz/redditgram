// src/types/reddit.ts
// Shared types and pure helpers for Reddit data.
// Re-exports RedditPost, SortType, TimeFrame from service so downstream
// consumers can import everything from one place.

export type { RedditPost, SortType, TimeFrame } from '@/services/reddit';
import type { RedditPost, SortType, TimeFrame } from '@/services/reddit';

// --- Cache types ---
export type CachedRedditResponse = {
  posts: RedditPost[];
  after: string | null;
};

export type CacheKey = string;

// --- Favorites types ---
export interface FavoritePostInfo {
  postId: string;
  title: string;
  subreddit: string;
  thumbnailUrl: string | undefined;
  mediaUrls?: string[];
  fullQualityUrls?: string[];
}

export type FavoritesMap = { [postId: string]: FavoritePostInfo };

// --- Constants ---
export const POSTS_PER_LOAD = 20;

// --- Pure helper functions ---

/**
 * Returns true if the subreddit name contains only alphanumeric characters and underscores
 * and is non-empty.
 */
export const isValidSubreddit = (subreddit: string): boolean => {
  return /^[a-zA-Z0-9_]+$/.test(subreddit) && subreddit.length > 0;
};

/**
 * Splits a comma-separated subreddit input string into an array of trimmed,
 * non-empty subreddit names.
 */
export const parseSubreddits = (input: string): string[] => {
  return input.split(',').map(s => s.trim()).filter(s => s !== '');
};

/**
 * Round-robin interleaves posts from multiple subreddits so results from
 * each subreddit appear evenly distributed throughout the feed.
 */
export const interleavePosts = (groupedPosts: RedditPost[][]): RedditPost[] => {
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

/**
 * Generates a deterministic cache key for a given subreddit + sort + timeframe +
 * pagination cursor combination.
 */
export const generateCacheKey = (
  sub: string,
  sort: SortType,
  time?: TimeFrame,
  after?: string | null
): CacheKey => {
  const timeKey = sort === 'top' ? (time || 'all') : 'hot';
  const afterKey = after || 'initial';
  return `${sub}::${sort}::${timeKey}::${afterKey}`;
};
