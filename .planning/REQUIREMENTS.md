# REQUIREMENTS

## Categories

- **CLEAN** — Dead code removal
- **BUGFIX** — Fix known bugs
- **PERF** — Performance improvements
- **ARCH** — Architecture extraction
- **IMAGE** — next/image integration
- **TEST** — Key tests for extracted logic

---

## CLEAN: Dead Code Removal

### REQ-CLEAN-01: Delete unused UI components [COMPLETE - 01-01]
Delete 21 unused shadcn/ui components from `src/components/ui/`: accordion, alert-dialog, alert, avatar, badge, calendar, chart, checkbox, form, menubar, popover, progress, scroll-area, separator, sheet, sidebar, slider, switch, table, tabs, textarea, tooltip.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.2
- **Acceptance**: Files deleted, no import errors, build passes

### REQ-CLEAN-02: Delete unused AI directory [COMPLETE - 01-01]
Delete `src/ai/ai-instance.ts` and `src/ai/dev.ts`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.3
- **Acceptance**: Directory removed, no import errors

### REQ-CLEAN-03: Remove unused npm dependencies [COMPLETE - 01-01]
Remove 26 dependencies and 1 devDependency from `package.json`: `@genkit-ai/googleai`, `@genkit-ai/next`, `@hookform/resolvers`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-menubar`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@tanstack-query-firebase/react`, `@tanstack/react-query`, `@tanstack/react-virtual`, `date-fns`, `firebase`, `genkit`, `react-day-picker`, `react-hook-form`, `recharts`, `zod`. DevDep: `genkit-cli`. Scripts: `genkit:dev`, `genkit:watch`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.4
- **Acceptance**: `npm install` succeeds, `npm run build` passes, bundle size reduced

### REQ-CLEAN-04: Remove dead import from page.tsx [COMPLETE - 01-02]
Delete `import { useFocusTrap }` (imported but never called).
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.5
- **Acceptance**: Import removed, build passes

### REQ-CLEAN-05: Clean up console.logs [COMPLETE - 01-02]
Delete 6 colored cache-debug `console.log` calls in page.tsx. Delete 3 `[AUTH_LOG]` console.log calls in `src/app/api/reddit/route.ts`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.6
- **Acceptance**: No debug console.logs remain in production code

---

## BUGFIX: Fix Known Bugs

### REQ-BUGFIX-01: Fix missing Toaster mount [COMPLETE - 01-02]
In `src/app/layout.tsx`: remove `'use client'` directive and unused `Metadata` import. Add `<Toaster />` import and render.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.1
- **Acceptance**: Toast notifications visible to user on favorite toggle, preset save, etc.

### REQ-BUGFIX-02: Fix broken progressive image thumbnail [COMPLETE - 01-02]
In `src/components/progressive-image.tsx`: fix URL manipulation to handle `preview.redd.it` URLs with query params. Only apply `m` suffix for `i.redd.it`; for `preview.redd.it` reduce `width` query param; otherwise fallback to original src.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.8
- **Acceptance**: Blur placeholders load correctly for all Reddit image hosts

### REQ-BUGFIX-03: Fix confusing error toast message [COMPLETE - 01-02]
Change "Check console." toast to "Some subreddits could not be loaded."
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.6
- **Acceptance**: User-facing error messages are actionable

### REQ-BUGFIX-04: Fix scroll-to-top re-render loop [COMPLETE - 02-02]
In page.tsx: remove `showScrollTop` from useEffect deps, use a ref to track current value, empty deps array, add `{ passive: true }`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §2.1
- **Acceptance**: Scroll listener not re-attached on every toggle, passive listening enabled

### REQ-BUGFIX-05: Fix basePosts useMemo unnecessary spread [COMPLETE - 02-02]
Return `posts` directly when `showFavoritesOnly` is false instead of spreading every post object.
- **Source**: PERFORMANCE_REFACTOR_PLAN §2.2
- **Acceptance**: No unnecessary object allocations when viewing normal feed

---

## PERF: Performance Improvements

### REQ-PERF-01: Add LRU cap to in-memory cache [COMPLETE - 02-01, 02-02]
Create `src/lib/lru-cache.ts` (~30 lines, Map-based). Replace unbounded `new Map()` in page.tsx with `new LRUCache(100)`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §2.3
- **Acceptance**: Cache capped at 100 entries, LRU eviction works, extended browsing doesn't grow memory unboundedly

### REQ-PERF-02: Add granular IndexedDB operations [COMPLETE - 03-01]
In `src/lib/indexed-db.ts`: add `putFavorite(postId, data)`, `deleteFavorite(postId)`, `putPreset(preset)`, `deletePreset(name)`, `renamePreset(oldName, newName)` — single-record ops instead of clear+rewrite-all.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.2
- **Acceptance**: Favorite toggle is O(1) instead of O(n), preset operations are granular

### REQ-PERF-03: Add Cache-Control header to API response [COMPLETE - 01-02]
In `src/app/api/reddit/route.ts`: add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to success response.
- **Source**: PERFORMANCE_REFACTOR_PLAN §1.7
- **Acceptance**: Response includes Cache-Control header, verified in network tab

---

## ARCH: Architecture Extraction

### REQ-ARCH-01: Create shared types file [COMPLETE - 03-01]
Create `src/types/reddit.ts` with types and pure helpers moved from page.tsx: `CachedRedditResponse`, `CacheKey`, `FavoritePostInfo`, `FavoritesMap`, `isValidSubreddit`, `parseSubreddits`, `interleavePosts`, `generateCacheKey`, `POSTS_PER_LOAD`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.1
- **Acceptance**: Types importable from `@/types/reddit`, page.tsx imports from new location

### REQ-ARCH-02: Extract use-reddit-posts hook [COMPLETE - 03-03]
Create `src/hooks/use-reddit-posts.ts` encapsulating: posts, isLoading, afterTokens, hasMore, fetchInitiated, error, sortType, timeFrame, LRU cache, performFetch, fetchInitialPosts, loadMorePosts, lastPostRef (IntersectionObserver), usePrefetch integration.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.3
- **Acceptance**: Hook returns documented interface, page.tsx consumes hook instead of inline state

### REQ-ARCH-03: Extract use-favorites hook
Create `src/hooks/use-favorites.ts` encapsulating: favorites, showFavoritesOnly, favoritesLoadComplete. Uses granular putFavorite/deleteFavorite.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.4
- **Acceptance**: Hook returns documented interface, favorites persist correctly

### REQ-ARCH-04: Extract use-feed-presets hook
Create `src/hooks/use-feed-presets.ts` encapsulating: presets, activePresetName, initialLoadComplete. Uses granular putPreset/deletePreset/renamePreset.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.5
- **Acceptance**: Hook returns documented interface, presets persist correctly

### REQ-ARCH-05: Extract use-scroll-to-top hook
Create `src/hooks/use-scroll-to-top.ts` encapsulating: showScrollTop state + ref-based scroll listener + scrollToTop function (~20 lines).
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.6
- **Acceptance**: Scroll-to-top button works identically

### REQ-ARCH-06: Extract use-fullscreen-dialog hook
Create `src/hooks/use-fullscreen-dialog.ts` encapsulating: selectedPost, isDialogOpen, openDialog, closeDialog (~20 lines).
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.7
- **Acceptance**: Fullscreen dialog opens/closes identically

### REQ-ARCH-07: Extract MediaCarousel component
Move MediaCarousel (page.tsx lines 94-405) to `src/components/media-carousel.tsx`. Pure move, no logic changes.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.1
- **Acceptance**: Component works identically from new file

### REQ-ARCH-08: Extract PostCard component
Extract per-post card to `src/components/post-card.tsx` with React.forwardRef for IntersectionObserver.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.2
- **Acceptance**: Cards render identically, ref forwarding works for infinite scroll

### REQ-ARCH-09: Extract PostGrid component
Extract masonry grid + skeleton loading + empty state to `src/components/post-grid.tsx`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.3
- **Acceptance**: Grid renders identically with all states

### REQ-ARCH-10: Extract SubredditSearchBar component
Extract input + suggestions + popular chips + fetch button to `src/components/subreddit-search-bar.tsx`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.4
- **Acceptance**: Search, suggestions, and fetch work identically

### REQ-ARCH-11: Extract FeedControls component
Extract collapsible controls (sort/timeframe, post search, grid density, favorites toggle) to `src/components/feed-controls.tsx`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.5
- **Acceptance**: All controls work identically

### REQ-ARCH-12: Extract FullscreenDialog component
Extract fullscreen dialog + keyboard shortcuts dialog to `src/components/fullscreen-dialog.tsx`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.6
- **Acceptance**: Dialog and shortcuts work identically

### REQ-ARCH-13: Slim page.tsx to ~150 lines
Page becomes pure orchestrator: hooks at top, ~6 local state vars, event handler wiring, JSX composition.
- **Source**: PERFORMANCE_REFACTOR_PLAN §4.7
- **Acceptance**: page.tsx ≤ 200 lines, all functionality preserved

---

## IMAGE: next/image Integration

### REQ-IMAGE-01: Configure remotePatterns
In `next.config.ts`: add `images.remotePatterns` for `i.redd.it`, `preview.redd.it`, `external-preview.redd.it`, `i.imgur.com`, `v.redd.it`.
- **Source**: PERFORMANCE_REFACTOR_PLAN §5.1
- **Acceptance**: next/image can load from all Reddit CDN domains

### REQ-IMAGE-02: Update ProgressiveImage to use next/image
Replace `<img>` with `<Image>` using `fill` layout + `sizes` prop. Add tiny SVG blurDataURL placeholder. Keep ProgressiveVideo unchanged.
- **Source**: PERFORMANCE_REFACTOR_PLAN §5.2
- **Acceptance**: Images load as WebP at appropriate sizes, lazy loading works, fullscreen loads full quality

---

## TEST: Key Tests

### REQ-TEST-01: LRU cache tests [COMPLETE - 02-01]
Test `src/lib/lru-cache.ts`: get/set/has/delete, eviction at capacity, LRU ordering.
- **Source**: PERFORMANCE_REFACTOR_PLAN §2.3
- **Acceptance**: Tests pass, cover core LRU behavior

### REQ-TEST-02: Granular IndexedDB operation tests [COMPLETE - 03-01]
Test putFavorite, deleteFavorite, putPreset, deletePreset, renamePreset.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.2
- **Acceptance**: Tests pass, cover single-record CRUD

### REQ-TEST-03: Extracted hook tests
Tests for use-reddit-posts, use-favorites, use-feed-presets core logic.
- **Source**: PERFORMANCE_REFACTOR_PLAN §3.3-3.5
- **Acceptance**: Tests pass, cover key state transitions

---

## Traceability Matrix

| Requirement | Phase |
|---|---|
| REQ-CLEAN-01..05 | Phase 1 |
| REQ-BUGFIX-01..03 | Phase 1 |
| REQ-BUGFIX-04..05 | Phase 2 |
| REQ-PERF-01 | Phase 2 |
| REQ-PERF-02 | Phase 3 |
| REQ-PERF-03 | Phase 1 |
| REQ-ARCH-01..06 | Phase 3 |
| REQ-ARCH-07..13 | Phase 4 |
| REQ-IMAGE-01..02 | Phase 5 |
| REQ-TEST-01 | Phase 2 |
| REQ-TEST-02..03 | Phase 3 |
