# Architecture

**Analysis Date:** 2026-02-22

## Pattern Overview

**Overall:** Client-Server with Progressive Loading & Local-First Caching

**Key Characteristics:**
- Next.js 15 full-stack application (Frontend + Backend API)
- Client-side rendering with "use client" for interactive components
- Server-side Reddit API integration via Next.js API routes
- Multi-layer caching strategy: In-memory → IndexedDB → Network
- Masonry grid layout with density-based responsive design
- Real-time favorites and feed preset management with IndexedDB persistence

## Layers

**Presentation Layer:**
- Purpose: UI components and user interactions
- Location: `src/app/page.tsx`, `src/components/`
- Contains: React components, dialogs, modals, forms
- Depends on: Hooks (use-*), UI library components (Radix UI), styling (Tailwind)
- Used by: Browser DOM rendering

**Business Logic Layer:**
- Purpose: State management, data filtering, preferences, caching coordination
- Location: `src/hooks/`, `src/lib/` utilities
- Contains: Custom hooks (usePostSearch, useSettings, useGridDensity, etc.), data transformations
- Depends on: Services, IndexedDB utilities
- Used by: Page component and child components

**Service/Data Layer:**
- Purpose: Data fetching and API communication
- Location: `src/services/reddit.ts`
- Contains: getPosts() function that calls backend API
- Depends on: Backend API routes
- Used by: Business logic hooks and page component

**Backend API Layer:**
- Purpose: Server-side Reddit API authentication and media extraction
- Location: `src/app/api/reddit/route.ts`, `src/app/api/download/route.ts`
- Contains: OAuth token management, post data transformation, media URL extraction
- Depends on: Reddit OAuth API, Vercel KV for token caching
- Used by: Client-side service layer via fetch()

**Storage Layer:**
- Purpose: Persistent local caching and user data
- Location: `src/lib/indexed-db.ts`
- Contains: IndexedDB wrapper for posts cache, favorites, and feed presets
- Depends on: Browser's IndexedDB API
- Used by: Page component for load/save operations

## Data Flow

**Initial Post Load (User enters subreddits and clicks Fetch):**

1. User inputs subreddit(s) → `src/app/page.tsx` sets `subredditInput` state
2. `fetchInitialPosts()` is invoked
3. Clears cache entries for these subreddits
4. Calls `performFetch()` with parsed subreddit list
5. For each subreddit, `performFetch()` checks:
   - Memory cache (in-memory Map) → immediate return
   - IndexedDB cache (persistent) → store in memory cache and return
   - Network: calls `/api/reddit?subreddit=...&sortType=hot&...`
6. Backend API route (`src/app/api/reddit/route.ts`):
   - Gets/refreshes Reddit OAuth token via Vercel KV
   - Fetches posts from Reddit API
   - Extracts media URLs using two strategies:
     - `extractMediaUrls()`: Medium-quality URLs for grid display
     - `extractFullQualityUrls()`: Full quality URLs for fullscreen view
   - Returns filtered post list
7. Response stored in both:
   - Memory cache (Map) for instant access
   - IndexedDB for persistence across sessions
8. Posts are interleaved from multiple subreddits
9. Displayed in masonry grid layout

**Infinite Scroll (Loading More Posts):**

1. Intersection Observer detects last post entering viewport
2. Triggers `loadMorePosts()` with stored pagination tokens (`afterTokens`)
3. Same fetch flow but with `after` parameter for pagination
4. New posts appended to existing posts array
5. Prefetch at 80% scroll also triggers load-ahead

**Favorites Management:**

1. User toggles favorite on post → `toggleFavorite()` called
2. Updates local `favorites` state (Map<postId, FavoritePostInfo>)
3. useEffect watches `favorites` and saves to IndexedDB
4. When "Show Favorites Only" is toggled:
   - `basePosts` memo converts favorites Map to RedditPost array
   - Search filters applied same as normal feed
   - Infinite scroll disabled (no pagination for favorites)

**Settings & Preferences:**

1. User changes theme, grid density, or other settings
2. Updates centralized `settings` state via `useSettings()` hook
3. useEffect auto-saves to IndexedDB
4. Grid density change recalculates masonry column breakpoints
5. Theme change updates document class via `useTheme()` hook

**Feed Preset Management:**

1. User saves current feed (subreddits + sort + timeframe) as preset
2. Stored in IndexedDB `savedLists` store
3. Presets displayed in `FeedPresetBar` component
4. Loading preset updates input and refetches with preset parameters
5. Updating/deleting presets modifies IndexedDB store

**Search Filter:**

1. User types in search box
2. `usePostSearch()` hook filters loaded posts by:
   - Case-insensitive title match
   - Case-insensitive subreddit match
3. Returns filtered post array without network request
4. Client-side only, searches already-loaded posts

**State Management:**

All state is React component state or custom hooks. No external state management (Redux/Zustand). State sources:
- `src/app/page.tsx`: Primary state container (posts, favorites, settings, UI controls)
- `src/hooks/use-*.ts`: Encapsulated state hooks
- `src/lib/indexed-db.ts`: Persistent browser storage
- localStorage: Theme, grid density, settings

## Key Abstractions

**RedditPost:**
- Purpose: Unified post data structure
- Examples: `src/services/reddit.ts`, `src/app/api/reddit/route.ts`
- Pattern: Interface with media URLs, metadata, and format detection

**MediaCarousel Component:**
- Purpose: Handles image/video navigation and fullscreen display
- Examples: `src/app/page.tsx` (inline component definition)
- Pattern: Memoized React component with touch/keyboard navigation, responsive rendering

**IndexedDB Wrapper:**
- Purpose: Abstract browser storage with expiry and type safety
- Examples: `src/lib/indexed-db.ts`
- Pattern: Promise-based API with schema validation

**Custom Hooks Pattern:**
- Purpose: Encapsulate feature logic and side effects
- Examples: `usePostSearch`, `useSettings`, `useGridDensity`, `useTheme`
- Pattern: React hooks with useEffect for persistence, useMemo for optimization

**API Route Handlers:**
- Purpose: Server-side logic shielded from client
- Examples: `src/app/api/reddit/route.ts`, `src/app/api/download/route.ts`
- Pattern: Next.js GET handlers with error handling and response transformation

## Entry Points

**Main Application:**
- Location: `src/app/page.tsx`
- Triggers: Browser load, subreddit input submission, settings changes
- Responsibilities: Renders header (search, filters, presets), main grid, dialogs; manages all application state

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Application bootstrap
- Responsibilities: Sets up fonts, DNS prefetching for Reddit CDN, HTML structure

**API: Reddit Posts:**
- Location: `src/app/api/reddit/route.ts`
- Triggers: Client calls `/api/reddit?subreddit=...`
- Responsibilities: OAuth authentication, Reddit API communication, media extraction

**API: Download Proxy:**
- Location: `src/app/api/download/route.ts`
- Triggers: User clicks download button
- Responsibilities: Validates media URL origin, proxies download, sets response headers

## Error Handling

**Strategy:** Multi-level error catching with user-friendly toast notifications

**Patterns:**

**Network Errors:**
- Location: `src/app/page.tsx` in `performFetch()` and `fetchInitialPosts()`
- Approach: Promise.allSettled() wraps fetch calls, catches per-subreddit failures
- User feedback: Toast message shows which subreddits failed
- Fallback: Shows previously cached data if available, displays error UI

**API Errors:**
- Location: `src/app/api/reddit/route.ts`
- Approach: NextResponse.json() with appropriate status codes
- Client handling: Error message extracted from JSON response
- Examples: 400 (missing params), 403 (Reddit API blocked), 500 (token fetch failed)

**Storage Errors:**
- Location: `src/lib/indexed-db.ts` and all consumers
- Approach: Try/catch with silent fallback (localStorage unavailable gracefully)
- Pattern: Cache misses do not block functionality, just trigger network fetch

**Validation Errors:**
- Location: Throughout codebase
- Examples: `isValidSubreddit()` validates subreddit names, media extraction returns [] on error
- Pattern: Return safe defaults rather than throwing

## Cross-Cutting Concerns

**Logging:** Console-based with color coding
- Memory cache hits: `'color: green'`
- IndexedDB cache hits: `'color: blue'`
- Cache misses: `'color: orange'`
- Stored in caches: `'color: purple'`
- Location: `src/app/page.tsx` in performFetch() method

**Validation:** Happens at multiple points
- Input: `isValidSubreddit()` checks regex pattern
- API params: Next.js API route checks required query parameters
- Download URL: `src/app/api/download/route.ts` validates domain whitelist
- Settings: `validateSettings()` in useSettings.ts normalizes invalid values

**Authentication:** Reddit OAuth with token caching
- Location: `src/app/api/reddit/route.ts` in `getAccessToken()`
- Method: Client credentials grant flow
- Caching: Vercel KV stores token with TTL (expires_in - 60 seconds)
- Pattern: Automatic token refresh when cache expires

**Performance Optimization:**
- Memoization: useMemo for expensive computations (filtered posts, breakpoint config)
- Callback stability: useCallback for event handlers passed to child components
- Lazy loading: Images loaded with loading="lazy", progressive image blur effect
- Pagination: Prefetch at 80% scroll to anticipate user scrolling
- Media URLs: Different quality levels for grid (medium) vs fullscreen (full)

**Responsive Design:**
- Breakpoint-based columns via `useGridDensity()` hook
- Masonry grid with CSS classes and inline gap style
- Touch gestures on mobile: swipe left/right for carousel, swipe up to close
- Keyboard shortcuts in fullscreen: arrow keys for navigation, Esc to close

---

*Architecture analysis: 2026-02-22*
