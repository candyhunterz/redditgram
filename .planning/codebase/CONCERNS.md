# Codebase Concerns

**Analysis Date:** 2026-02-22

## Tech Debt

**God Component - page.tsx:**
- Issue: `src/app/page.tsx` is 1,467 lines with ~25 useState hooks, all business logic, and all UI rendering intermingled
- Files: `src/app/page.tsx`
- Impact: Impossible to test, maintain, or reuse logic. Every change risks side effects. Hard to optimize individual concerns.
- Fix approach: Extract logic into custom hooks (`use-reddit-posts.ts`, `use-favorites.ts`, `use-feed-presets.ts`, `use-scroll-to-top.ts`, `use-fullscreen-dialog.ts`) and UI into separate components (`media-carousel.tsx`, `post-card.tsx`, `post-grid.tsx`, `subreddit-search-bar.tsx`, `feed-controls.tsx`, `fullscreen-dialog.tsx`). Target: slim page.tsx to ~150 lines as orchestrator.

**Unused UI Components:**
- Issue: 21 unused shadcn/ui components imported and bundled but never rendered
- Files: `src/components/ui/accordion.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/alert.tsx`, `src/components/ui/avatar.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/chart.tsx`, `src/components/ui/checkbox.tsx`, `src/components/ui/form.tsx`, `src/components/ui/menubar.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/progress.tsx`, `src/components/ui/scroll-area.tsx`, `src/components/ui/separator.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/sidebar.tsx`, `src/components/ui/slider.tsx`, `src/components/ui/switch.tsx`, `src/components/ui/table.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/tooltip.tsx`
- Impact: Increases bundle size (~50KB), slows initial load, clutters component directory
- Fix approach: Delete all 21 files. Verify no imports in codebase before deletion.

**Unused AI/Genkit Dependencies:**
- Issue: 26 unused dependencies bundled (Genkit framework, Firebase, react-hook-form, recharts, react-query, @tanstack/react-virtual, date-fns, zod, etc.) with ~1.5MB combined size
- Files: `package.json` (dependencies), `src/ai/ai-instance.ts`, `src/ai/dev.ts`
- Impact: Bloated bundle, slower npm install, maintenance burden for unused packages. AI directory can be safely removed.
- Fix approach: Delete `src/ai/` directory. Remove from `package.json`: `@genkit-ai/googleai`, `@genkit-ai/next`, `@hookform/resolvers`, `@radix-ui/react-accordion` (and 19 others as listed in PERFORMANCE_REFACTOR_PLAN.md). Remove scripts: `genkit:dev`, `genkit:watch`.

**Broken Progressive Image Thumbnail:**
- Issue: `src/components/progressive-image.tsx` line 32 uses `src.replace(/\.(jpg|...)$/i, 'm.$1')` hack. Works for `i.redd.it` but fails for `preview.redd.it` URLs (have query params like `?width=320`), showing wrong size or broken images
- Files: `src/components/progressive-image.tsx`
- Impact: Blurred placeholder doesn't load correctly, user sees blank space instead of progressive blur effect
- Fix approach: Detect hostname; for `i.redd.it` apply `m` suffix; for `preview.redd.it` reduce `width` query param; fallback to original src. Alternative: use Next.js `<Image>` with responsive sizing in Phase 5.

## Performance Bottlenecks

**IndexedDB Full Rewrite on Favorite Toggle:**
- Problem: `src/lib/indexed-db.ts` `saveAllFavorites()` clears entire favorites store and re-writes all favorites on every single toggle
- Files: `src/lib/indexed-db.ts`, `src/app/page.tsx` (toggleFavorite handler ~line 562)
- Cause: Using `saveAllFavorites(allFavorites)` instead of granular `put`/`delete` operations. With 1000+ favorites, this is O(n) work per toggle.
- Improvement path: Add granular functions to `src/lib/indexed-db.ts`: `putFavorite(postId, data)`, `deleteFavorite(postId)`. Use these instead of full rewrites. Makes toggle O(1).

**In-Memory Cache Unbounded Growth:**
- Problem: `src/app/page.tsx` maintains a `new Map()` in-memory cache of posts with no size limit
- Files: `src/app/page.tsx` (~line 437)
- Cause: Each subreddit/sort combination cached, never evicted. Extended browsing can grow memory unboundedly.
- Improvement path: Implement LRU (Least Recently Used) cache capped at 100 entries. Create `src/lib/lru-cache.ts` (~30 lines), replace `new Map()` with `new LRUCache(100)`.

**Scroll-to-Top Re-render Loop:**
- Problem: `src/app/page.tsx` lines 827-838 include `showScrollTop` in the useEffect dependencies, causing the scroll listener to teardown and reattach every time `showScrollTop` toggles
- Files: `src/app/page.tsx`
- Cause: Listener setup/teardown thrashing
- Improvement path: Use a ref to track current value; set deps to empty array `[]` (effect runs once on mount). Add `{ passive: true }` to listener for better scrolling performance.

**basePosts useMemo Unnecessary Spreads:**
- Problem: `src/app/page.tsx` lines 481-509 spreads every post object on every memo recalculation, even when `showFavoritesOnly` is false
- Files: `src/app/page.tsx`
- Cause: Unnecessary object spreads cause re-allocations
- Improvement path: Return `posts` directly when `showFavoritesOnly` is false (the `?? false` fallback already exists).

**No API Cache-Control Headers:**
- Problem: `src/app/api/reddit/route.ts` returns posts without Cache-Control headers, so browser doesn't cache at all
- Files: `src/app/api/reddit/route.ts`
- Cause: Every fetch hits the backend/Reddit API, even for recently fetched subreddits
- Improvement path: Add `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` to success response. Cache at CDN/browser level for 60s, allow stale for 5 min.

**No next/image Integration:**
- Problem: Using raw `<img>` tags instead of Next.js `<Image>` component
- Files: `src/components/progressive-image.tsx`
- Cause: Missing automatic format optimization (WebP), responsive sizing, lazy loading infrastructure
- Improvement path: Configure `next.config.ts` with `remotePatterns` for Reddit CDN domains. Replace `<img>` with `<Image fill sizes="..."` in `src/components/progressive-image.tsx`. Add tiny SVG blurDataURL placeholder.

## Fragile Areas

**Media Extraction Logic:**
- Files: `src/app/api/reddit/route.ts` (lines 23-152)
- Why fragile: Very complex conditional chain for extracting gallery, video, images from Reddit's inconsistent data structure. 120+ lines of if/else/try logic. Reddit API changes media fields often (is_gallery, media_metadata, preview, url variations, etc.). Missing one case breaks posts silently.
- Safe modification: Add comprehensive test suite for each media type (gallery, video, native video, link, image, GIF). Test with real Reddit posts from test data. Add error logging for extraction failures to identify unknown formats.
- Test coverage: Currently no unit tests for this critical logic.

**Database Migration Logic:**
- Files: `src/lib/indexed-db.ts` (lines 96-115)
- Why fragile: Custom migration from v1 to v2 runs async migration during DB upgrade. If migration fails partially, old records corrupt. Uses `any` type cast (line 102).
- Safe modification: Add try-catch around migration. Type the cursor.value properly. Add pre-migration backup or rollback strategy. Test with various v1 data states.
- Test coverage: No tests for database migrations.

**Error Handling in page.tsx:**
- Files: `src/app/page.tsx` (lines 783-805)
- Why fragile: Generic catch blocks that lose error context. Toast messages say "Check console" but users won't see console. No retry logic for failed fetches. Error state set but never cleared on retry.
- Safe modification: Add specific error types (NetworkError, InvalidSubreddit, RateLimit). Show user-facing error messages for each. Add retry button. Clear error on new fetch attempt.
- Test coverage: No tests for error scenarios.

## Known Bugs

**Missing Toaster Component Mount:**
- Symptoms: Toast notifications silently fail; user never sees success/error messages
- Files: `src/app/layout.tsx`
- Trigger: Any action that calls `toast()` (favorite toggle, preset save, settings update)
- Workaround: Messages log to console but don't appear to user
- Root cause: `<Toaster />` component from `@radix-ui/react-toast` never imported or rendered in layout.tsx
- Fix: Import `{ Toaster } from '@/components/ui/toaster'` and render `<Toaster />` in layout.tsx

**Progressive Image Thumbnail Broken for preview.redd.it:**
- Symptoms: Images with blurred placeholder fail to show placeholder; appear blank until full image loads
- Files: `src/components/progressive-image.tsx` (line 32)
- Trigger: Any post with `preview.redd.it` image URL
- Workaround: Full image eventually loads, but placeholder phase is broken
- Root cause: URL manipulation `src.replace(/\.(jpg|jpeg|png|gif|webp)$/i, 'm.$1')` doesn't account for query params like `?width=320&crop=smart`. Regex fails to match.
- Fix: Parse URL properly; for preview.redd.it, reduce width param instead of adding `m` suffix.

**Unused useFocusTrap Import:**
- Symptoms: None (dead code)
- Files: `src/app/page.tsx` (line 21)
- Trigger: File import statement
- Workaround: Not used, can be deleted
- Root cause: Likely removed from UI but import remains
- Fix: Delete `import { useFocusTrap }...`

**Broken Console Log Messages in page.tsx:**
- Symptoms: Debug output clutters logs; confuses users running dev console
- Files: `src/app/page.tsx` (lines ~658, 676, 688, 703, 764, 769 - colored cache debug logs)
- Fix: Delete all cache-debug console.log calls. Delete generic "Check console" toast message (line 736).

**Confusing Error Toast Message:**
- Symptoms: Toast says "Check console" but users don't have access to console
- Files: `src/app/page.tsx` (line 736)
- Fix: Change to "Some subreddits could not be loaded. Try again or check individual feeds."

**AUTH_LOG Lines in API Route:**
- Symptoms: Verbose logging clutters production logs
- Files: `src/app/api/reddit/route.ts` (lines 160, 164, 194)
- Fix: Delete or move behind debug flag

## Test Coverage Gaps

**Media Extraction Functions:**
- What's not tested: Gallery extraction, video extraction, GIF preview handling, fallback logic
- Files: `src/app/api/reddit/route.ts` (extractMediaUrls, extractFullQualityUrls)
- Risk: Silent failures; unknown Reddit API response formats break posts without warning
- Priority: High - core functionality

**Database Operations:**
- What's not tested: Cache expiry, favorites save/load, migration logic, concurrent access
- Files: `src/lib/indexed-db.ts`
- Risk: Data loss on edge cases; corruption on concurrent writes
- Priority: High - data integrity

**Error Scenarios:**
- What's not tested: Network failures, invalid subreddits, Reddit API rate limits, fetch retries
- Files: `src/app/page.tsx` (performFetch, fetchInitialPosts, loadMorePosts)
- Risk: App crashes or freezes; user never sees error messages
- Priority: Medium - affects user experience

**Download/Share Functions:**
- What's not tested: CORS errors, unsupported file types, clipboard failures, fallbacks
- Files: `src/lib/download.ts`, `src/lib/share.ts`
- Risk: Download fails silently; share fallback untested
- Priority: Medium - feature completeness

**Responsive/Mobile Scenarios:**
- What's not tested: Touch swipe in fullscreen, mobile viewport sizes, keyboard shortcuts on mobile
- Files: `src/app/page.tsx` (MediaCarousel lines 144-182, keyboard handlers)
- Risk: Mobile experience broken unnoticed
- Priority: Medium - mobile is primary use case

---

*Concerns audit: 2026-02-22*
