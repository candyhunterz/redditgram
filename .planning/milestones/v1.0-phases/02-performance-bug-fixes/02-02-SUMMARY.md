---
phase: 02-performance-bug-fixes
plan: 02
subsystem: performance
tags: [scroll, re-render, lru-cache, usememo, useref, react, performance]

# Dependency graph
requires:
  - 02-01 (LRUCache class at src/lib/lru-cache.ts)
provides:
  - Stable scroll listener (attached once, passive, ref-based state tracking)
  - O(1) basePosts useMemo for normal feed (no per-post object allocation)
  - Bounded in-memory API cache (LRU, 100 entries max)
affects:
  - src/app/page.tsx (all fixes applied)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef for scroll state tracking: avoids adding state to useEffect deps, listener attached once on mount"
    - "passive: true on scroll listeners: lets browser optimize scroll handling (no preventDefault possible)"
    - "Direct array return in useMemo: avoid O(n) spread when upstream data is already correct"
    - "LRUCache as drop-in Map replacement: identical get/set/has API, bounded capacity"

key-files:
  created: []
  modified:
    - src/app/page.tsx

key-decisions:
  - "showScrollTopRef tracks scroll state inside the single listener closure -- no need to include showScrollTop in deps"
  - "basePosts non-favorites branch returns posts directly -- isUnplayableVideoFormat is set by API route, not by basePosts"
  - "LRUCache(100) chosen as cache cap -- same API as Map, no call-site changes needed beyond import and instantiation"

patterns-established:
  - "Ref-shadow pattern: mirror state in a ref so event listeners can read current value without being in deps"

requirements-completed: [REQ-BUGFIX-04, REQ-BUGFIX-05, REQ-PERF-01]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 2 Plan 02: Performance Bug Fixes (page.tsx) Summary

**Three targeted fixes in src/app/page.tsx: stable scroll listener via ref, O(1) basePosts useMemo, and LRU-bounded in-memory API cache**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T22:09:07Z
- **Completed:** 2026-02-22T22:10:44Z
- **Tasks:** 2 (fix scroll + basePosts, integrate LRU cache)
- **Files modified:** 1 (src/app/page.tsx)

## Accomplishments

- Scroll listener no longer tears down and re-attaches on every toggle of showScrollTop state
- `{ passive: true }` enables browser scroll performance optimizations for the listener
- `showScrollTopRef` mirrors state in a ref -- listener reads from ref, no re-render dependency
- `basePosts` useMemo returns `posts` directly when not in favorites mode -- eliminates O(n) object allocation on every recalculation
- In-memory API cache replaced from unbounded `Map` to `LRUCache(100)` -- prevents unbounded memory growth during long browsing sessions
- All 103 tests pass, build succeeds

## Task Commits

Each task was committed atomically:

1. **Fix scroll re-render loop + basePosts spread** - `f987476` (fix)
2. **LRU cache integration** - `d6f9328` (feat)

## Files Created/Modified

- `src/app/page.tsx` - All three performance fixes applied

## Decisions Made

- `showScrollTopRef` is declared near the other refs at line ~472 (alongside `observer`, `loadMorePostsRef`). It shadows the `showScrollTop` state so the scroll handler closure always reads current value without the state in deps.
- The `basePosts` non-favorites branch comment updated to explain why the `isUnplayableVideoFormat ?? false` fallback is unnecessary (API route already sets the field).
- `LRUCache(100)` capacity chosen to match the plan spec. The get/set/has/delete API is identical to Map so zero other code changes were needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 02 has one more plan (03) to complete
- All three REQ-BUGFIX/PERF requirements for this plan are done

## Self-Check: PASSED

- src/app/page.tsx: FOUND
- .planning/phases/02-performance-bug-fixes/02-02-SUMMARY.md: FOUND
- Commit f987476: FOUND
- Commit d6f9328: FOUND

---
*Phase: 02-performance-bug-fixes*
*Completed: 2026-02-22*
