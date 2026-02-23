# PROJECT

## What This Is

Redditgram — a Reddit media browser PWA built with Next.js 15. Users browse, search, and save Reddit images, videos, and galleries in a responsive masonry grid with fullscreen viewing, download/share, and feed presets. Clean architecture with custom hooks, extracted components, and next/image optimization.

## Core Value

Fast, responsive browsing and saving of Reddit media content with offline-capable favorites and feed presets.

## Project Type

Brownfield — working application with clean architecture after v1.0 performance refactor.

## Requirements

### Validated

- ✓ Delete unused UI components (21 files) — v1.0
- ✓ Delete unused AI directory — v1.0
- ✓ Remove unused npm dependencies (27) — v1.0
- ✓ Remove dead imports and console.logs — v1.0
- ✓ Fix missing Toaster mount — v1.0
- ✓ Fix broken progressive image thumbnails — v1.0
- ✓ Fix confusing error toast message — v1.0
- ✓ Fix scroll-to-top re-render loop — v1.0
- ✓ Fix basePosts useMemo unnecessary spread — v1.0
- ✓ LRU-capped in-memory cache (100 entries) — v1.0
- ✓ Granular IndexedDB operations (O(1) favorites, presets) — v1.0
- ✓ Cache-Control header on API response — v1.0
- ✓ Shared types file (src/types/reddit.ts) — v1.0
- ✓ 5 custom hooks extracted (use-reddit-posts, use-favorites, use-feed-presets, use-scroll-to-top, use-fullscreen-dialog) — v1.0
- ✓ 6 UI components extracted (MediaCarousel, PostCard, PostGrid, SubredditSearchBar, FeedControls, FullscreenDialog) — v1.0
- ✓ page.tsx slimmed to 191-line orchestrator — v1.0
- ✓ next/image integration with remotePatterns and WebP optimization — v1.0
- ✓ LRU cache tests, granular IDB tests, hook tests (138 total) — v1.0

### Active

(None — next milestone not yet defined)

### Out of Scope

- Mobile native app — PWA works well
- Server-side rendering for feed — client-side fetching is core pattern
- User accounts / authentication — read-only Reddit browsing
- Video transcoding — Reddit serves video directly
- Offline mode beyond favorites — real-time feed is core value

## Context

Shipped v1.0 with 7,725 LOC TypeScript across a clean component architecture.
Tech stack: Next.js 15.2.8, React 18, TypeScript, Tailwind CSS, Radix UI, IndexedDB (idb), Vercel KV.
138 tests passing (Jest 30 + Testing Library).
Architecture: page.tsx orchestrator (191 lines) -> 5 custom hooks + 6 extracted components.
Pre-existing issues: theme state divergence (useTheme vs useSettings), external-preview.redd.it HTML entity encoding.

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| 5-phase refactor sequence (clean -> perf -> hooks -> components -> images) | Follow source refactor plan progression | ✓ Good — clean dependency chain |
| Map-based LRU cache (no linked list) | Map insertion-order gives O(1) eviction | ✓ Good — 30 lines, fully tested |
| Hooks don't close over page state | Testability, pure interfaces | ✓ Good — clean separation |
| basePosts useMemo stays in page.tsx | Orchestrates across two hooks | ✓ Good — avoids coupling hooks |
| Inline SVG blurDataURL for next/image | Zero network requests vs thumbnail fetch | ✓ Good — simpler, faster |
| PostCard uses React.forwardRef | IntersectionObserver needs ref forwarding | ✓ Good — infinite scroll works |
| SubredditSearchBar/FeedControls own their state | Reduces page.tsx state vars | ✓ Good — 3 state vars moved out |
| Quick mode for GSD workflow | Minimal plan overhead, fast execution | ✓ Good — 12 plans in 1 day |

## Constraints

- Must maintain all existing functionality identically
- Must pass `npm run build` and `npm run test` after each change
- Preserve all existing test coverage
- Next.js 15 App Router patterns

## Tech Stack

- Next.js 15.2.8 (App Router, Turbopack dev)
- React 18.3.1
- TypeScript 5.x
- Tailwind CSS 3.4.1
- Radix UI (shadcn/ui pattern)
- IndexedDB via `idb` for client persistence
- Vercel KV for server-side Reddit OAuth token caching
- Jest 30 + Testing Library for tests

---
*Last updated: 2026-02-22 after v1.0 milestone*
