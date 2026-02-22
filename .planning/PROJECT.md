# PROJECT

## What This Is

Redditgram — a Reddit media browser PWA built with Next.js 15. Users browse, search, and save Reddit images, videos, and galleries in a responsive masonry grid with fullscreen viewing, download/share, and feed presets.

## Core Value

Fast, responsive browsing and saving of Reddit media content with offline-capable favorites and feed presets.

## Project Type

Brownfield — existing, working application undergoing performance refactoring and architectural cleanup.

## Validated Requirements (existing working features)

- Reddit post fetching via OAuth API with multi-subreddit support
- Media display (images, videos, galleries) with grid and fullscreen modes
- Favorites system with IndexedDB persistence
- Feed presets with sort/time settings and chip bar UI
- Search/filter posts by title and subreddit (client-side)
- Infinite scroll with pagination and prefetch
- Fullscreen media viewer with keyboard/touch navigation
- Download and share media functionality
- Settings management (theme, grid density, preferences)
- Dark/light/system theme support
- Masonry grid layout with density options (compact/comfortable/spacious)
- Progressive image loading with blur placeholders
- Subreddit autocomplete from history
- PWA capabilities

## Active Requirements (refactor goals)

- Delete dead code: 21 unused UI components, 2 AI files, 26 unused npm dependencies, dead imports, console.logs
- Fix known bugs: missing Toaster mount, broken progressive image thumbnails, scroll re-render loop, useMemo unnecessary spreads, confusing error toasts
- Performance improvements: LRU cache for in-memory posts, granular IndexedDB operations, Cache-Control headers on API
- Architecture extraction: shared types file, 5 custom hooks, 6 extracted components, slim page.tsx (~150 lines)
- next/image integration: remotePatterns config, ProgressiveImage rewrite with responsive sizing
- Key tests for critical extracted logic (LRU cache, hooks, granular IndexedDB ops)

## Constraints

- **Refactor only** — no new user-facing features
- Must maintain all existing functionality identically
- Must pass `npm run build` and `npm run test` after each phase
- Preserve all existing test coverage

## Tech Stack

- Next.js 15.2.8 (App Router, Turbopack dev)
- React 18.3.1
- TypeScript 5.x
- Tailwind CSS 3.4.1
- Radix UI (shadcn/ui pattern)
- IndexedDB via `idb` for client persistence
- Vercel KV for server-side Reddit OAuth token caching
- Jest 30 + Testing Library for tests

## Source Document

All refactor details derived from `PERFORMANCE_REFACTOR_PLAN.md` in project root.
