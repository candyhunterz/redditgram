// src/app/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
// *** Standard Imports ***
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp, Sun, Moon, Keyboard, Settings } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useSubredditHistory } from "@/hooks/use-subreddit-history";
import { sharePost } from "@/lib/share";
import { downloadMedia } from "@/lib/download";
import { usePostSearch } from "@/hooks/use-post-search";
import { useGridDensity } from "@/hooks/use-grid-density";
import { useSettings } from "@/hooks/use-settings";
import { SettingsModal } from "@/components/settings-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FullscreenDialog, KeyboardShortcutsDialog } from '@/components/fullscreen-dialog';
import { SubredditSearchBar } from '@/components/subreddit-search-bar';
import { FeedControls } from '@/components/feed-controls';
import { PostCard } from '@/components/post-card';
import Masonry from 'react-masonry-css';
import { FeedPreset } from '@/lib/indexed-db';
import { FeedPresetBar } from '@/components/feed-preset-bar';
// *** Custom Hooks ***
import { useScrollToTop } from '@/hooks/use-scroll-to-top';
import { useFullscreenDialog } from '@/hooks/use-fullscreen-dialog';
import { useFavorites } from '@/hooks/use-favorites';
import { useFeedPresets } from '@/hooks/use-feed-presets';
import { useRedditPosts } from '@/hooks/use-reddit-posts';
// *** Shared Types ***
import type { RedditPost, SortType, TimeFrame } from '@/types/reddit';
// *** End Standard Imports ***



// --- Home Page Component ---
export default function Home() {
  // --- UI State (stays in page.tsx) ---
  const [subredditInput, setSubredditInput] = useState<string>('');
  const [sortType, setSortType] = useState<SortType>('hot');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('day');
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { history: subredditHistory, addToHistory, getSuggestions } = useSubredditHistory();

  // Centralized settings
  const {
    settings,
    updateSetting,
    resetSettings,
    resolvedTheme,
  } = useSettings();

  // Grid density hook
  const { density, setDensity, cycleDensity, config: densityConfig, gridStyle } = useGridDensity();

  // Sync settings.gridDensity with useGridDensity hook
  useEffect(() => {
    if (settings.gridDensity !== density) {
      setDensity(settings.gridDensity);
    }
  }, [settings.gridDensity, density, setDensity]);

  // -----------------------------------------------------------------------
  // Custom Hooks (Phase 3 extractions)
  // -----------------------------------------------------------------------
  const { showScrollTop, scrollToTop } = useScrollToTop();
  const { selectedPost, isDialogOpen, openDialog, closeDialog } = useFullscreenDialog();
  const { favorites, showFavoritesOnly, setShowFavoritesOnly, favoritesLoadComplete, toggleFavorite } = useFavorites();
  const {
    presets,
    activePresetName,
    setActivePresetName,
    initialLoadComplete,
    handleSavePreset,
    handleLoadPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleRenamePreset,
  } = useFeedPresets();
  const {
    posts,
    error,
    isLoading,
    hasMore,
    fetchInitiated,
    fetchInitialPosts,
    loadMorePosts,
    lastPostRef,
  } = useRedditPosts({
    subredditInput,
    sortType,
    timeFrame,
    showFavoritesOnly,
    addToHistory,
  });

  // -----------------------------------------------------------------------
  // basePosts — page-level orchestration: merge posts + favorites views
  // -----------------------------------------------------------------------
  const basePosts = useMemo(() => {
    let result: RedditPost[];

    if (!showFavoritesOnly) {
        // When showing all posts, return the fetched posts array directly.
        // isUnplayableVideoFormat is already set by the API route on every post object.
        result = posts;
    } else {
        // When showing only favorites, map the favorites map values
        result = Object.values(favorites).map((favInfo): RedditPost => {
            // Use stored arrays; fall back to thumbnailUrl for old favorites
            const mediaUrls = favInfo.mediaUrls?.length ? favInfo.mediaUrls
                : (favInfo.thumbnailUrl ? [favInfo.thumbnailUrl] : []);
            const fullQualityUrls = favInfo.fullQualityUrls?.length ? favInfo.fullQualityUrls
                : mediaUrls;

            return {
              postId: favInfo.postId,
              title: favInfo.title,
              subreddit: favInfo.subreddit,
              mediaUrls,
              fullQualityUrls,
              isUnplayableVideoFormat: false,
            };
        });
    }

    return result;
  }, [posts, favorites, showFavoritesOnly]);

  // Apply search filter
  const { searchQuery, setSearchQuery, filteredPosts: postsToDisplay, clearSearch, highlightMatch } = usePostSearch(basePosts);

  // -----------------------------------------------------------------------
  // Preset wiring — thin wrapper to orchestrate hook + page-level state
  // -----------------------------------------------------------------------
  const onLoadPreset = useCallback((preset: FeedPreset) => {
    handleLoadPreset(preset);
    setSubredditInput(preset.subreddits);
    setSortType(preset.sortType as SortType);
    setTimeFrame(preset.timeFrame as TimeFrame);
    setShowFavoritesOnly(false);
    fetchInitialPosts(preset.subreddits);
  }, [handleLoadPreset, fetchInitialPosts, setShowFavoritesOnly]);

  const onSavePreset = useCallback(() => {
    handleSavePreset(subredditInput, sortType, timeFrame);
  }, [handleSavePreset, subredditInput, sortType, timeFrame]);

  const onUpdatePreset = useCallback((presetName: string) => {
    handleUpdatePreset(presetName, subredditInput, sortType, timeFrame);
  }, [handleUpdatePreset, subredditInput, sortType, timeFrame]);

  // -----------------------------------------------------------------------
  // Share / Download handlers (stay in page.tsx — UI actions)
  // -----------------------------------------------------------------------
  const handleShare = useCallback(async (post: RedditPost) => {
    const result = await sharePost({
      title: post.title,
      subreddit: post.subreddit,
      postId: post.postId,
    });
    if (result.shared) {
      if (result.method === 'clipboard') {
        toast({ description: 'Link copied to clipboard' });
      }
    } else {
      toast({ variant: 'destructive', description: 'Failed to share' });
    }
  }, [toast]);

  const handleDownload = useCallback(async (post: RedditPost) => {
    const urlToDownload = post.fullQualityUrls?.[0] || post.mediaUrls?.[0];
    if (!urlToDownload) {
      toast({ variant: 'destructive', description: 'No media to download' });
      return;
    }

    toast({ description: 'Starting download...' });

    const success = await downloadMedia({
      url: urlToDownload,
      subreddit: post.subreddit,
      postId: post.postId,
    });

    if (success) {
      toast({ description: 'Download complete' });
    } else {
      toast({ variant: 'destructive', description: 'Download failed' });
    }
  }, [toast]);

  // -----------------------------------------------------------------------
  // Fetch trigger — reset UI state then delegate to hook
  // -----------------------------------------------------------------------
  const triggerFetch = useCallback((inputOverride?: string) => {
    setShowFavoritesOnly(false);
    fetchInitialPosts(inputOverride);
  }, [fetchInitialPosts, setShowFavoritesOnly]);

  // --- Masonry Breakpoint Configuration (uses grid density) ---
  const breakpointColumnsObj = useMemo(() => ({
    default: densityConfig.columns.wide,
    1280: densityConfig.columns.desktop,
    1024: densityConfig.columns.tablet,
    768: densityConfig.columns.mobile,
  }), [densityConfig]);

  // --- Render ---
  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 sm:py-6 min-h-screen flex flex-col">
      {/* Header */}
      <header className="mb-6 flex-shrink-0">
        <div className="max-w-xl mx-auto space-y-3">
            {/* Header Controls */}
            <div className="flex justify-end gap-1" role="toolbar" aria-label="Main controls">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                aria-label="Open settings"
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKeyboardShortcuts(true)}
                aria-label="Show keyboard shortcuts"
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-pressed={theme === 'dark'}
                className="h-9 w-9 rounded-full active:scale-95 transition-transform"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </div>
            {/* Subreddit Search Bar */}
            <SubredditSearchBar
              subredditInput={subredditInput}
              setSubredditInput={setSubredditInput}
              isLoading={isLoading}
              postsExist={posts.length > 0}
              onFetch={triggerFetch}
              getSuggestions={getSuggestions}
            />
             {/* Feed Preset Bar - Always visible */}
             <div className="flex justify-center">
               <FeedPresetBar
                 presets={presets}
                 activePresetName={activePresetName}
                 onLoadPreset={onLoadPreset}
                 onSavePreset={onSavePreset}
                 onUpdatePreset={onUpdatePreset}
                 onDeletePreset={handleDeletePreset}
                 onRenamePreset={handleRenamePreset}
                 disabled={isLoading}
               />
             </div>
             {/* Feed Controls */}
            <FeedControls
              sortType={sortType}
              setSortType={setSortType}
              timeFrame={timeFrame}
              setTimeFrame={setTimeFrame}
              isLoading={isLoading}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              clearSearch={clearSearch}
              filteredPostCount={postsToDisplay.length}
              showSearch={postsToDisplay.length > 0}
              density={density}
              cycleDensity={cycleDensity}
              densityLabel={densityConfig.label}
              showFavoritesOnly={showFavoritesOnly}
              setShowFavoritesOnly={setShowFavoritesOnly}
              favoritesCount={Object.keys(favorites).length}
            />
         </div>
         {/* Error Message - Improved */}
         {error && (
           <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 max-w-md mx-auto">
             <p className="text-destructive text-center text-sm font-medium mb-3">{error}</p>
             <div className="flex justify-center gap-2">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={() => triggerFetch()}
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
      </header>

      {/* Main Content Area */}
      <main className="flex-grow mt-2" role="main" aria-label="Reddit posts gallery">
        {/* Screen reader live region for status updates */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {isLoading && posts.length === 0 ? 'Loading posts...' : ''}
          {isLoading && posts.length > 0 ? 'Loading more posts...' : ''}
          {!isLoading && postsToDisplay.length > 0 ? `Showing ${postsToDisplay.length} posts` : ''}
          {!isLoading && fetchInitiated && postsToDisplay.length === 0 ? 'No posts found' : ''}
        </div>

        {/* Initial Loading Skeletons */}
        {isLoading && posts.length === 0 && !error && (
            <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex gap-1.5" columnClassName="my-masonry-grid_column">
                 {Array.from({ length: 18 }).map((_, index) => ( <Skeleton key={`skeleton-${index}`} className="h-64 w-full mb-1.5" /> ))}
            </Masonry>
        )}
        {/* No Posts Message - Improved */}
        {fetchInitiated && postsToDisplay.length === 0 && !isLoading && !error && (
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
                  onClick={() => {
                    setSubredditInput(sub);
                    setTimeout(() => triggerFetch(sub), 0);
                  }}
                  className="text-xs"
                >
                  r/{sub}
                </Button>
              ))}
            </div>
          </div>
        )}
        {/* Posts Grid */}
        {postsToDisplay.length > 0 && (
          <Masonry breakpointCols={breakpointColumnsObj} className="my-masonry-grid flex" columnClassName="my-masonry-grid_column" style={gridStyle} role="list" aria-label="Media posts">
            {postsToDisplay.map((post, index) => {
              const isLast = !showFavoritesOnly && index === postsToDisplay.length - 1;
              return (
                <PostCard
                  key={`${post.subreddit}-${post.postId}`}
                  ref={isLast ? lastPostRef : null}
                  post={post}
                  isFavorite={!!favorites[post.postId]}
                  onToggleFavorite={() => toggleFavorite(post)}
                  onClick={() => openDialog(post)}
                  gap={densityConfig.gap}
                />
              );
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
      <FullscreenDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        selectedPost={selectedPost}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onShare={handleShare}
        onDownload={handleDownload}
      />

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={resetSettings}
        resolvedTheme={resolvedTheme}
      />

      {/* Footer */}
      <footer className="mt-16 md:mt-24 text-center text-sm text-muted-foreground flex-shrink-0 pb-6">
        <p> Built with ❤️ </p>
      </footer>
    </div>
   );
}
