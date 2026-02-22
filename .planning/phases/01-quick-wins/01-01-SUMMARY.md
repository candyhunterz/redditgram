---
phase: 01-quick-wins
plan: 01
subsystem: ui
tags: [cleanup, shadcn, radix-ui, npm, dead-code-removal]

# Dependency graph
requires: []
provides:
  - Removed 22 dead source files (21 UI components + 2 AI files)
  - Cleaned package.json from 39 dependencies to 20 dependencies
  - Build and test suite confirmed passing on lean dependency set
affects: [02-quick-wins, all future phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [Keep only actively-imported UI components, Remove unused shadcn scaffolding]

key-files:
  created: []
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Remove all shadcn/ui components not imported by any source file"
  - "Remove firebase, genkit, tanstack-query, zod, recharts and other scaffolding deps that were never wired up"
  - "Clear .next cache before build to avoid stale rename errors on Windows"

patterns-established:
  - "Dead code identified by grep for import references before deletion"

requirements-completed: [REQ-CLEAN-01, REQ-CLEAN-02, REQ-CLEAN-03]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 1 Plan 01: Dead Code Removal Summary

**Deleted 22 unused source files and 27 npm packages, reducing dependencies from 39 to 20; build and all 86 tests pass cleanly.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-22T21:53:17Z
- **Completed:** 2026-02-22T21:55:03Z
- **Tasks:** 2
- **Files modified:** 2 (package.json, package-lock.json) + 24 deleted

## Accomplishments

- Deleted 21 unused shadcn/ui component files from `src/components/ui/` — only 12 actively-used components remain
- Deleted `src/ai/` directory (ai-instance.ts, dev.ts) — no longer referenced anywhere
- Removed 26 unused dependencies and 1 devDependency (genkit-cli) from package.json
- Removed 2 genkit scripts (genkit:dev, genkit:watch) from package.json
- `npm install`, `npm run build`, and all 86 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete unused UI components and AI directory** - `6536312` (chore)
2. **Task 2: Remove unused npm dependencies and scripts** - `13e95af` (chore)

## Files Created/Modified

- `src/components/ui/` - 21 deleted: accordion, alert-dialog, alert, avatar, badge, calendar, chart, checkbox, form, menubar, popover, progress, scroll-area, separator, sheet, sidebar, slider, switch, table, tabs, textarea, tooltip
- `src/ai/` - directory deleted: ai-instance.ts, dev.ts
- `package.json` - 26 deps, 1 devDep, 2 scripts removed
- `package-lock.json` - regenerated from clean state

## Decisions Made

- Verified zero import references to each deleted file before deletion (grep confirmed no broken imports)
- Cleaned `.next` cache before build — Windows ENOENT rename error on stale cache is a pre-existing environment issue, not a code issue
- Kept all 12 actively-used UI components: button, card, collapsible, dialog, dropdown-menu, input, label, radio-group, select, skeleton, toast, toaster

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- First build attempt failed with `ENOENT: rename .next/export/500.html` — this is a Windows stale cache issue (pre-existing, not caused by our changes). Fixed by deleting `.next/` directory before re-running build. Second build succeeded cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Codebase is now lean: 20 dependencies, 12 UI components, no dead AI/scaffold code
- Ready for Plan 02 (layout/code quality fixes)
- No blockers

---
*Phase: 01-quick-wins*
*Completed: 2026-02-22*
