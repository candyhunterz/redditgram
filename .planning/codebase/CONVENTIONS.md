# Coding Conventions

**Analysis Date:** 2026-02-22

## Naming Patterns

**Files:**
- React components use PascalCase with `.tsx` extension: `settings-modal.tsx`, `progressive-image.tsx`
- Hooks use camelCase with `use-` prefix and `.ts` or `.test.ts` extension: `use-settings.ts`, `use-focus-trap.test.ts`
- Utility files use kebab-case: `format-time.ts`, `indexed-db.ts`, `download.ts`
- API routes follow Next.js convention in `src/app/api/[resource]/route.ts`: `src/app/api/reddit/route.ts`, `src/app/api/download/route.ts`

**Functions:**
- Event handlers: camelCase with `handle` prefix: `handleThumbnailClick`, `handleShare`, `handleDownload`, `handleDialogClose`
- Click/input handlers: `handleChange`, `handleClick`, `handleFocus`, `handleBlur`
- Fetch/async functions: camelCase describing action: `fetchInitialPosts`, `loadMorePosts`, `performFetch`, `downloadMedia`, `sharePost`
- Helper/utility functions: camelCase: `formatRelativeTime`, `formatNumber`, `generateFilename`, `parseSubreddits`, `isValidSubreddit`
- Custom hooks return object with named properties: `useSettings()` returns `{ settings, updateSetting, resetSettings, resolvedTheme }`

**Variables:**
- State variables: camelCase: `posts`, `subredditInput`, `isLoading`, `selectedPost`, `favorites`
- Boolean flags: prefix with `is`, `has`, `show`, `can`: `isLoading`, `isDialogOpen`, `hasMore`, `showFavoritesOnly`, `showSettings`
- Constants: UPPER_SNAKE_CASE in component scope (e.g., `POSTS_PER_LOAD = 20`, `POPULAR_SUBREDDITS`)
- Private/internal: prefix with underscore in rare cases, typically just camelCase
- Refs: end with `Ref`: `containerRef`, `loadMorePostsRef`, `touchStartX`, `touchEndX`

**Types:**
- Interfaces: PascalCase with no prefix: `SettingsModalProps`, `Settings`, `RedditPost`, `FavoritePostInfo`, `FeedPreset`
- Type aliases: PascalCase with descriptive suffix: `CachedRedditResponse`, `CacheKey`, `FavoritesMap`, `Theme`, `GridDensity`
- Generic type parameters: Single letter or descriptive PascalCase: `<K extends keyof Settings>`, `<T>`

## Code Style

**Formatting:**
- No explicit linter/formatter config detected; follows Next.js/React conventions
- Semicolons present throughout
- 2-space indentation (inferred from code samples)
- Single quotes for strings: `'use client'`, `'light'`, `'dark'`
- Template literals for complex strings or interpolation: `` `${variable}` ``

**Linting:**
- `"lint": "next lint"` configured in package.json
- No custom ESLint config file detected; uses Next.js default rules
- Strict TypeScript mode enabled in `tsconfig.json` with `"strict": true`

**Type Safety:**
- TypeScript required throughout: all `.ts` and `.tsx` files
- Generic type constraints used: `<K extends keyof Settings>(key: K, value: Settings[K])`
- Optional properties with `?`: `mediaUrls?: string[]`, `fullQualityUrls?: string[]`
- Union types for variants: `type Theme = 'light' | 'dark' | 'system'`
- Strict null checking implied by `"strict": true`

## Import Organization

**Order:**
1. React and framework imports: `import React from 'react'`, `'use client'`
2. External dependencies (npm): `import { useState } from 'react'`, `import Masonry from 'react-masonry-css'`
3. Component/hook imports from project: `import { Button } from '@/components/ui/button'`, `import { useSettings } from '@/hooks/use-settings'`
4. Utility/lib imports: `import { cn } from '@/lib/utils'`, `import { formatRelativeTime } from '@/lib/format-time'`
5. Types/interfaces within file or at top after imports
6. Comments separating sections: `// *** Standard Imports ***`, `// --- Helper Functions & Constants ---`

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- All imports use `@/` prefix consistently: never relative paths like `../../../`
- Radix UI components: `@/components/ui/[component-name]`
- Hooks: `@/hooks/[hook-name]`
- Services: `@/services/[service-name]`
- Libraries: `@/lib/[utility-name]`

## Error Handling

**Patterns:**

**Try-Catch Blocks:**
- Used for async operations and JSON parsing:
  ```typescript
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Process parsed data
    }
  } catch {
    // Invalid JSON, ignore - silent failure acceptable for non-critical operations
  }
  ```
- Empty catch blocks with comments are acceptable for non-critical failures (localStorage, localStorage, JSON parsing)

**Return Values:**
- Async functions return boolean for success/failure: `downloadMedia()` returns `true | false`
- Error states stored in component state: `const [error, setError] = useState<string | null>(null)`
- User-facing errors set via toast notifications: `toast({ variant: "destructive", description: "Error message" })`
- Console errors logged for debugging: `console.error("Failed to load presets:", err)`

**Validation:**
- Input validation before processing: `isValidSubreddit(subreddit)` checks regex pattern
- Type validation for stored data: `if (typeof parsed === 'object' && parsed !== null)`
- Settings validation with defaults: `validateSettings()` returns corrected values, fallback to defaults
- Array safety checks: `if (Array.isArray(urlsToUse))`

**Graceful Degradation:**
- Optional operations wrap in try-catch, don't propagate errors
- Fallback defaults used: `post.isUnplayableVideoFormat ?? false`, `new Date((post.createdUtc ?? 0) * 1000)`
- Promise.allSettled() for parallel operations to prevent single failure from blocking all: `await Promise.allSettled(fetchPromises)`

## Logging

**Framework:** Console object (no dedicated logger)

**Patterns:**
- Development: Styled console.log with colors for cache hits/misses: `` console.log(`%cMemory Cache HIT for key: ${cacheKey}`, 'color: green') ``
- Errors: `console.error()` for actual errors: `console.error("Failed to load presets:", err)`
- Suppression: Silent failures (empty catch) for non-critical operations like localStorage
- No production logging framework detected

**When to Log:**
- Cache operations (hit/miss/store): `console.log(%c...)`
- Network errors and failures: `console.error()`
- User-facing errors: via toast notifications, not logs

## Comments

**When to Comment:**
- Section headers with clear purpose: `// --- Helper Functions & Constants ---`, `// --- State Variables ---`
- Complex logic requiring explanation: swipe threshold calculations, interleaving algorithms
- TODO/FIXME: Not observed in codebase; issues tracked elsewhere
- Non-obvious type casting or workarounds
- API behavior notes: "Use server-side proxy to bypass CORS restrictions"

**JSDoc/TSDoc:**
- Minimal use observed
- Function-level JSDoc for utilities:
  ```typescript
  /**
   * Extract file extension from URL
   */
  function getExtensionFromUrl(url: string): string
  ```
- Not consistently applied; inline comments preferred

## Function Design

**Size:**
- Most components/functions keep to reasonable length (50-200 lines)
- Large component files (1467 lines in `page.tsx`) break down logic into:
  - Helper functions at top: `isValidSubreddit()`, `parseSubreddits()`
  - Sub-components as `React.FC` memoized: `const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(...)`
  - Effect hooks for separate concerns: load favorites, load presets, scroll listeners, prefetch

**Parameters:**
- Props interfaces used for component parameters: `interface SettingsModalProps { ... }`
- Single object parameter for related data: `downloadMedia(params: DownloadMediaParams)` with `{ url, subreddit, postId }`
- Destructuring in function signature:
  ```typescript
  const MediaCarousel: React.FC<MediaCarouselProps> = React.memo(({
    mediaUrls, fullQualityUrls, title, subreddit, postId, ...
  }) => { ... })
  ```

**Return Values:**
- Explicit return types: `async function downloadMedia(...): Promise<boolean>`
- Hook returns object with named exports: `return { settings, updateSetting, ... }`
- Component renders JSX or null: conditional rendering with early returns
- Utility functions return primitive or object types

**Memoization:**
- `React.memo()` for expensive components: `export const MediaCarousel = React.memo(...)`
- `useCallback()` for event handlers to prevent re-renders: `const handleShare = useCallback(async (...) => { ... }, [deps])`
- `useMemo()` for computed values: `const basePosts = useMemo(() => { ... }, [posts, favorites, showFavoritesOnly])`
- Dependency arrays always specified and accurate

## Module Design

**Exports:**
- Named exports preferred: `export function useSettings()`, `export const DEFAULT_SETTINGS: Settings = {...}`
- Default exports for React components: `export default function Home()`
- Mixed exports in hook files: `export type Theme = ...`, `export interface Settings { ... }`, `export function useSettings()`

**Barrel Files:**
- Not consistently used
- UI components in `src/components/ui/` do not have barrel file
- Imports directly from component files: `from '@/components/ui/button'`

**Organization:**
- Hooks grouped in `src/hooks/` directory
- UI components in `src/components/ui/` (Radix UI based)
- Utilities in `src/lib/`
- API routes in `src/app/api/`
- Page components in `src/app/`
- Services in `src/services/`

---

*Convention analysis: 2026-02-22*
