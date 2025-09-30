'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/error-boundary';
import { ControlsPanel } from '@/components/controls-panel';
import { PostsGrid } from '@/components/posts-grid';
import { MediaCarousel } from '@/components/media-carousel';
import { 
  RedditPost, 
  SortType, 
  TimeFrame, 
  getPosts, 
  parseSubreddits, 
  isValidSubreddit, 
  createCacheKey,
  RedditApiError 
} from '@/services/reddit';
import { clientLogger } from '@/lib/logger';

// Constants
const POSTS_PER_LOAD = 20;
const LOCAL_STORAGE_SAVED_LISTS_KEY = 'savedSubredditLists';
const LOCAL_STORAGE_FAVORITES_KEY = 'favoritePosts';

// Types
interface CachedRedditResponse {
  posts: RedditPost[];
  after: string | null;
}

interface FavoritePostInfo {
  postId: string;
  title: string;
  subreddit: string;
  thumbnailUrl: string | undefined;
}

type FavoritesMap = { [postId: string]: FavoritePostInfo };
type SavedLists = { [name: string]: string };

/**
 * Interleaves posts from multiple subreddits for better mixing
 */
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

/**
 * Main home page component
 */
export default function Home() {
  // State Variables
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
  const [selectedListName, setSelectedListName] = useState<string>('');
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { toast } = useToast();

  // Cache
  const apiCache = useRef(new Map<string, CachedRedditResponse>()).current;

  // Filtered Posts
  const postsToDisplay = useMemo(() => {
    if (!showFavoritesOnly) {
      return posts.map(p => ({
        ...p,
        isUnplayableVideoFormat: p.isUnplayableVideoFormat ?? false
      }));
    } else {
      return Object.values(favorites).map((favInfo): RedditPost => ({
        postId: favInfo.postId,
        title: favInfo.title,
        subreddit: favInfo.subreddit,
        mediaUrls: favInfo.thumbnailUrl ? [favInfo.thumbnailUrl] : [],
        isUnplayableVideoFormat: false
      }));
    }
  }, [posts, favorites, showFavoritesOnly]);

  // Load/Save Saved Lists
  useEffect(() => {
    try {
      const storedLists = localStorage.getItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
      if (storedLists) {
        const parsed = JSON.parse(storedLists);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setSavedLists(parsed as SavedLists);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
        }
      }
    } catch (err) {
      clientLogger.error('Failed to load saved lists', err);
      localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(savedLists).length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SAVED_LISTS_KEY, JSON.stringify(savedLists));
      } catch (err) {
        clientLogger.error('Failed to save lists', err);
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
          toast({
            variant: 'destructive',
            title: 'Storage Full',
            description: 'Cannot save list. Local storage limit reached.'
          });
        }
      }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_SAVED_LISTS_KEY);
      } catch (err) {
        clientLogger.error('Failed to remove lists', err);
      }
    }
  }, [savedLists, toast]);

  // Load/Save Favorites
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
      clientLogger.error('Failed to load favorites', err);
      localStorage.removeItem(LOCAL_STORAGE_FAVORITES_KEY);
    }
  }, []);

  useEffect(() => {
    if (Object.keys(favorites).length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_FAVORITES_KEY, JSON.stringify(favorites));
      } catch (err) {
        clientLogger.error('Failed to save favorites', err);
        if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
          toast({
            variant: 'destructive',
            title: 'Storage Full',
            description: 'Cannot save favorites. Local storage limit reached.'
          });
        }
      }
    } else {
      try {
        localStorage.removeItem(LOCAL_STORAGE_FAVORITES_KEY);
      } catch (err) {
        clientLogger.error('Failed to remove favorites', err);
      }
    }
  }, [favorites, toast]);

  // Favorites Handlers
  const toggleFavorite = useCallback((post: RedditPost) => {
    setFavorites(currentFavorites => {
      const newFavorites = { ...currentFavorites };
      if (!currentFavorites[post.postId]) {
        newFavorites[post.postId] = {
          postId: post.postId,
          title: post.title,
          subreddit: post.subreddit,
          thumbnailUrl: post.mediaUrls?.[0]
        };
        toast({ description: 'Added to favorites' });
      } else {
        delete newFavorites[post.postId];
        toast({ description: 'Removed from favorites' });
      }
      return newFavorites;
    });
  }, [toast]);

  // Data Fetching with improved error handling
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
    if (subredditsToFetch.length === 0) {
      return { groupedPosts: [], updatedAfterTokens: {}, anyHasMore: false };
    }

    if (!subredditsToFetch.every(isValidSubreddit)) {
      throw new Error('Invalid subreddit name found.');
    }

    const fetchPromises: Promise<{ posts: RedditPost[]; after: string | null; sub: string }>[] = [];
    const subOrderForResults: string[] = [];

    for (const sub of subredditsToFetch) {
      const afterParam = currentAfterTokens[sub] ?? undefined;
      const cacheKey = createCacheKey(sub, currentSortType, currentTimeFrame, afterParam);
      subOrderForResults.push(sub);

      if (apiCache.has(cacheKey)) {
        clientLogger.debug('Cache hit', { cacheKey });
        const cachedData = apiCache.get(cacheKey)!;
        fetchPromises.push(Promise.resolve({
          posts: cachedData.posts.map(p => ({ ...p, subreddit: sub })),
          after: cachedData.after,
          sub: sub
        }));
      } else {
        clientLogger.debug('Cache miss, fetching', { cacheKey });
        fetchPromises.push(
          getPosts(sub, currentSortType, {
            timeFrame: currentSortType === 'top' ? currentTimeFrame : undefined,
            after: afterParam,
            limit: POSTS_PER_LOAD
          }).then(response => {
            const dataToCache: CachedRedditResponse = { posts: response.posts, after: response.after };
            apiCache.set(cacheKey, dataToCache);
            return { posts: response.posts, after: response.after, sub: sub };
          })
        );
      }
    }

    try {
      const results = await Promise.allSettled(fetchPromises);
      const successfulResults: { posts: RedditPost[]; after: string | null; sub: string }[] = [];
      const updatedAfterTokens: { [subreddit: string]: string | null } = {};
      let hasErrors = false;

      results.forEach((result, index) => {
        const sub = subOrderForResults[index];
        if (result.status === 'fulfilled') {
          successfulResults.push(result.value);
          updatedAfterTokens[sub] = result.value.after;
        } else {
          clientLogger.error('Failed to fetch subreddit', { sub, error: result.reason });
          updatedAfterTokens[sub] = currentAfterTokens[sub] ?? null;
          hasErrors = true;
        }
      });

      if (hasErrors && successfulResults.length === 0) {
        throw new Error('All subreddit fetches failed');
      } else if (hasErrors) {
        toast({
          variant: 'destructive',
          title: 'Partial Failure',
          description: 'Could not load some subreddits'
        });
      }

      const groupedPosts = successfulResults.map(res => res.posts);
      const anyHasMore = Object.values(updatedAfterTokens).some(token => token !== null);
      const finalUpdatedTokens = { ...currentAfterTokens, ...updatedAfterTokens };

      return { groupedPosts, updatedAfterTokens: finalUpdatedTokens, anyHasMore };

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error('An unexpected error occurred during the fetch process.');
      }
    }
  }, [apiCache, toast]);

  const fetchInitialPosts = useCallback(async () => {
    setShowFavoritesOnly(false);
    const subsToUse = parseSubreddits(subredditInput);
    
    if (subsToUse.length === 0) {
      setError('Please enter at least one valid subreddit name.');
      setPosts([]);
      setFetchInitiated(false);
      setHasMore(false);
      return;
    }

    clientLogger.info('Starting initial fetch', { subreddits: subsToUse, sortType, timeFrame });

    // Clear initial cache for relevant keys
    subsToUse.forEach(sub => {
      const initialCacheKey = createCacheKey(sub, sortType, sortType === 'top' ? timeFrame : undefined);
      if (apiCache.has(initialCacheKey)) {
        apiCache.delete(initialCacheKey);
        clientLogger.debug('Cleared initial cache', { cacheKey: initialCacheKey });
      }
    });

    setIsLoading(true);
    setError(null);
    setPosts([]);
    setAfterTokens({});
    setHasMore(true);
    setFetchInitiated(true);

    try {
      const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch(
        subsToUse,
        sortType,
        timeFrame,
        {}
      );
      
      const interleavedInitialPosts = interleavePosts(groupedPosts);
      setPosts(interleavedInitialPosts);
      setAfterTokens(updatedAfterTokens);
      setHasMore(anyHasMore);

      if (interleavedInitialPosts.length === 0 && anyHasMore === false && !error) {
        toast({ 
          description: `No posts found for "${subsToUse.join(', ')}" with the current filters.` 
        });
      }
    } catch (err) {
      let errorMessage = 'An unknown error occurred during the initial fetch.';
      
      if (err instanceof RedditApiError) {
        errorMessage = err.message;
        if (err.status === 429) {
          errorMessage = 'Rate limit exceeded. Please wait before trying again.';
        }
      } else if (err instanceof Error) {
        errorMessage = `Fetch error: ${err.message}`;
      }
      
      clientLogger.error('Initial fetch failed', err);
      setError(errorMessage);
      setHasMore(false);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [subredditInput, sortType, timeFrame, toast, performFetch, apiCache, error]);

  // Infinite Scroll
  const observer = useRef<IntersectionObserver>();
  const loadMorePostsRef = useRef<() => Promise<void>>();
  
  const lastPostRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading || showFavoritesOnly) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting && hasMore && fetchInitiated) {
        loadMorePostsRef.current?.();
      }
    }, { threshold: 0.5 });
    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, fetchInitiated, showFavoritesOnly]);

  const loadMorePosts = useCallback(async () => {
    if (isLoading || !hasMore || !fetchInitiated) return;
    
    const subsToUse = parseSubreddits(subredditInput);
    if (subsToUse.length === 0) {
      setHasMore(false);
      return;
    }
    
    const subsWithPotentialMore = subsToUse.filter(sub => 
      afterTokens[sub] !== null && afterTokens[sub] !== undefined
    );
    
    if (subsWithPotentialMore.length === 0) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { groupedPosts, updatedAfterTokens, anyHasMore } = await performFetch(
        subsWithPotentialMore,
        sortType,
        timeFrame,
        afterTokens
      );
      
      const interleavedNewPosts = interleavePosts(groupedPosts);
      setPosts(prevPosts => [...prevPosts, ...interleavedNewPosts]);
      setAfterTokens(updatedAfterTokens);
      setHasMore(anyHasMore);
    } catch (err) {
      let errorMessage = 'An unknown error occurred while loading more posts.';
      
      if (err instanceof RedditApiError) {
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = `Load more error: ${err.message}`;
      }
      
      clientLogger.error('Load more failed', err);
      setError(errorMessage);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, fetchInitiated, afterTokens, subredditInput, sortType, timeFrame, performFetch]);

  useEffect(() => {
    loadMorePostsRef.current = loadMorePosts;
  }, [loadMorePosts]);

  // Scroll Listener Effect for Scroll-to-Top Button
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

  // Event Handlers
  const handleThumbnailClick = useCallback((post: RedditPost) => {
    setSelectedPost(post);
    setIsDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setIsDialogOpen(false);
    setTimeout(() => {
      setSelectedPost(null);
    }, 300);
  }, []);

  // Saved Lists Handlers
  const handleSaveList = useCallback(() => {
    const currentInput = subredditInput.trim();
    if (!currentInput) {
      toast({ variant: 'destructive', description: 'Input field is empty.' });
      return;
    }
    
    const listName = window.prompt('Enter a name for this list:', '');
    if (listName === null) return;
    
    const trimmedName = listName.trim();
    if (!trimmedName) {
      toast({ variant: 'destructive', description: 'List name cannot be empty.' });
      return;
    }
    
    if (trimmedName === 'Load a saved list...') {
      toast({ variant: 'destructive', description: 'Invalid list name.' });
      return;
    }
    
    setSavedLists(prev => ({ ...prev, [trimmedName]: currentInput }));
    toast({ description: `List "${trimmedName}" saved.` });
    setSelectedListName(trimmedName);
  }, [subredditInput, toast]);

  const handleLoadList = useCallback((listName: string) => {
    if (listName && savedLists[listName]) {
      setSubredditInput(savedLists[listName]);
      setSelectedListName(listName);
      setTimeout(() => {
        fetchInitialPosts();
      }, 0);
    } else if (listName === '' || !savedLists[listName]) {
      setSelectedListName('');
    }
  }, [savedLists, fetchInitialPosts]);

  const handleDeleteList = useCallback(() => {
    if (!selectedListName) {
      toast({ variant: 'destructive', description: 'No list selected to delete.' });
      return;
    }
    
    if (window.confirm(`Delete list "${selectedListName}"?`)) {
      setSavedLists(prev => {
        const newState = { ...prev };
        delete newState[selectedListName];
        return newState;
      });
      setSelectedListName('');
      toast({ description: `List "${selectedListName}" deleted.` });
    }
  }, [selectedListName, toast]);

  // Scroll to Top Function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-screen flex flex-col">
        {/* Header */}
        <header className="mb-6 flex-shrink-0">
          <div className="max-w-xl mx-auto space-y-3">
            {/* Input and Fetch Button */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <Input
                type="text"
                aria-label="Enter subreddit names separated by commas"
                placeholder="Enter subreddits..."
                value={subredditInput}
                onChange={(e) => setSubredditInput(e.target.value)}
                className="flex-grow text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) fetchInitialPosts();
                }}
              />
              <Button
                onClick={fetchInitialPosts}
                disabled={isLoading}
                className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform"
              >
                {isLoading && posts.length === 0 ? 'Fetching...' : 'Fetch'}
              </Button>
            </div>
            
            {/* Controls Panel */}
            <ControlsPanel
              isControlsOpen={isControlsOpen}
              setIsControlsOpen={setIsControlsOpen}
              sortType={sortType}
              setSortType={setSortType}
              timeFrame={timeFrame}
              setTimeFrame={setTimeFrame}
              showFavoritesOnly={showFavoritesOnly}
              setShowFavoritesOnly={setShowFavoritesOnly}
              favoritesCount={Object.keys(favorites).length}
              savedLists={savedLists}
              selectedListName={selectedListName}
              setSelectedListName={setSelectedListName}
              subredditInput={subredditInput}
              isLoading={isLoading}
              onSaveList={handleSaveList}
              onLoadList={handleLoadList}
              onDeleteList={handleDeleteList}
            />
          </div>
          {/* Error Message */}
          {error && <p className="text-red-500 mt-2 text-center text-sm">{error}</p>}
        </header>

        {/* Main Content Area */}
        <main className="flex-grow mt-2">
          <PostsGrid
            posts={postsToDisplay}
            isLoading={isLoading}
            hasMore={hasMore}
            fetchInitiated={fetchInitiated}
            showFavoritesOnly={showFavoritesOnly}
            favorites={favorites}
            onPostClick={handleThumbnailClick}
            onToggleFavorite={toggleFavorite}
            lastPostRef={lastPostRef}
          />
        </main>

        {/* Scroll-to-Top Button */}
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
          <DialogContent className="max-w-none w-[95vw] h-[95vh] p-0 bg-transparent border-none overflow-hidden flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center bg-black/90 backdrop-blur-sm p-6">
              <DialogTitle className="sr-only">
                Expanded view: {selectedPost?.title || 'Reddit Post'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Expanded view of Reddit post: {selectedPost?.title || 'Content'}...
              </DialogDescription>

              {selectedPost ? (
                <MediaCarousel
                  mediaUrls={selectedPost.mediaUrls}
                  title={selectedPost.title}
                  subreddit={selectedPost.subreddit}
                  postId={selectedPost.postId}
                  isFullScreen={true}
                  isUnplayableVideoFormat={selectedPost.isUnplayableVideoFormat ?? false}
                  onToggleFavorite={() => toggleFavorite(selectedPost)}
                  isFavorite={!!favorites[selectedPost.postId]}
                />
              ) : (
                <div className="text-white text-xl">Loading content...</div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <footer className="mt-16 md:mt-24 text-center text-sm text-muted-foreground flex-shrink-0 pb-6">
          <p>Built with ❤️</p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}