# Roadmap: Redditgram Performance Refactor

## Overview

This refactor takes a working but bloated Redditgram PWA and systematically cleans, fixes, restructures, and optimizes it across five phases. The 1,467-line god component (`page.tsx`) gets decomposed into custom hooks and extracted components, dead code and dependencies are removed, performance bugs are fixed, and next/image integration replaces raw `<img>` tags. Every phase preserves all existing functionality -- this is a refactor, not a feature build.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Quick Wins** - Remove dead code, fix low-hanging bugs, add cache headers (completed 2026-02-22)
- [ ] **Phase 2: Performance Bug Fixes** - Fix scroll/memo perf bugs, add LRU cache with tests
- [ ] **Phase 3: Extract Custom Hooks** - Extract business logic into 5 hooks with shared types and granular DB ops
- [ ] **Phase 4: Extract Components** - Extract 6 UI components, slim page.tsx to orchestrator
- [ ] **Phase 5: next/image Integration** - Replace raw img tags with next/image for automatic optimization

## Phase Details

### Phase 1: Quick Wins
**Goal**: Remove all dead code and fix low-hanging bugs with zero behavior change, resulting in a cleaner and smaller codebase
**Depends on**: Nothing (first phase)
**Requirements**: REQ-CLEAN-01, REQ-CLEAN-02, REQ-CLEAN-03, REQ-CLEAN-04, REQ-CLEAN-05, REQ-BUGFIX-01, REQ-BUGFIX-02, REQ-BUGFIX-03, REQ-PERF-03
**Success Criteria** (what must be TRUE):
  1. `npm install && npm run build && npm run test` all pass with no errors
  2. Bundle size is measurably smaller than before (21 component files, 26 npm deps, 2 AI files removed)
  3. Toast notifications are visible to the user when toggling favorites, saving presets, and on errors
  4. Error messages shown to users say "Some subreddits could not be loaded" instead of "Check console"
  5. Blur placeholders load correctly for all Reddit image hosts (i.redd.it, preview.redd.it, external-preview.redd.it)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Delete unused files (21 UI components, 2 AI files) and remove 27 unused npm packages
- [x] 01-02-PLAN.md -- Fix bugs (Toaster, thumbnails, error messages), add cache headers, clean dead code

**Risk/Dependencies**: Low -- purely additive/subtractive changes. No logic restructuring. Each deletion is independently verifiable via build.

---

### Phase 2: Performance Bug Fixes
**Goal**: Fix performance bugs that cause unnecessary re-renders and memory growth, and add a tested LRU cache
**Depends on**: Phase 1
**Requirements**: REQ-BUGFIX-04, REQ-BUGFIX-05, REQ-PERF-01, REQ-TEST-01
**Success Criteria** (what must be TRUE):
  1. Scroll listener is attached once and not re-attached on every scroll-to-top toggle (passive listening enabled)
  2. Viewing the normal feed (not favorites) does not spread/copy every post object on memo recalculation
  3. In-memory post cache is capped at 100 entries with LRU eviction -- extended browsing does not grow memory unboundedly
  4. LRU cache unit tests pass covering get/set/has/delete, eviction at capacity, and LRU ordering
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md -- Create and test LRU cache with TDD (Red-Green-Refactor)
- [x] 02-02-PLAN.md -- Fix scroll-to-top re-render loop, basePosts spread, integrate LRU cache

**Risk/Dependencies**: Low -- targeted fixes with clear before/after behavior. Each fix is independent and testable.

---

### Phase 3: Extract Custom Hooks
**Goal**: Extract all business logic from page.tsx into custom hooks backed by shared types and granular IndexedDB operations, with tests
**Depends on**: Phase 2 (LRU cache exists for use-reddit-posts to consume)
**Requirements**: REQ-ARCH-01, REQ-ARCH-02, REQ-ARCH-03, REQ-ARCH-04, REQ-ARCH-05, REQ-ARCH-06, REQ-PERF-02, REQ-TEST-02, REQ-TEST-03
**Success Criteria** (what must be TRUE):
  1. Shared types are importable from `@/types/reddit` and page.tsx imports from the new location
  2. Five custom hooks exist (use-reddit-posts, use-favorites, use-feed-presets, use-scroll-to-top, use-fullscreen-dialog) and page.tsx consumes them instead of inline state
  3. IndexedDB favorite toggle is O(1) single-record put/delete instead of clear-and-rewrite-all
  4. IndexedDB preset operations (save, delete, rename) are granular single-record ops
  5. All tests pass: granular IndexedDB ops, hook state transitions, and all existing tests
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md -- Create shared types file and TDD granular IndexedDB operations
- [x] 03-02-PLAN.md -- Extract use-scroll-to-top, use-fullscreen-dialog, use-favorites, use-feed-presets hooks
- [x] 03-03-PLAN.md -- Extract use-reddit-posts hook and rewire page.tsx to consume all 5 hooks
- [ ] 03-04-PLAN.md -- Write tests for use-favorites, use-feed-presets, and use-reddit-posts hooks

**Risk/Dependencies**: Medium -- this is the largest refactor phase. State coordination between hooks must be preserved exactly. The hooks must expose the same interface that page.tsx currently uses inline. Depends on Phase 2 LRU cache being available.

---

### Phase 4: Extract Components
**Goal**: Extract UI components from page.tsx, reducing it to a ~150-line orchestrator that wires hooks to components
**Depends on**: Phase 3 (hooks exist for components to consume)
**Requirements**: REQ-ARCH-07, REQ-ARCH-08, REQ-ARCH-09, REQ-ARCH-10, REQ-ARCH-11, REQ-ARCH-12, REQ-ARCH-13
**Success Criteria** (what must be TRUE):
  1. Six new component files exist: MediaCarousel, PostCard, PostGrid, SubredditSearchBar, FeedControls, FullscreenDialog
  2. page.tsx is 200 lines or fewer and contains only hook calls, local UI state, event handler wiring, and JSX composition
  3. Full manual test passes: fetch, infinite scroll, fullscreen viewer, favorites, presets, sort/filter, search, grid density, theme, settings, keyboard shortcuts, mobile swipe, download, share
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

**Risk/Dependencies**: Medium -- component boundaries must be drawn correctly. Prop drilling must be clean (no prop explosion). Depends on Phase 3 hooks being stable and well-interfaced.

---

### Phase 5: next/image Integration
**Goal**: Replace raw `<img>` tags with next/image for automatic WebP conversion, responsive sizing, and lazy loading
**Depends on**: Phase 4 (ProgressiveImage component is extracted and stable)
**Requirements**: REQ-IMAGE-01, REQ-IMAGE-02
**Success Criteria** (what must be TRUE):
  1. next/image can load from all Reddit CDN domains (i.redd.it, preview.redd.it, external-preview.redd.it, i.imgur.com, v.redd.it)
  2. Images load as WebP at appropriate responsive sizes (network tab shows optimized requests, not full-resolution originals)
  3. Images below the fold are lazy-loaded; fullscreen viewer loads full-quality images
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

**Risk/Dependencies**: Low-medium -- next/image with external domains needs careful remotePatterns configuration. Reddit CDN URL patterns vary across hosts. Video elements remain as-is (next/image does not handle video).

---

## Coverage

All 31 v1 requirements are mapped to exactly one phase. No orphans. No duplicates.

| Requirement | Description | Phase |
|---|---|---|
| REQ-CLEAN-01 | Delete unused UI components (21 files) | Phase 1 |
| REQ-CLEAN-02 | Delete unused AI directory | Phase 1 |
| REQ-CLEAN-03 | Remove unused npm dependencies (26+1) | Phase 1 |
| REQ-CLEAN-04 | Remove dead import from page.tsx | Phase 1 |
| REQ-CLEAN-05 | Clean up console.logs | Phase 1 |
| REQ-BUGFIX-01 | Fix missing Toaster mount | Phase 1 |
| REQ-BUGFIX-02 | Fix broken progressive image thumbnail | Phase 1 |
| REQ-BUGFIX-03 | Fix confusing error toast message | Phase 1 |
| REQ-BUGFIX-04 | Fix scroll-to-top re-render loop | Phase 2 |
| REQ-BUGFIX-05 | Fix basePosts useMemo unnecessary spread | Phase 2 |
| REQ-PERF-01 | Add LRU cap to in-memory cache | Phase 2 |
| REQ-PERF-02 | Add granular IndexedDB operations | Phase 3 |
| REQ-PERF-03 | Add Cache-Control header to API response | Phase 1 |
| REQ-ARCH-01 | Create shared types file | Phase 3 |
| REQ-ARCH-02 | Extract use-reddit-posts hook | Phase 3 |
| REQ-ARCH-03 | Extract use-favorites hook | Phase 3 |
| REQ-ARCH-04 | Extract use-feed-presets hook | Phase 3 |
| REQ-ARCH-05 | Extract use-scroll-to-top hook | Phase 3 |
| REQ-ARCH-06 | Extract use-fullscreen-dialog hook | Phase 3 |
| REQ-ARCH-07 | Extract MediaCarousel component | Phase 4 |
| REQ-ARCH-08 | Extract PostCard component | Phase 4 |
| REQ-ARCH-09 | Extract PostGrid component | Phase 4 |
| REQ-ARCH-10 | Extract SubredditSearchBar component | Phase 4 |
| REQ-ARCH-11 | Extract FeedControls component | Phase 4 |
| REQ-ARCH-12 | Extract FullscreenDialog component | Phase 4 |
| REQ-ARCH-13 | Slim page.tsx to ~150 lines | Phase 4 |
| REQ-IMAGE-01 | Configure remotePatterns | Phase 5 |
| REQ-IMAGE-02 | Update ProgressiveImage to use next/image | Phase 5 |
| REQ-TEST-01 | LRU cache tests | Phase 2 |
| REQ-TEST-02 | Granular IndexedDB operation tests | Phase 3 |
| REQ-TEST-03 | Extracted hook tests | Phase 3 |

**Coverage: 31/31 requirements mapped.**

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Quick Wins | 2/2 | Complete   | 2026-02-22 |
| 2. Performance Bug Fixes | 2/3 | In progress | - |
| 3. Extract Custom Hooks | 3/4 | In Progress|  |
| 4. Extract Components | 0/? | Not started | - |
| 5. next/image Integration | 0/? | Not started | - |
