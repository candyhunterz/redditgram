---
phase: 05-nextimage-integration
plan: 01
subsystem: ui
tags: [next/image, image-optimization, webp, progressive-image, cdn]

# Dependency graph
requires:
  - phase: 04-extract-components
    provides: ProgressiveImage component isolated for targeted next/image upgrade
provides:
  - next/image integration for all Reddit CDN image loading
  - Automatic WebP conversion and responsive sizing via /_next/image proxy
  - Blur placeholder replacing raw img shimmer effect
affects: []

# Tech tracking
tech-stack:
  added: [next/image (built-in)]
  patterns: [fill+sizes pattern for next/image in fluid containers, blurDataURL inline SVG placeholder]

key-files:
  created: []
  modified:
    - next.config.ts
    - src/components/progressive-image.tsx

key-decisions:
  - "Keep loading prop (lazy|eager) instead of switching to priority prop -- next/image supports loading natively so MediaCarousel needs zero changes"
  - "Use inline SVG blurDataURL (neutral gray 8x8 rect) instead of getThumbnailSrc thumbnail -- zero network requests, simpler code"
  - "Remove getThumbnailSrc entirely -- it was only used for the blur placeholder img which is now replaced by blurDataURL"
  - "Use fill prop with sizes=(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw matching masonry grid breakpoints (1/2/3 col)"

patterns-established:
  - "next/image with fill requires a positioned parent (relative w-full h-full overflow-hidden)"
  - "blurDataURL inline SVG pattern for zero-request placeholders"

requirements-completed:
  - REQ-IMAGE-01
  - REQ-IMAGE-02

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 5 Plan 01: next/image Integration Summary

**ProgressiveImage rewritten with next/image fill+blur for automatic WebP, responsive sizing, and CDN-allowlisted remotePatterns for all 5 Reddit domains**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T01:13:09Z
- **Completed:** 2026-02-23T01:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Configured `images.remotePatterns` in `next.config.ts` for all 5 Reddit CDN domains (i.redd.it, preview.redd.it, external-preview.redd.it, i.imgur.com, v.redd.it)
- Replaced raw `<img>` tags in ProgressiveImage with `<Image fill sizes placeholder="blur" blurDataURL=...>` from next/image
- Removed 66 lines of manual shimmer/placeholder/ref/state code; replaced with 15 lines using next/image built-ins
- ProgressiveVideo left completely unchanged; all 138 existing tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure remotePatterns for Reddit CDN domains** - `96c6b12` (chore)
2. **Task 2: Rewrite ProgressiveImage to use next/image** - `0f3ab75` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `next.config.ts` - Added `images.remotePatterns` for 5 Reddit CDN hostnames
- `src/components/progressive-image.tsx` - Replaced raw `<img>` with next/image `<Image>`, removed imageLoaded state/imgRef/shimmer/getThumbnailSrc

## Decisions Made
- Keep `loading` prop (`lazy` | `eager`) rather than switching to `priority` boolean -- next/image supports `loading` natively, so `MediaCarousel` (which passes `loading={!isFullScreen ? "lazy" : "eager"}`) needs zero changes
- Use an inline SVG `blurDataURL` (neutral gray 8x8 rectangle) as the blur placeholder -- zero network requests, no reliance on Reddit CDN thumbnail conventions, simpler than the old `getThumbnailSrc` approach
- Remove `getThumbnailSrc` entirely -- it was only ever used internally to generate the blur placeholder `<img>` src, which is now obsolete
- Use `fill` prop (with positioned parent `relative w-full h-full overflow-hidden`) instead of explicit width/height, matching the existing fluid container layout
- `sizes` set to `"(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"` aligning with the masonry grid's 1/2/3 column breakpoints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 complete. All Reddit CDN images now route through `/_next/image` proxy for automatic WebP conversion and responsive sizing
- Feed images lazy-load by default; fullscreen images load eagerly (via `loading="eager"` passed from MediaCarousel)
- Blur placeholder appears during image loading using inline SVG blurDataURL
- No further phases planned per ROADMAP

---
*Phase: 05-nextimage-integration*
*Completed: 2026-02-22*

## Self-Check: PASSED

- next.config.ts: FOUND
- src/components/progressive-image.tsx: FOUND
- 05-01-SUMMARY.md: FOUND
- Commit 96c6b12: FOUND
- Commit 0f3ab75: FOUND
- remotePatterns in next.config.ts: CONFIRMED
- next/image import in progressive-image.tsx: CONFIRMED
- ProgressiveVideo export: CONFIRMED
- No raw img tags in ProgressiveImage: CONFIRMED
