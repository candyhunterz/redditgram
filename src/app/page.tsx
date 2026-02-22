// src/app/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
// *** Standard Imports ***
import { Button } from "@/components/ui/button";
import { ArrowUp, Sun, Moon, Keyboard, Settings } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useSubredditHistory } from "@/hooks/use-subreddit-history";
import { sharePost } from "@/lib/share";
import { downloadMedia } from "@/lib/download";
import { usePostSearch } from "@/hooks/use-post-search";
import { useGridDensity } from "@/hooks/use-grid-density";
import { useSettings } from "@/hooks/use-settings";
import { SettingsModal } from "@/components/settings-modal";
import { useToast } from "@/hooks/use-toast";
import { FullscreenDialog, KeyboardShortcutsDialog } from '@/components/fullscreen-dialog';
import { SubredditSearchBar } from '@/components/subreddit-search-bar';
import { FeedControls } from '@/components/feed-controls';
import { PostGrid } from '@/components/post-grid';
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
  const { addToHistory, getSuggestions } = useSubredditHistory();

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
  const { favorites, showFavoritesOnly, setShowFavoritesOnly, toggleFavorite } = useFavorites();
  const {
    presets,
    activePresetName,
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
        result = posts;
    } else {
        result = Object.values(favorites).map((favInfo): RedditPost => {
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
  const { searchQuery, setSearchQuery, filteredPosts: postsToDisplay, clearSearch } = usePostSearch(basePosts);

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

  // --- Breakpoint Configuration for PostGrid (uses grid density) ---
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
      </header>

      {/* Post Grid (includes error display, loading states, masonry grid) */}
      <PostGrid
        posts={postsToDisplay}
        isLoading={isLoading}
        hasMore={hasMore}
        fetchInitiated={fetchInitiated}
        showFavoritesOnly={showFavoritesOnly}
        error={error}
        favorites={favorites}
        breakpointColumnsObj={breakpointColumnsObj}
        gridStyle={gridStyle}
        densityGap={densityConfig.gap}
        lastPostRef={lastPostRef}
        onToggleFavorite={toggleFavorite}
        onOpenDialog={openDialog}
        onRetry={() => triggerFetch()}
        rawPostCount={posts.length}
        onSubredditClick={(sub) => {
          setSubredditInput(sub);
          setTimeout(() => triggerFetch(sub), 0);
        }}
      />

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
