---
phase: 03-extract-custom-hooks
plan: 03
subsystem: hooks
tags: [react, hooks, fetch, cache, pagination, indexed-db, lru, infinite-scroll, prefetch]
dependency_graph:
  requires:
    - phase: 03-01
      provides: "src/types/reddit.ts (RedditPost, SortType, TimeFrame, CachedRedditResponse, CacheKey, POSTS_PER_LOAD, isValidSubreddit, parseSubreddits, interleavePosts, generateCacheKey)"
    - phase: 03-02
      provides: "useScrollToTop, useFullscreenDialog, useFavorites, useFeedPresets hooks"
  provides:
    - src/hooks/use-reddit-posts.ts — post fetching, three-tier caching, pagination, infinite scroll, prefetch
    - src/app/page.tsx — slim orchestrator consuming all 5 hooks
  affects:
    - 03-04 (any remaining extractions or Phase 4 component work)
tech_stack:
  added: []
  patterns:
    - "useRef(new LRUCache(100)).current — single instance across renders, no re-creation"
    - "loadMorePostsRef sync pattern — ref always holds latest closure so IntersectionObserver never captures stale version"
    - "Promise.allSettled per-subreddit error isolation with partial-failure toast"
    - "Three-tier caching: LRU (100 entries) -> IndexedDB -> network"
    - "Thin wrapper pattern — onLoadPreset/onSavePreset/onUpdatePreset in page.tsx coordinate hook output with page-level state"
    - "triggerFetch wrapper — resets UI state (showFavoritesOnly, showSuggestions) then delegates to hook's fetchInitialPosts"
key_files:
  created:
    - src/hooks/use-reddit-posts.ts
  modified:
    - src/app/page.tsx
decisions:
  - "fetchInitialPosts does NOT reset showFavoritesOnly/showSuggestions — page.tsx triggerFetch wrapper owns those resets so hook stays pure"
  - "addToHistory passed as option argument (not closure) — hook does not close over page-level state, consistent with handleSavePreset/handleUpdatePreset pattern from 03-02"
  - "showFavoritesOnly passed as option to hook for IntersectionObserver skip logic — hook needs this flag but does not own it"
  - "onLoadPreset thin wrapper in page.tsx calls handleLoadPreset (sets activePresetName) then updates subredditInput/sortType/timeFrame and calls fetchInitialPosts — consistent with 03-02 decision that handleLoadPreset returns preset and fetch stays in page"
  - "basePosts useMemo kept in page.tsx — it orchestrates posts (from hook) + favorites (from hook) + showFavoritesOnly (from hook) — pure page-level orchestration, not extractable to a single hook without coupling them"
metrics:
  duration: 4 min
  completed: 2026-02-22
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 3 Plan 03: Extract useRedditPosts and Rewire page.tsx Summary

**One-liner:** Extracted all post fetching/caching/pagination into `useRedditPosts` (3-tier LRU+IDB+network, Promise.allSettled, IntersectionObserver, usePrefetch) and rewired page.tsx to consume all 5 custom hooks — removing 410+ lines of inline state, effects, and business logic.

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-22T22:39:25Z
- **Completed:** 2026-02-22T22:43:00Z
- **Tasks:** 2
- **Files modified:** 1 created, 1 modified

## Accomplishments

- `use-reddit-posts.ts` (333 lines) encapsulates all fetch/cache/pagination logic that was inline in page.tsx
- page.tsx shrank from 1467 lines to ~860 lines — 410+ lines of inline logic removed (531 deleted, 121 added net)
- All 5 hooks wired: `useScrollToTop`, `useFullscreenDialog`, `useFavorites`, `useFeedPresets`, `useRedditPosts`
- All inline type definitions removed from page.tsx (CachedRedditResponse, CacheKey, FavoritePostInfo, FavoritesMap)
- All inline helper functions removed from page.tsx (isValidSubreddit, parseSubreddits, interleavePosts, generateCacheKey)
- Three-tier caching preserved: LRU(100) memory -> IndexedDB -> network
- Infinite scroll (IntersectionObserver) preserved via `lastPostRef` callback ref
- Prefetch at 80% scroll preserved via `usePrefetch` integration in hook
- TypeScript 0 errors, build passes, 115/115 tests pass

## Task Commits

1. **Task 1: Extract useRedditPosts hook** - `dac53ce` (feat)
2. **Task 2: Rewire page.tsx to consume all 5 hooks** - `9c83caa` (feat)

## Files Created/Modified

- `src/hooks/use-reddit-posts.ts` — All fetch/cache/pagination logic; exports `useRedditPosts`
- `src/app/page.tsx` — Slim orchestrator; calls all 5 hooks; contains `basePosts` useMemo and thin wrappers

## Decisions Made

- `fetchInitialPosts` in the hook does NOT reset `showFavoritesOnly` or `showSuggestions` — those are page-level UI state that a pure data hook should not own. A `triggerFetch` wrapper in page.tsx handles those resets before delegating.
- `addToHistory` is passed as an option argument (not a closure) — consistent with the pattern established in 03-02 where hook handlers accept their dependencies as arguments rather than closing over page state.
- `showFavoritesOnly` is passed as a hook option so the IntersectionObserver can skip observation during favorites view — the hook needs this flag but does not own the state.
- `onLoadPreset` is a thin wrapper in page.tsx that calls `handleLoadPreset` (sets `activePresetName` in the hook), then updates `subredditInput`/`sortType`/`timeFrame`, then calls `fetchInitialPosts` — consistent with the 03-02 decision that `handleLoadPreset` returns the preset and fetch responsibility stays in page.tsx.
- `basePosts` useMemo stays in page.tsx — it reads from both `posts` (from useRedditPosts) and `favorites`/`showFavoritesOnly` (from useFavorites), making it page-level orchestration that cannot be cleanly moved to either hook.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Phase 3 Completion Status

After this plan, Phase 3 has completed its primary objective:
- Plan 01: Shared types + granular IDB ops (foundation)
- Plan 02: 4 focused hooks extracted (useScrollToTop, useFullscreenDialog, useFavorites, useFeedPresets)
- Plan 03: useRedditPosts extracted + page.tsx fully rewired (5 hooks consumed)
- Plan 04: TBD (any remaining extractions)

---
*Phase: 03-extract-custom-hooks*
*Completed: 2026-02-22*

## Self-Check: PASSED

| Item | Status |
|---|---|
| src/hooks/use-reddit-posts.ts | FOUND |
| src/app/page.tsx (updated) | FOUND |
| 03-03-SUMMARY.md | FOUND |
| Commit dac53ce (Task 1) | FOUND |
| Commit 9c83caa (Task 2) | FOUND |
| npx tsc --noEmit | PASSED |
| npm run build | PASSED |
| npm test (115/115) | PASSED |
| All 5 hooks called in page.tsx | VERIFIED |
| No inline type definitions in page.tsx | VERIFIED |
