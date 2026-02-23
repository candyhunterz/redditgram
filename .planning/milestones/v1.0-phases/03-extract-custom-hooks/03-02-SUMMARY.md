---
phase: 03-extract-custom-hooks
plan: 02
subsystem: hooks
tags: [react, hooks, indexed-db, favorites, presets]

requires:
  - phase: 03-01
    provides: "src/types/reddit.ts shared types (FavoritePostInfo, FavoritesMap, RedditPost) and granular IDB ops (putFavorite, deleteFavorite, putPreset, deletePreset, renamePreset)"
provides:
  - src/hooks/use-scroll-to-top.ts — showScrollTop boolean + scrollToTop action
  - src/hooks/use-fullscreen-dialog.ts — selectedPost, isDialogOpen, openDialog, closeDialog
  - src/hooks/use-favorites.ts — favorites map + toggle with granular IDB persistence
  - src/hooks/use-feed-presets.ts — presets CRUD with granular IDB persistence
affects:
  - 03-03 (hook wiring into page.tsx)
  - 03-04 (any remaining hook extractions)

tech-stack:
  added: []
  patterns:
    - "ref-mirrors-state for scroll listener (empty deps array, passive listener, never re-attached)"
    - "granular IDB write inside event handler (fire-and-forget putFavorite/deleteFavorite)"
    - "handler accepts current params as arguments instead of closing over page state (handleSavePreset, handleUpdatePreset)"
    - "useCallback for all handlers to keep referential stability for downstream memoized consumers"

key-files:
  created:
    - src/hooks/use-scroll-to-top.ts
    - src/hooks/use-fullscreen-dialog.ts
    - src/hooks/use-favorites.ts
    - src/hooks/use-feed-presets.ts
  modified: []

key-decisions:
  - "use-fullscreen-dialog imports RedditPost from @/types/reddit (not @/services/reddit) to use shared barrel"
  - "toggleFavorite is async-safe: state update is synchronous via setFavorites functional form; putFavorite/deleteFavorite are fire-and-forget (errors logged inside IDB helpers)"
  - "handleSavePreset/handleUpdatePreset accept subredditInput+sortType+timeFrame as arguments — hook does not close over page state, making it testable in isolation"
  - "handleLoadPreset returns the preset and only sets activePresetName; fetchInitialPosts stays in page.tsx responsibility"
  - "window.prompt/confirm kept inside handlers — they are business logic the hook encapsulates, not UI concerns"

patterns-established:
  - "Hook output: return a flat object of state values and named handlers (not arrays)"
  - "Granular IDB write pattern: call IDB op then update React state inside setFavorites/setPresets functional update"

requirements-completed: [REQ-ARCH-03, REQ-ARCH-04, REQ-ARCH-05, REQ-ARCH-06]

duration: 1min
completed: 2026-02-22
tasks_completed: 2
files_created: 4
files_modified: 0
---

# Phase 3 Plan 02: Extract Custom Hooks Summary

**Extracted 4 focused hooks from page.tsx god component: use-scroll-to-top (ref+passive-listener), use-fullscreen-dialog (post selection state), use-favorites (granular IDB putFavorite/deleteFavorite), and use-feed-presets (granular IDB putPreset/deletePreset/renamePreset).**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-22T06:55:31Z
- **Completed:** 2026-02-22T06:56:31Z
- **Tasks:** 2
- **Files modified:** 4 created, 0 modified

## Accomplishments

- 4 new hook files in `src/hooks/` encapsulating state and handlers currently inline in page.tsx
- Favorites and presets hooks switch from O(n) clear-and-rewrite to O(1) single-record IDB operations
- All hooks import from `@/types/reddit` (the shared barrel from Plan 01)
- TypeScript 0 errors, build passes

## Task Commits

1. **Task 1: Create use-scroll-to-top and use-fullscreen-dialog hooks** - `589d8fd` (feat)
2. **Task 2: Create use-favorites and use-feed-presets hooks** - `ce6824d` (feat)

## Files Created/Modified

- `src/hooks/use-scroll-to-top.ts` — scroll position tracking with ref mirror pattern; exports `useScrollToTop`
- `src/hooks/use-fullscreen-dialog.ts` — dialog open/close and selected post state; exports `useFullscreenDialog`
- `src/hooks/use-favorites.ts` — favorites map with granular `putFavorite`/`deleteFavorite` on toggle; exports `useFavorites`
- `src/hooks/use-feed-presets.ts` — presets CRUD using `putPreset`/`deletePreset`/`renamePreset`; exports `useFeedPresets`

## Decisions Made

- `use-fullscreen-dialog` imports `RedditPost` from `@/types/reddit` (not `@/services/reddit`) to consume the shared barrel established in Plan 01.
- `toggleFavorite` uses functional form of `setFavorites` for the state update, with IDB calls as fire-and-forget side effects; errors are already logged inside the IDB helpers.
- `handleSavePreset` and `handleUpdatePreset` accept `subredditInput`, `sortType`, `timeFrame` as arguments instead of closing over page.tsx state — this makes the hook independently testable and removes hidden coupling.
- `handleLoadPreset` returns the preset to let page.tsx handle the fetch trigger; the hook only manages its own state (activePresetName).
- `window.prompt`/`window.confirm` calls are intentionally kept inside the preset handlers — they are business logic the hook owns.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All 4 hooks are ready to be wired into page.tsx in Plan 03-03. The hooks expose the same interfaces page.tsx currently uses inline, so the wiring is a mechanical substitution.

Remaining inline logic in page.tsx after this plan: fetch orchestration (performFetch, fetchInitialPosts, loadMorePosts), prefetch, search, keyboard handling, and render.

---
*Phase: 03-extract-custom-hooks*
*Completed: 2026-02-22*

## Self-Check: PASSED

| Item | Status |
|---|---|
| src/hooks/use-scroll-to-top.ts | FOUND |
| src/hooks/use-fullscreen-dialog.ts | FOUND |
| src/hooks/use-favorites.ts | FOUND |
| src/hooks/use-feed-presets.ts | FOUND |
| 03-02-SUMMARY.md | FOUND |
| Commit 589d8fd (Task 1) | FOUND |
| Commit ce6824d (Task 2) | FOUND |
