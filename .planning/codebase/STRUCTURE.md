# Codebase Structure

**Analysis Date:** 2026-02-22

## Directory Layout

```
redditgram/
├── src/                      # All source code
│   ├── ai/                   # Google Genkit AI integration (currently unused)
│   │   ├── ai-instance.ts    # AI instance configuration
│   │   └── dev.ts            # Development server for Genkit
│   │
│   ├── app/                  # Next.js app directory (routing & layout)
│   │   ├── api/              # Backend API routes
│   │   │   ├── reddit/       # Reddit posts fetching endpoint
│   │   │   │   └── route.ts  # GET /api/reddit - fetches and transforms Reddit posts
│   │   │   └── download/     # Media download proxy endpoint
│   │   │       └── route.ts  # GET /api/download - proxies media downloads
│   │   │
│   │   ├── layout.tsx        # Root HTML layout, fonts, DNS prefetch
│   │   ├── page.tsx          # Main application page (1468 lines, all UI & state)
│   │   └── sidebar.tsx       # Sidebar component definition
│   │
│   ├── components/           # Reusable React components
│   │   ├── ui/               # Radix UI wrapped components (shadcn/ui style)
│   │   │   ├── button.tsx, input.tsx, dialog.tsx, etc. (30+ primitive components)
│   │   │   └── [UI library exports with Tailwind styling]
│   │   │
│   │   ├── feed-preset-bar.tsx      # Horizontal preset selector chip bar
│   │   ├── progressive-image.tsx    # Progressive image/video loading with blur
│   │   ├── settings-modal.tsx       # Settings dialog component
│   │   ├── settings-modal.test.tsx  # Settings modal tests
│   │   └── icons.ts                 # Icon exports (lucide-react)
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── use-post-search.ts       # Filter posts by title/subreddit
│   │   ├── use-post-search.test.ts  # Search filtering tests
│   │   ├── use-grid-density.ts      # Masonry grid column density (compact/comfortable/spacious)
│   │   ├── use-grid-density.test.ts # Density configuration tests
│   │   ├── use-settings.ts          # Centralized app settings management
│   │   ├── use-settings.test.ts     # Settings persistence tests
│   │   ├── use-theme.ts            # Dark/light/system theme toggle
│   │   ├── use-theme.test.ts       # Theme tests
│   │   ├── use-subreddit-history.ts # Recent subreddit autocomplete
│   │   ├── use-subreddit-history.test.ts # Subreddit history tests
│   │   ├── use-mobile.tsx          # Responsive design hook (mobile detection)
│   │   ├── use-toast.ts            # Toast notification system
│   │   ├── use-focus-trap.ts       # Keyboard navigation focus management
│   │   ├── use-focus-trap.test.ts  # Focus trap tests
│   │   └── use-prefetch.ts         # 80% scroll prefetch trigger
│   │
│   ├── lib/                  # Utility functions & helpers
│   │   ├── indexed-db.ts          # IndexedDB wrapper for caching & persistence
│   │   ├── utils.ts               # Tailwind className utility (cn function)
│   │   ├── download.ts            # Download media files handler
│   │   ├── download.test.ts       # Download tests
│   │   ├── format-time.ts         # Format relative time & numbers
│   │   ├── format-time.test.ts    # Time formatting tests
│   │   ├── share.ts               # Share post to clipboard/native sharing
│   │   └── share.test.ts          # Share tests
│   │
│   └── services/             # Business logic & API abstraction
│       └── reddit.ts         # getPosts() function calling backend API
│
├── public/                   # Static assets (favicon, fonts, etc.)
├── docs/                     # Documentation folder
├── .planning/codebase/       # GSD codebase analysis documents (generated)
├── node_modules/             # Dependencies
├── .next/                    # Next.js build output
│
├── package.json              # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration with @ path alias
├── jest.config.js           # Jest testing configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── next.config.js           # Next.js configuration
├── .eslintrc.json           # ESLint configuration
└── .gitignore               # Git ignore rules
```

## Directory Purposes

**src/app:**
- Purpose: Next.js app router and page definitions
- Contains: Route handlers, layouts, page components
- Key files: `page.tsx` (main app), `layout.tsx` (root), `api/**` (backend)

**src/components:**
- Purpose: Reusable React components
- Contains: UI library wrappers, business components, modals
- Key files: `ui/*` (50+ primitive components), `feed-preset-bar.tsx`, `progressive-image.tsx`

**src/hooks:**
- Purpose: Encapsulated React hooks for state and side effects
- Contains: Custom logic extraction, persistence, filtering
- Key files: 10+ hooks with corresponding test files

**src/lib:**
- Purpose: Utility functions, helpers, and data access
- Contains: IndexedDB abstraction, formatters, download handler, sharing
- Key files: `indexed-db.ts` (main data persistence), `utils.ts`, `download.ts`

**src/services:**
- Purpose: Business logic for external API communication
- Contains: Reddit API abstraction
- Key files: `reddit.ts` (single source of client-side Reddit API calls)

**src/ai:**
- Purpose: Google Genkit AI integration (currently unused but configured)
- Contains: AI instance setup for potential future use
- Key files: `ai-instance.ts`, `dev.ts`

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML structure, fonts, DNS prefetch for Reddit CDN
- `src/app/page.tsx`: Main React component, renders entire app UI and manages state

**Configuration:**
- `package.json`: Dependencies, scripts, project metadata
- `tsconfig.json`: TypeScript paths (@ → src), strict mode enabled
- `tailwind.config.ts`: Tailwind CSS customization
- `next.config.js`: Next.js build and runtime config

**Core Logic:**
- `src/app/page.tsx`: All presentation + business logic (1468 lines)
- `src/services/reddit.ts`: Client-side Reddit API wrapper
- `src/lib/indexed-db.ts`: Persistent caching abstraction

**Testing:**
- `src/hooks/**/*.test.ts`: 6+ test files for hooks
- `src/lib/**/*.test.ts`: Tests for utilities (download, share, format-time)
- `src/components/settings-modal.test.tsx`: Component tests
- `jest.config.js`: Jest configuration

## Naming Conventions

**Files:**
- React components (JSX): PascalCase with `.tsx` extension (e.g., `FeedPresetBar.tsx`, `ProgressiveImage.tsx`)
- Hooks: camelCase starting with `use-` prefix (e.g., `use-post-search.ts`, `use-grid-density.ts`)
- Utilities: camelCase (e.g., `indexed-db.ts`, `download.ts`, `utils.ts`)
- API routes: `route.ts` in feature directories (e.g., `api/reddit/route.ts`)
- Tests: filename + `.test.ts` or `.test.tsx` (e.g., `use-settings.test.ts`)

**Functions:**
- Event handlers: `handle[Action]` (e.g., `handleThumbnailClick`, `handleDownload`, `handleSavePreset`)
- Async operations: verb prefix (e.g., `fetchInitialPosts`, `loadMorePosts`, `performFetch`)
- Utility functions: descriptive names (e.g., `extractMediaUrls`, `isValidSubreddit`, `interleavePosts`)
- Hooks: `use[Feature]` (e.g., `usePostSearch`, `useSettings`)

**Variables:**
- State variables: camelCase (e.g., `subredditInput`, `selectedPost`, `isLoading`)
- Constants: UPPER_SNAKE_CASE (e.g., `POSTS_PER_LOAD`, `CACHE_EXPIRY_MS`, `POPULAR_SUBREDDITS`)
- Type definitions: PascalCase (e.g., `RedditPost`, `FavoritePostInfo`, `GridDensity`)

**Types:**
- Interfaces: PascalCase prefix with "I" optional (e.g., `RedditPost`, `FeedPreset`, `Settings`)
- Union types: camelCase descriptive (e.g., `SortType`, `TimeFrame`, `GridDensity`)
- Function signatures: match naming (e.g., `SortType = 'hot' | 'top'`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/app/page.tsx` if UI-focused, else `src/hooks/use-[feature].ts`
- Tests: co-located `.test.ts` file
- If external API needed: `src/app/api/[feature]/route.ts`
- Data persistence: `src/lib/indexed-db.ts` (add new store to schema)

**New Component/Module:**
- Business components: `src/components/[feature].tsx`
- If reusable: `src/components/ui/[feature].tsx` (wrap library primitives)
- Styling: inline Tailwind classes or `globals.css`
- Import from `@/components/...` using tsconfig path alias

**Utilities:**
- Shared helpers: `src/lib/[feature].ts`
- Format/transform: `src/lib/format-[type].ts`
- Abstraction layers: follow library patterns (e.g., `indexed-db.ts` wraps idb)
- Import from `@/lib/...` using tsconfig path alias

**Custom Hooks:**
- Location: `src/hooks/use-[feature].ts`
- Pattern: Export function starting with `use`, return object with state and handlers
- Tests: `src/hooks/use-[feature].test.ts`
- Can import from `@/services`, `@/lib`, `@/components`

**API Endpoints:**
- Location: `src/app/api/[feature]/route.ts`
- Pattern: Export async GET/POST handlers
- Response: NextResponse.json() for consistency
- Error handling: Include try/catch with descriptive error messages
- Example: `src/app/api/reddit/route.ts`

## Special Directories

**src/app/api:**
- Purpose: Backend route handlers (server-side only)
- Generated: No
- Committed: Yes
- Notes: Cannot import from client-only code, use env vars for secrets

**node_modules:**
- Purpose: NPM dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignore)

**.next:**
- Purpose: Next.js build output (compiled JS, static files)
- Generated: Yes (npm run build)
- Committed: No (.gitignore)

**src/components/ui:**
- Purpose: shadcn/ui components (imported/wrapped Radix UI)
- Generated: Partially (scaffolded by shadcn CLI, then customized)
- Committed: Yes
- Notes: Use consistent Tailwind patterns across all UI components

---

*Structure analysis: 2026-02-22*
