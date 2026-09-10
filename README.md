# RedditGram

A Next.js media browser for Reddit with multi-subreddit feeds, saved presets, favorites, search, and galleries.

## Local development

Install dependencies with `npm ci`. Create `.env.local` with `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and optionally `REDDIT_USERNAME`. These credentials are used only by the server. Run `npm run dev` and open http://localhost:9002.

## Checks

- `npm test -- --runInBand`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Lint runs without interactive setup and fails on warnings. Production builds also check lint and types.

## Feed and media behavior

- Fetch and preset loading refresh the initial feed, bypassing memory, IndexedDB, browser, and route response caches. Pagination uses the submitted filters until the next fetch.
- New feed requests cancel older requests; stale responses cannot replace the selected feed.
- Theme and grid density share the settings store. Existing standalone theme/density preferences are migrated when no settings record exists.
- Distant media is unmounted outside a 1,000px viewport buffer. Measured placeholders preserve space; inexpensive wrappers and post data remain in memory. The initial render mounts at most 24 media cards, then the viewport observer adjusts visibility.
- Download uses the selected gallery image. The server streams from exact trusted HTTPS hosts, validates up to three redirects, and limits downloads to 100 MiB and 30 seconds. Unknown-length files exceeding the limit terminate the stream. The browser still collects the response as a Blob before saving.

Next.js stays on version 15. Its nested PostCSS dependency is overridden to the root PostCSS 8 version to pick up security fixes; keep this override covered by the production build when updating dependencies.
