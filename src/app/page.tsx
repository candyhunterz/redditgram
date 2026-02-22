// src/app/page.tsx
"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
// *** Standard Imports ***
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { X, Video, Copy as GalleryIcon, Filter, Loader2, ArrowUp, Heart, Sun, Moon, ArrowUpCircle, MessageCircle, Share2, Download, TrendingUp, HelpCircle, Keyboard, Search, Grid3X3, LayoutGrid, Grid2X2, Settings } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useSubredditHistory, POPULAR_SUBREDDITS } from "@/hooks/use-subreddit-history";
import { formatRelativeTime, formatNumber } from "@/lib/format-time";
import { sharePost } from "@/lib/share";
import { downloadMedia } from "@/lib/download";
import { usePostSearch } from "@/hooks/use-post-search";
import { useGridDensity, DENSITY_CONFIG } from "@/hooks/use-grid-density";
import { useSettings } from "@/hooks/use-settings";
import { SettingsModal } from "@/components/settings-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FullscreenDialog, KeyboardShortcutsDialog } from '@/components/fullscreen-dialog';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Masonry from 'react-masonry-css';
import { MediaCarousel } from '@/components/media-carousel';
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
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
    setShowSuggestions(false);
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
    setShowSuggestions(false);
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
            {/* Input and Fetch Button */}
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
                 <div className="relative flex-grow">
                   <Input
                      type="text" aria-label="Enter subreddit names separated by commas"
                      placeholder="Enter subreddits..." value={subredditInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSubredditInput(value);
                        // Get the last word being typed for suggestions
                        const parts = value.split(',');
                        const lastPart = parts[parts.length - 1].trim();
                        if (lastPart.length >= 2) {
                          const matches = getSuggestions(lastPart);
                          setSuggestions(matches.slice(0, 5));
                          setShowSuggestions(matches.length > 0);
                        } else {
                          setShowSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        const parts = subredditInput.split(',');
                        const lastPart = parts[parts.length - 1].trim();
                        if (lastPart.length >= 2) {
                          const matches = getSuggestions(lastPart);
                          setSuggestions(matches.slice(0, 5));
                          setShowSuggestions(matches.length > 0);
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding to allow click on suggestion
                        setTimeout(() => setShowSuggestions(false), 150);
                      }}
                      className="flex-grow text-base w-full"
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) triggerFetch(); }}
                   />
                   {/* Suggestions Dropdown */}
                   {showSuggestions && suggestions.length > 0 && (
                     <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg">
                       {suggestions.map((suggestion) => (
                         <button
                           key={suggestion}
                           className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                           onMouseDown={(e) => {
                             e.preventDefault();
                             // Replace the last part with the suggestion
                             const parts = subredditInput.split(',');
                             parts[parts.length - 1] = ' ' + suggestion;
                             setSubredditInput(parts.join(',').replace(/^,\s*/, '').trim());
                             setShowSuggestions(false);
                           }}
                         >
                           r/{suggestion}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
                 <Button onClick={() => triggerFetch()} disabled={isLoading} className="w-full sm:w-auto flex-shrink-0 active:scale-95 transition-transform">
                     {isLoading && posts.length === 0 ? "Fetching..." : "Fetch"}
                 </Button>
             </div>
             {/* Popular Subreddits */}
             <div className="flex flex-wrap justify-center gap-1.5">
               <span className="flex items-center text-xs text-muted-foreground mr-1">
                 <TrendingUp className="h-3 w-3 mr-1" />
                 Popular:
               </span>
               {POPULAR_SUBREDDITS.slice(0, 6).map((sub) => (
                 <Button
                   key={sub}
                   variant="ghost"
                   size="sm"
                   className="h-6 px-2 text-xs hover:bg-accent"
                   onClick={() => {
                     setSubredditInput(sub);
                     setTimeout(() => triggerFetch(sub), 0);
                   }}
                 >
                   r/{sub}
                 </Button>
               ))}
             </div>
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
             {/* Collapsible Controls */}
            <Collapsible open={isControlsOpen} onOpenChange={setIsControlsOpen}>
                 <div className="flex justify-center mb-2">
                     <CollapsibleTrigger asChild>
                         <Button variant="ghost" size="sm" className="text-sm text-muted-foreground hover:text-foreground active:scale-95 transition-transform">
                            <Filter className="h-4 w-4 mr-1" /> {isControlsOpen ? "Hide Options" : "Show Options"}
                         </Button>
                     </CollapsibleTrigger>
                 </div>
                <CollapsibleContent className="space-y-3 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                    {/* Sort/Timeframe Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center justify-center pt-2">
                        <RadioGroup defaultValue="hot" className="flex gap-4" value={sortType} onValueChange={(value) => { if(!isLoading) setSortType(value as SortType)}} aria-label="Sort posts by" >
                            <Label htmlFor="sort-hot" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="hot" id="sort-hot" disabled={isLoading}/> <span>Hot</span> </Label>
                            <Label htmlFor="sort-top" className={cn("flex items-center space-x-2 p-1 rounded", isLoading ? "text-muted-foreground cursor-not-allowed" : "cursor-pointer hover:bg-accent")}> <RadioGroupItem value="top" id="sort-top" disabled={isLoading}/> <span>Top</span> </Label>
                        </RadioGroup>
                        {sortType === 'top' && ( <Select value={timeFrame} onValueChange={(value) => {if(!isLoading) setTimeFrame(value as TimeFrame)}} disabled={isLoading} > <SelectTrigger className="w-[180px]" aria-label="Time frame"> <SelectValue placeholder="Time frame" /> </SelectTrigger> <SelectContent> <SelectItem value="day">Today</SelectItem> <SelectItem value="week">This Week</SelectItem> <SelectItem value="month">This Month</SelectItem> <SelectItem value="year">This Year</SelectItem> <SelectItem value="all">All Time</SelectItem> </SelectContent> </Select> )}
                    </div>
                    {/* Search Posts */}
                    {postsToDisplay.length > 0 && (
                      <div className="relative pt-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search loaded posts..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 text-sm"
                            />
                            {searchQuery && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                                onClick={clearSearch}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {searchQuery && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Found {postsToDisplay.length} matching posts
                          </p>
                        )}
                      </div>
                    )}
                    {/* Grid Density and Favorites Toggles */}
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-sm active:scale-95 transition-transform"
                            onClick={cycleDensity}
                            title={`Grid: ${densityConfig.label}`}
                        >
                            {density === 'compact' ? (
                              <Grid3X3 className="h-4 w-4 mr-2" />
                            ) : density === 'comfortable' ? (
                              <LayoutGrid className="h-4 w-4 mr-2" />
                            ) : (
                              <Grid2X2 className="h-4 w-4 mr-2" />
                            )}
                            {densityConfig.label}
                        </Button>
                        <Button
                            variant={showFavoritesOnly ? "default" : "outline"}
                            size="sm"
                            className={cn(
                                "text-sm active:scale-95 transition-transform",
                                showFavoritesOnly && "bg-pink-600 hover:bg-pink-700"
                            )}
                            onClick={() => setShowFavoritesOnly(prev => !prev)}
                            disabled={isLoading || Object.keys(favorites).length === 0}
                        >
                            <Heart className={cn(
                                "h-4 w-4 mr-2",
                                showFavoritesOnly && "fill-current"
                            )} />
                            {showFavoritesOnly ? "Showing" : "Show"} Favorites ({Object.keys(favorites).length})
                        </Button>
                    </div>
                </CollapsibleContent>
            </Collapsible>
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
                const firstUrl=post?.mediaUrls?.[0];
                const isVideoPost=firstUrl&&firstUrl.endsWith('.mp4');
                const isGalleryPost=post?.mediaUrls?.length>1;
                const isUnplayable = post.isUnplayableVideoFormat ?? false;
                const mediaType = isVideoPost ? 'video' : isGalleryPost ? 'gallery' : 'image';
                return (
                <div key={`${post.subreddit}-${post.postId}`}
                     ref={!showFavoritesOnly && postsToDisplay[postsToDisplay.length-1]===post ? lastPostRef : null}
                     className="mb-1.5" style={{ marginBottom: `${densityConfig.gap}px` }}
                     role="listitem">
                 <Card onClick={()=> !isUnplayable && openDialog(post)}
                       onKeyDown={(e) => {
                         if (!isUnplayable && (e.key === 'Enter' || e.key === ' ')) {
                           e.preventDefault();
                           openDialog(post);
                         }
                       }}
                       tabIndex={isUnplayable ? -1 : 0}
                       role="button"
                       aria-label={`${post.title} - ${mediaType} from r/${post.subreddit}${post.ups ? `, ${formatNumber(post.ups)} upvotes` : ''}${favorites[post.postId] ? ', favorited' : ''}`}
                       className={cn(
                            "group relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                            !isUnplayable && "hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer",
                            isUnplayable && "cursor-default"
                       )}>
                     {/* Indicators */}
                     {(isVideoPost || isGalleryPost || isUnplayable) && (
                        <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100">
                            {isUnplayable ? <Video className="h-3 w-3 opacity-70"/> :
                             isVideoPost ? <Video className="h-3 w-3"/> :
                             <GalleryIcon className="h-3 w-3"/>}
                        </div>
                     )}
                     {/* Metadata Overlay */}
                     <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                       <div className="flex items-center justify-between text-white text-xs">
                         <div className="flex items-center gap-2">
                           <span className="flex items-center gap-0.5" title="Upvotes">
                             <ArrowUpCircle className="h-3 w-3" />
                             {formatNumber(post.ups ?? 0)}
                           </span>
                           <span className="flex items-center gap-0.5" title="Comments">
                             <MessageCircle className="h-3 w-3" />
                             {formatNumber(post.numComments ?? 0)}
                           </span>
                         </div>
                         {post.createdUtc && (
                           <span className="text-white/80" title={new Date((post.createdUtc ?? 0) * 1000).toLocaleString()}>
                             {formatRelativeTime(post.createdUtc)}
                           </span>
                         )}
                       </div>
                     </div>
                     {/* Grid Item Media Carousel */}
                     <MediaCarousel
                        mediaUrls={post.mediaUrls}
                        fullQualityUrls={post.fullQualityUrls}
                        title={post.title}
                        subreddit={post.subreddit}
                        postId={post.postId}
                        isUnplayableVideoFormat={isUnplayable}
                        onToggleFavorite={() => toggleFavorite(post)}
                        isFavorite={!!favorites[post.postId]}
                     />
                 </Card>
                </div>);
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
