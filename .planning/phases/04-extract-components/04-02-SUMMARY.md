---
phase: 04-extract-components
plan: 02
subsystem: ui
tags: [react, components, refactor, next-js, forwardRef]

# Dependency graph
requires:
  - phase: 04-extract-components
    plan: 01
    provides: MediaCarousel component consumed by PostCard

provides:
  - SubredditSearchBar standalone component with own suggestions state
  - FeedControls standalone component with own collapsed state
  - PostCard standalone component with forwardRef for IntersectionObserver

affects:
  - 04-extract-components (plan 03 for remaining extractions)
  - src/app/page.tsx (further reduced)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - forwardRef pattern for IntersectionObserver ref forwarding to child component
    - Component extraction: move local state into child component, pass remaining data as props

key-files:
  created:
    - src/components/subreddit-search-bar.tsx
    - src/components/feed-controls.tsx
    - src/components/post-card.tsx
  modified:
    - src/app/page.tsx

key-decisions:
  - "SubredditSearchBar owns suggestions and showSuggestions state — removes two state vars from page.tsx"
  - "FeedControls owns isControlsOpen state — removes one state var from page.tsx"
  - "PostCard uses React.forwardRef so IntersectionObserver lastPostRef can be forwarded from page.tsx"
  - "PostCard derives isVideoPost/isGalleryPost/isUnplayable/mediaType internally from post prop — no derived props"
  - "gap prop passed to PostCard for bottom margin (marginBottom style) rather than className to support dynamic values"

requirements-completed:
  - REQ-ARCH-08
  - REQ-ARCH-10
  - REQ-ARCH-11

# Metrics
duration: 4min
completed: 2026-02-22
---

# Phase 04 Plan 02: Extract SubredditSearchBar, FeedControls, PostCard Summary

**SubredditSearchBar, FeedControls, and PostCard extracted from page.tsx into standalone component files, reducing page.tsx from 663 to 446 lines (~217 line reduction, ~33%)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-02-22T23:40:55Z
- **Completed:** 2026-02-22T23:44:55Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- Created `src/components/subreddit-search-bar.tsx` (125 lines) with own suggestions/showSuggestions state, input, suggestions dropdown, fetch button, and popular subreddits chips
- Created `src/components/feed-controls.tsx` (193 lines) with own isControlsOpen state, sort radio group, timeframe select, post search input, grid density toggle, and favorites toggle
- Created `src/components/post-card.tsx` (107 lines) with React.forwardRef for IntersectionObserver, media indicators, metadata overlay, and MediaCarousel
- Reduced page.tsx from 663 to 446 lines (~217 line reduction, ~33%)
- Build passes, all 138 tests pass, TypeScript type-check passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract SubredditSearchBar and FeedControls** - `c9dd02b` (feat)
2. **Task 2: Extract PostCard** - `a786e3f` (feat)

## Files Created/Modified
- `src/components/subreddit-search-bar.tsx` - SubredditSearchBar with own suggestion state, input handlers, popular chips
- `src/components/feed-controls.tsx` - FeedControls with own collapsed state, sort/timeframe/search/density/favorites controls
- `src/components/post-card.tsx` - PostCard with forwardRef, media indicators, metadata overlay, MediaCarousel rendering
- `src/app/page.tsx` - Removed inline JSX blocks; added imports; removed unused icons, Card, formatRelativeTime, formatNumber, MediaCarousel, Input, DENSITY_CONFIG, POPULAR_SUBREDDITS imports

## Decisions Made
- SubredditSearchBar owns its own `suggestions` and `showSuggestions` state — moves two state variables out of page.tsx
- FeedControls owns its own `isControlsOpen` state — moves one state variable out of page.tsx
- PostCard uses `React.forwardRef<HTMLDivElement, PostCardProps>` so `lastPostRef` from `useRedditPosts` can be forwarded to the outer div
- PostCard derives `isVideoPost`, `isGalleryPost`, `isUnplayable`, `mediaType` internally from the `post` prop — avoids extra derived props passed from parent
- `gap` prop on PostCard drives `marginBottom` style for dynamic density-based spacing

## Deviations from Plan

None - plan executed exactly as written. All three components extracted with correct prop interfaces, state management, and import cleanup.

## Issues Encountered
None - plan executed cleanly. All extraction boundaries matched code structure exactly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Three more component boundaries established for plan 03 (any remaining extractions)
- page.tsx at 446 lines, well on track toward the ~400 line target
- All 138 tests still passing after refactor

---
*Phase: 04-extract-components*
*Completed: 2026-02-22*

## Self-Check: PASSED

- src/components/subreddit-search-bar.tsx: FOUND
- src/components/feed-controls.tsx: FOUND
- src/components/post-card.tsx: FOUND
- .planning/phases/04-extract-components/04-02-SUMMARY.md: FOUND
- Commit c9dd02b (Task 1): FOUND
- Commit a786e3f (Task 2): FOUND
