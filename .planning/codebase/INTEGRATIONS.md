# External Integrations

**Analysis Date:** 2026-02-22

## APIs & External Services

**Reddit API:**
- Service: Reddit OAuth2 API
- What it's used for: Fetching subreddit posts, galleries, videos with pagination and filtering
- SDK/Client: Browser Fetch API + OAuth2 authentication
- Auth: Environment variables `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` (Basic auth header)
- User-Agent: `web:gramviewer:v2.0.0 (by /u/{REDDIT_USERNAME})`
- Endpoint pattern: `https://oauth.reddit.com/r/{subreddit}/{sortType}.json`
- Media extraction: Handles galleries, videos, images with fallback chains
- Implementation: `src/app/api/reddit/route.ts` (backend API route)

**Google Generative AI (Gemini):**
- Service: Google AI API via Genkit
- What it's used for: AI-powered operations (specific flows TBD)
- SDK/Client: `@genkit-ai/googleai` plugin
- Auth: `GOOGLE_GENAI_API_KEY` environment variable
- Model: `googleai/gemini-2.0-flash`
- Framework: Google Genkit 1.0.4 with Next.js plugin
- Implementation: `src/ai/ai-instance.ts` (AI instance configuration)
- CLI: Available via `npm run genkit:dev` and `npm run genkit:watch`

**Media Delivery CDNs:**
- Service: Reddit's image/media CDNs
- What it's used for: Serving post media (images, videos, GIFs)
- Domains whitelisted in download proxy:
  - `i.redd.it` - Reddit native images
  - `preview.redd.it` - Reddit image previews
  - `i.imgur.com` - Imgur images
  - `v.redd.it` - Reddit videos
  - `external-preview.redd.it` - External content previews
- Implementation: `src/app/api/download/route.ts` (download proxy with domain whitelist)

## Data Storage

**Client-Side Storage:**

**IndexedDB:**
- Type: Browser-based NoSQL database
- Client: `idb` package (8.0.3)
- Purpose: Persistent caching of Reddit posts and user data
- Stores:
  - `posts` - Cached Reddit posts with metadata (30-minute TTL)
  - `favorites` - Saved favorite posts
  - `savedLists` - Feed presets (user's saved subreddit combinations)
- Schema version: 2 (with migration support)
- Implementation: `src/lib/indexed-db.ts`
- Functions:
  - Post cache: `getCachedPosts()`, `setCachedPosts()`, `clearOldCache()`, `clearAllPostsCache()`
  - Favorites: `getAllFavorites()`, `saveAllFavorites()`
  - Lists: `getAllSavedLists()`, `saveAllLists()`
  - Utilities: `getCacheStats()`, `clearAllData()`

**Server-Side Caching:**

**Vercel KV (Redis):**
- Service: Vercel KV (Redis-compatible)
- Client: `@vercel/kv` package (3.0.0)
- Purpose: Token caching for Reddit OAuth2 access tokens
- Key: `reddit_access_token`
- TTL: Set to `expires_in - 60` seconds (expires before actual token expiry)
- Implementation: `src/app/api/reddit/route.ts` (token management)
- Function: `getAccessToken()` - Fetches and caches tokens, implements expiry logic

**File Storage:**
- Local filesystem only for media downloads
- No cloud storage integration detected
- Download proxy validates URLs against whitelist before serving

## Authentication & Identity

**Auth Provider:**
- Type: Reddit OAuth2 (app-only flow, no user login)
- Implementation: Client credentials OAuth2 flow
- Token handling: Server-side token management with Redis caching
- Credentials location: Environment variables
- User Agent requirement: Must include user agent string in Reddit API requests

**No authentication system for the application itself:**
- App is public-facing
- No user login/signup required
- No session management detected
- No user-specific data persistence beyond browser's IndexedDB

## Monitoring & Observability

**Error Tracking:**
- No dedicated error tracking service detected
- Logging: Console logging only
- Error tags: `[AUTH_LOG]`, `[REDDIT_API_ERROR]`, `[GLOBAL_HANDLER_ERROR]` in API routes

**Logs:**
- Browser console for client-side logging
- Server console for API route logging
- No centralized logging service integrated

## CI/CD & Deployment

**Hosting:**
- Designed for Vercel deployment (uses `@vercel/kv` for caching)
- Compatible with Node.js servers supporting Next.js 15.x
- Docker-deployable via Next.js standalone build

**CI Pipeline:**
- No CI/CD service configuration detected in codebase
- Pre-commit hooks: Uses `patch-package` for dependency patching

**Build Pipeline:**
- `npm run build` - Next.js build command
- `npm start` - Production server
- Dev: `npm run dev` - Turbopack-enabled dev server on port 9002

## Environment Configuration

**Required env vars:**
- `GOOGLE_GENAI_API_KEY` - Google Generative AI API key
- `REDDIT_CLIENT_ID` - Reddit app client ID (required)
- `REDDIT_CLIENT_SECRET` - Reddit app client secret (required)
- `REDDIT_USERNAME` - Optional, defaults to 'candyhunterz' if missing

**Optional env vars:**
- Any Vercel KV configuration (auto-configured on Vercel deployment)

**Secrets location:**
- `.env` file (local development)
- Environment secrets on Vercel deployment dashboard
- Never commit `.env` to repository (in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

**Download Proxy:**
- Internal endpoint: `/api/download?url=...&filename=...`
- Performs domain validation on requested URLs
- Proxies media downloads from Reddit CDNs to client

---

*Integration audit: 2026-02-22*
