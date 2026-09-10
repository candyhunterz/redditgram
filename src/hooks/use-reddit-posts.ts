import { useState, useRef, useCallback, useEffect } from 'react';
import type { RedditPost, SortType, TimeFrame, CachedRedditResponse, CacheKey } from '@/types/reddit';
import { isValidSubreddit, parseSubreddits, interleavePosts, generateCacheKey, POSTS_PER_LOAD } from '@/types/reddit';
import { LRUCache } from '@/lib/lru-cache';
import { getCachedPosts, setCachedPosts } from '@/lib/indexed-db';
import { getPosts } from '@/services/reddit';
import { usePrefetch } from '@/hooks/use-prefetch';
import { useToast } from '@/hooks/use-toast';

interface UseRedditPostsOptions {
  subredditInput: string;
  sortType: SortType;
  timeFrame: TimeFrame;
  /** When true, IntersectionObserver skips observation (favorites view). */
  showFavoritesOnly: boolean;
  /** Called for each valid subreddit on initial fetch. */
  addToHistory: (sub: string) => void;
}

/**
 * Encapsulates all Reddit post fetching, caching, and pagination logic.
 *
 * Three-tier caching: in-memory LRU (100 entries) -> IndexedDB -> network.
 * Uses Promise.allSettled for per-subreddit error isolation.
 * Wires IntersectionObserver for infinite scroll and usePrefetch for 80% scroll prefetch.
 */
export function useRedditPosts({
  subredditInput,
  sortType,
  timeFrame,
  showFavoritesOnly,
  addToHistory,
}: UseRedditPostsOptions) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [afterTokens, setAfterTokens] = useState<{ [subreddit: string]: string | null }>({});
  const [hasMore, setHasMore] = useState(true);
  const [fetchInitiated, setFetchInitiated] = useState(false);

  const { toast } = useToast();

  // Single LRU cache instance for the lifetime of this hook.
  const apiCache = useRef(new LRUCache<CacheKey, CachedRedditResponse>(100)).current;

  // Ref that always holds the latest loadMorePosts so IntersectionObserver
  // callbacks never capture a stale closure.
  const loadMorePostsRef = useRef<() => Promise<void>>();

  const observer = useRef<IntersectionObserver>();
  const generation = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const activeFeed = useRef<{ subreddits: string[]; sortType: SortType; timeFrame: TimeFrame } | null>(null);

  useEffect(() => () => {
    generation.current++;
    controller.current?.abort();
    observer.current?.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // performFetch — internal fetch helper (not exposed)
  // -----------------------------------------------------------------------
  const performFetch = useCallback(async (
    subredditsToFetch: string[],
    currentSortType: SortType,
    currentTimeFrame: TimeFrame | undefined,
    currentAfterTokens: { [subreddit: string]: string | null },
    signal: AbortSignal,
    refresh = false,
  ): Promise<{
    groupedPosts: RedditPost[][];
    updatedAfterTokens: { [subreddit: string]: string | null };
    anyHasMore: boolean;
  }> => {
    if (subredditsToFetch.length === 0) {
      return { groupedPosts: [], updatedAfterTokens: {}, anyHasMore: false };
    }
    if (!subredditsToFetch.every(isValidSubreddit)) {
      throw new Error('Invalid subreddit name found.');
    }

    type SuccessfulFetchValue = { posts: RedditPost[]; after: string | null; sub: string };
    let overallError: Error | null = null;
    const fetchPromises: Promise<SuccessfulFetchValue>[] = [];
    const subOrderForResults: string[] = [];

    for (const sub of subredditsToFetch) {
      const afterParam = currentAfterTokens[sub] ?? undefined;
      const cacheKey = generateCacheKey(
        sub,
        currentSortType,
        currentSortType === 'top' ? currentTimeFrame : undefined,
        afterParam,
      );
      subOrderForResults.push(sub);

      // Check in-memory cache first (fastest)
      if (!refresh && apiCache.has(cacheKey)) {
        const cachedData = apiCache.get(cacheKey)!;
        const postsWithMetadata = cachedData.posts.map(p => ({
          ...p,
          subreddit: sub,
          isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false,
        }));
        fetchPromises.push(Promise.resolve({ posts: postsWithMetadata, after: cachedData.after, sub }));
      } else {
        // Check IndexedDB cache then fall back to network
        fetchPromises.push(
          (async () => {
            const idbCached = refresh ? null : await getCachedPosts(cacheKey);
            signal.throwIfAborted();
            if (idbCached) {
              apiCache.set(cacheKey, { posts: idbCached.posts, after: idbCached.after });
              const postsWithMetadata = idbCached.posts.map(p => ({
                ...p,
                subreddit: sub,
                isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false,
              }));
              return { posts: postsWithMetadata, after: idbCached.after, sub };
            }

            // Cache miss — fetch from API
            const response = await getPosts(sub, currentSortType, {
              timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
              after: afterParam,
              limit: POSTS_PER_LOAD,
              signal,
              refresh,
            });

            signal.throwIfAborted();
            const dataToCache: CachedRedditResponse = { posts: response.posts, after: response.after };
            apiCache.set(cacheKey, dataToCache);
            await setCachedPosts(cacheKey, response.posts, response.after, {
              subreddit: sub,
              sortType: currentSortType,
              timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
            });

            const postsWithMetadata = response.posts.map(p => ({
              ...p,
              subreddit: sub,
              isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false,
            }));
            return { posts: postsWithMetadata, after: response.after, sub };
          })(),
        );
      }
    }

    try {
      const results: PromiseSettledResult<SuccessfulFetchValue>[] = await Promise.allSettled(fetchPromises);
      signal.throwIfAborted();
      const successfulResults: SuccessfulFetchValue[] = [];
      const updatedAfterTokens: { [subreddit: string]: string | null } = {};

      results.forEach((result, index) => {
        const sub = subOrderForResults[index];
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
          updatedAfterTokens[sub] = result.value.after;
        } else {
          console.error(`Failed to fetch/process for r/${sub}:`, result.reason);
          updatedAfterTokens[sub] = currentAfterTokens[sub] ?? null;
          if (!overallError) {
            overallError = result.reason instanceof Error
              ? result.reason
              : new Error(`Fetch failed for r/${sub}: ${String(result.reason)}`);
          }
        }
      });

      if (overallError && successfulResults.length === 0) {
        throw new Error(`All subreddit fetches failed. First error: ${overallError}`);
      } else if (overallError) {
        toast({ variant: 'destructive', title: 'Fetch Warning', description: 'Some subreddits could not be loaded.' });
      }

      const groupedPosts = successfulResults.map(res => res.posts);
      const anyHasMore = Object.values(updatedAfterTokens).some(token => token !== null);
      const finalUpdatedTokens = { ...currentAfterTokens, ...updatedAfterTokens };

      return { groupedPosts, updatedAfterTokens: finalUpdatedTokens, anyHasMore };
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error('An unexpected error occurred during the fetch process.');
    }
  }, [apiCache, toast]);

  // -----------------------------------------------------------------------
  // fetchInitialPosts — clears posts and fetches fresh results
  // -----------------------------------------------------------------------
  const fetchInitialPosts = useCallback(async (
    inputOverride?: string,
    filters?: { sortType: SortType; timeFrame: TimeFrame },
  ) => {
    const requestId = ++generation.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    pending.current = true;
    const selectedSort = filters?.sortType ?? sortType;
    const selectedTime = filters?.timeFrame ?? timeFrame;
    const inputToUse = inputOverride ?? subredditInput;
    const subsToUse = parseSubreddits(inputToUse);

    activeFeed.current = { subreddits: subsToUse, sortType: selectedSort, timeFrame: selectedTime };

    // Save searched subreddits to history
    subsToUse.forEach(sub => {
      if (isValidSubreddit(sub)) {
        addToHistory(sub);
      }
    });

    if (subsToUse.length === 0) {
      setError('Please enter at least one valid subreddit name.');
      setPosts([]);
      setFetchInitiated(false);
      setHasMore(false);
      setIsLoading(false);
      pending.current = false;
      return;
    }

    // A submitted feed is a refresh. Discard old pagination pages as well.
    apiCache.clear();

    setIsLoading(true);
    setError(null);
    setPosts([]);
    setAfterTokens({});
    setHasMore(true);
    setFetchInitiated(true);

    try {
      const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch(subsToUse, selectedSort, selectedTime, {}, requestController.signal, true);
      if (requestId !== generation.current) return;
      const interleavedInitialPosts = interleavePosts(groupedPosts);
      setPosts(interleavedInitialPosts);
      setAfterTokens(updatedAfterTokens);
      setHasMore(anyHasMore);

      if (interleavedInitialPosts.length === 0 && !anyHasMore) {
        if (subsToUse.every(isValidSubreddit)) {
          toast({ description: `No posts found for "${subsToUse.join(', ')}" with the current filters.` });
        } else {
          toast({ description: 'No posts found.' });
        }
      }
    } catch (e) {
      if (requestId !== generation.current) return;
      if (e instanceof Error) {
        setError(`Fetch error: ${e.message}`);
      } else {
        setError('An unknown error occurred during the initial fetch.');
      }
      setHasMore(false);
      setPosts([]);
    } finally {
      if (requestId === generation.current) {
        pending.current = false;
        setIsLoading(false);
      }
    }
  }, [subredditInput, sortType, timeFrame, toast, performFetch, apiCache, addToHistory]);

  // -----------------------------------------------------------------------
  // loadMorePosts — appends the next page to posts
  // -----------------------------------------------------------------------
  const loadMorePosts = useCallback(async () => {
    if (pending.current || !hasMore || !fetchInitiated || showFavoritesOnly) return;
    const feed = activeFeed.current;
    if (!feed) return;
    const subsToUse = feed.subreddits;
    if (subsToUse.length === 0) {
      setHasMore(false);
      return;
    }
    const subsWithPotentialMore = subsToUse.filter(
      sub => afterTokens[sub] !== null && afterTokens[sub] !== undefined,
    );
    if (subsWithPotentialMore.length === 0) {
      setHasMore(false);
      return;
    }

    const requestId = generation.current;
    const requestController = controller.current;
    if (!requestController || requestController.signal.aborted) return;
    pending.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch(
        subsWithPotentialMore,
        feed.sortType,
        feed.timeFrame,
        afterTokens,
        requestController.signal,
      );
      if (requestId !== generation.current) return;
      const interleavedNewPosts = interleavePosts(groupedPosts);
      setPosts(prevPosts => {
        const seen = new Set(prevPosts.map(post => post.postId));
        return [...prevPosts, ...interleavedNewPosts.filter(post => {
          if (seen.has(post.postId)) return false;
          seen.add(post.postId);
          return true;
        })];
      });
      setAfterTokens(updatedAfterTokens);
      setHasMore(anyHasMore);
    } catch (e) {
      if (requestId !== generation.current) return;
      if (e instanceof Error) {
        setError(`Load more error: ${e.message}`);
      } else {
        setError('An unknown error occurred while loading more posts.');
      }
      setHasMore(false);
    } finally {
      if (requestId === generation.current) {
        pending.current = false;
        setIsLoading(false);
      }
    }
  }, [hasMore, fetchInitiated, afterTokens, showFavoritesOnly, performFetch]);

  // Keep the ref current so IntersectionObserver always calls the latest version.
  useEffect(() => {
    loadMorePostsRef.current = loadMorePosts;
  }, [loadMorePosts]);

  // -----------------------------------------------------------------------
  // lastPostRef — IntersectionObserver callback ref for infinite scroll
  // -----------------------------------------------------------------------
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      observer.current?.disconnect();
      if (isLoading || showFavoritesOnly || !node) return;
      observer.current = new IntersectionObserver(
        entries => {
          if (entries[0]?.isIntersecting && hasMore && fetchInitiated) {
            loadMorePostsRef.current?.();
          }
        },
        { threshold: 0.5 },
      );
      if (node) observer.current.observe(node);
    },
    [isLoading, hasMore, fetchInitiated, showFavoritesOnly],
  );

  // -----------------------------------------------------------------------
  // Prefetch at 80% scroll
  // -----------------------------------------------------------------------
  const { resetPrefetch } = usePrefetch({
    onPrefetch: loadMorePosts,
    enabled: !isLoading && hasMore && fetchInitiated && !showFavoritesOnly,
    threshold: 80,
  });

  // Reset prefetch trigger when new posts arrive
  useEffect(() => {
    if (!isLoading && posts.length > 0) {
      resetPrefetch();
    }
  }, [posts.length, isLoading, resetPrefetch]);

  return {
    posts,
    error,
    isLoading,
    hasMore,
    fetchInitiated,
    fetchInitialPosts,
    loadMorePosts,
    lastPostRef,
  };
}
