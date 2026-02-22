# Redditgram Performance Refactor Plan

## Context
`src/app/page.tsx` is a 1,467-line god component with ~25 useState hooks, all business logic, and all UI. The audit found: scroll re-render bugs, IndexedDB full-rewrite on every favorite toggle, 20 unused UI components, ~1.5MB dead dependencies, broken progressive image thumbnails, no next/image usage, and missing `<Toaster/>` mount. This plan addresses everything.

---

## Phase 1: Quick Wins (no behavior change)

### 1.1 Fix layout.tsx
- **`src/app/layout.tsx`**: Remove `'use client'` directive and unused `Metadata` import. Add `<Toaster />` import+render (fixes silent toast bug).

### 1.2 Delete unused UI components (21 files)
Delete from `src/components/ui/`:
accordion, alert-dialog, alert, avatar, badge, calendar, chart, checkbox, form, menubar, popover, progress, scroll-area, separator, sheet, sidebar, slider, switch, table, tabs, textarea, tooltip

### 1.3 Delete unused AI directory
Delete `src/ai/ai-instance.ts` and `src/ai/dev.ts`

### 1.4 Remove unused dependencies from package.json
**dependencies to remove** (26): `@genkit-ai/googleai`, `@genkit-ai/next`, `@hookform/resolvers`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-menubar`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@tanstack-query-firebase/react`, `@tanstack/react-query`, `@tanstack/react-virtual`, `date-fns`, `firebase`, `genkit`, `react-day-picker`, `react-hook-form`, `recharts`, `zod`

**devDependencies to remove**: `genkit-cli`

**scripts to remove**: `genkit:dev`, `genkit:watch`

### 1.5 Remove dead import from page.tsx
Delete `import { useFocusTrap }` (imported but never called)

### 1.6 Clean up console.logs
- Delete the 6 colored cache-debug `console.log` calls in page.tsx (lines ~658, 676, 688, 703, 764, 769)
- Delete 3 `console.log` calls in `src/app/api/reddit/route.ts` (`[AUTH_LOG]` lines)
- Fix toast message "Check console." -> "Some subreddits could not be loaded."

### 1.7 Add Cache-Control header to API response
- **`src/app/api/reddit/route.ts`**: Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to the success response

### 1.8 Fix broken progressive image thumbnail
- **`src/components/progressive-image.tsx`**: The `src.replace(/\.(jpg|...)$/i, 'm.$1')` hack doesn't work for `preview.redd.it` URLs (they have query params). Fix: only apply the `m` suffix for `i.redd.it` hosts; for `preview.redd.it`, reduce the `width` query param; otherwise fall back to the original src.

**Verify**: `npm install` (after deleting node_modules + lock), `npm run build`, `npm run test`

---

## Phase 2: Performance Bug Fixes

### 2.1 Fix scroll-to-top re-render loop
- **`src/app/page.tsx`** lines 827-838: `showScrollTop` in the useEffect deps causes listener teardown/reattach on every toggle. Fix: use a ref to track current value, empty deps array, add `{ passive: true }`.

### 2.2 Fix basePosts useMemo unnecessary spread
- **`src/app/page.tsx`** lines 481-509: Currently spreads every post object on every memo recalc. Fix: return `posts` directly when `showFavoritesOnly` is false (the `?? false` fallback already exists at the render site).

### 2.3 Add LRU cap to in-memory cache
- **Create `src/lib/lru-cache.ts`**: Simple LRU cache class (Map-based, ~30 lines) with `get/set/has/delete`, capped at 100 entries.
- **`src/app/page.tsx`**: Replace `new Map()` with `new LRUCache(100)`.

**Verify**: Scroll-to-top button still works. Posts render correctly. Extended browsing doesn't grow memory unboundedly.

---

## Phase 3: Extract Custom Hooks

### 3.1 Create shared types file
- **Create `src/types/reddit.ts`**: Move from page.tsx: `CachedRedditResponse`, `CacheKey`, `FavoritePostInfo`, `FavoritesMap` types + pure helpers `isValidSubreddit`, `parseSubreddits`, `interleavePosts`, `generateCacheKey`, `POSTS_PER_LOAD`.

### 3.2 Add granular IndexedDB operations
- **`src/lib/indexed-db.ts`**: Add `putFavorite(postId, data)`, `deleteFavorite(postId)`, `putPreset(preset)`, `deletePreset(name)`, `renamePreset(oldName, newName)` -- single-record operations instead of clear+rewrite-all.

### 3.3 Create `src/hooks/use-reddit-posts.ts`
Encapsulates: `posts`, `isLoading`, `afterTokens`, `hasMore`, `fetchInitiated`, `error`, `sortType`, `timeFrame`, the in-memory LRU cache, `performFetch`, `fetchInitialPosts`, `loadMorePosts`, `lastPostRef` (IntersectionObserver), and the `usePrefetch` integration.

Returns: `{ posts, isLoading, hasMore, fetchInitiated, error, sortType, setSortType, timeFrame, setTimeFrame, fetchInitialPosts, loadMorePosts, lastPostRef }`

### 3.4 Create `src/hooks/use-favorites.ts`
Encapsulates: `favorites`, `showFavoritesOnly`, `favoritesLoadComplete`. Uses granular `putFavorite`/`deleteFavorite` instead of `saveAllFavorites`.

Returns: `{ favorites, showFavoritesOnly, setShowFavoritesOnly, toggleFavorite, favoritesLoadComplete }`

### 3.5 Create `src/hooks/use-feed-presets.ts`
Encapsulates: `presets`, `activePresetName`, `initialLoadComplete`. Uses granular `putPreset`/`deletePreset`/`renamePreset`.

Returns: `{ presets, activePresetName, setActivePresetName, savePreset, updatePreset, deletePreset, renamePreset }`

### 3.6 Create `src/hooks/use-scroll-to-top.ts`
Encapsulates: `showScrollTop` state + ref-based scroll listener (from Phase 2.1 fix) + `scrollToTop` function. ~20 lines.

### 3.7 Create `src/hooks/use-fullscreen-dialog.ts`
Encapsulates: `selectedPost`, `isDialogOpen`, `openDialog`, `closeDialog`. ~20 lines.

**Verify**: `npm run build`, `npm run test`. All existing functionality works identically -- favorites persist, presets persist, fetching/pagination works, dialogs open/close.

---

## Phase 4: Extract Components

### 4.1 `src/components/media-carousel.tsx`
Move the existing `MediaCarousel` component (page.tsx lines 94-405) to its own file. Pure move, no logic changes. Already `React.memo`'d.

### 4.2 `src/components/post-card.tsx`
Extract per-post card (page.tsx lines 1268-1334). Uses `React.forwardRef` for IntersectionObserver ref. Renders: Card + indicators + metadata overlay + MediaCarousel(grid mode).

### 4.3 `src/components/post-grid.tsx`
Extract Masonry grid + skeleton loading + empty state + loading indicator (page.tsx lines 1229-1347). Contains PostCard instances.

### 4.4 `src/components/subreddit-search-bar.tsx`
Extract Input + suggestions dropdown + popular chips + fetch button (page.tsx lines 1009-1090).

### 4.5 `src/components/feed-controls.tsx`
Extract Collapsible controls: sort/timeframe, post search, grid density, favorites toggle (page.tsx lines 1105-1190).

### 4.6 `src/components/fullscreen-dialog.tsx`
Extract fullscreen Dialog + KeyboardShortcutsDialog (page.tsx lines 1362-1450). Exports both as named exports.

### 4.7 Slim `src/app/page.tsx` to ~150 lines
Page becomes a pure orchestrator: hooks at top, ~6 local state vars (`subredditInput`, `suggestions`, `showSuggestions`, `isControlsOpen`, `showKeyboardShortcuts`, `showSettings`), event handler wiring, JSX composition of extracted components.

**Verify**: Full manual test -- fetch, scroll, fullscreen, favorites, presets, sort/filter, search, density, theme, settings, keyboard shortcuts, mobile swipe, download, share.

---

## Phase 5: next/image Integration

### 5.1 Configure remotePatterns
- **`next.config.ts`**: Add `images.remotePatterns` for `i.redd.it`, `preview.redd.it`, `external-preview.redd.it`, `i.imgur.com`, `v.redd.it`.

### 5.2 Update ProgressiveImage
- **`src/components/progressive-image.tsx`**: Replace `<img>` with `next/image` `<Image>` using `fill` layout + `sizes` prop. Remove the custom thumbnail hack (next/image handles responsive sizing). Add a tiny SVG `blurDataURL` placeholder. Keep `ProgressiveVideo` unchanged (next/image doesn't handle video).

**Verify**: Images load as WebP at appropriate sizes. Network tab shows optimized requests. Fullscreen loads full-quality images. Lazy loading works below the fold.

---

## Files Summary

**Create (14)**:
`src/types/reddit.ts`, `src/lib/lru-cache.ts`, `src/hooks/use-reddit-posts.ts`, `src/hooks/use-favorites.ts`, `src/hooks/use-feed-presets.ts`, `src/hooks/use-scroll-to-top.ts`, `src/hooks/use-fullscreen-dialog.ts`, `src/components/media-carousel.tsx`, `src/components/post-card.tsx`, `src/components/post-grid.tsx`, `src/components/subreddit-search-bar.tsx`, `src/components/feed-controls.tsx`, `src/components/fullscreen-dialog.tsx`

**Modify (7)**:
`src/app/page.tsx` (slim to ~150 lines), `src/app/layout.tsx`, `src/lib/indexed-db.ts`, `src/components/progressive-image.tsx`, `src/app/api/reddit/route.ts`, `package.json`, `next.config.ts`

**Delete (23)**:
21 unused UI components, 2 AI files (`src/ai/*`)
