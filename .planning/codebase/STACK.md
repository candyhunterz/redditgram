# Technology Stack

**Analysis Date:** 2026-02-22

## Languages

**Primary:**
- TypeScript 5.x - Entire application including React components, API routes, and utilities
- JavaScript (JSX/TSX) - React component templates

**Secondary:**
- CSS - Styling via Tailwind CSS

## Runtime

**Environment:**
- Node.js (inferred from package.json scripts)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 15.2.8 - Full-stack React framework with App Router, API routes, built-in image optimization
- React 18.3.1 - UI library and component framework

**UI & Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- Radix UI (multiple packages ^1.x - ^2.x) - Unstyled, accessible component primitives:
  - `@radix-ui/react-accordion` - Collapsible content sections
  - `@radix-ui/react-alert-dialog` - Modal alert dialogs
  - `@radix-ui/react-avatar` - User avatars
  - `@radix-ui/react-checkbox` - Form checkboxes
  - `@radix-ui/react-dialog` - Modal dialogs (used extensively)
  - `@radix-ui/react-dropdown-menu` - Dropdown menus
  - `@radix-ui/react-label` - Form labels
  - `@radix-ui/react-popover` - Floating popovers
  - `@radix-ui/react-radio-group` - Radio button groups
  - `@radix-ui/react-scroll-area` - Scrollable containers
  - `@radix-ui/react-select` - Dropdown selects
  - `@radix-ui/react-separator` - Visual separators
  - `@radix-ui/react-slider` - Range sliders
  - `@radix-ui/react-tabs` - Tabbed content
  - `@radix-ui/react-toast` - Toast notifications
  - `@radix-ui/react-tooltip` - Hoverable tooltips
- PostCSS 8 - CSS processing with Tailwind plugins

**Form Handling:**
- React Hook Form 7.54.2 - Lightweight form state management
- @hookform/resolvers 4.1.3 - Form validation resolvers
- Zod 3.24.2 - TypeScript-first schema validation library (`src/lib/utils.ts` likely contains form helpers)

**Testing:**
- Jest 30.2.0 - Test runner
- jest-environment-jsdom 30.2.0 - Browser-like test environment
- ts-jest 29.4.6 - TypeScript support for Jest
- @testing-library/react 16.3.1 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers for DOM
- @testing-library/user-event 14.6.1 - User interaction simulation

**Build/Dev:**
- Turbopack - Next.js bundler (used via `next dev --turbopack` in dev script)
- TypeScript Compiler (tsc) - Type checking in CI/CD

**AI/ML:**
- Genkit 1.0.4 - Google's AI framework
- @genkit-ai/googleai 1.0.4 - Google AI (Gemini) plugin for Genkit
- @genkit-ai/next 1.0.4 - Next.js integration for Genkit
- genkit-cli 1.0.4 - CLI tool for Genkit development

**HTTP/Data Fetching:**
- @tanstack/react-query 5.66.0 - Data synchronization and caching (installed but usage pattern TBD from codebase)
- @tanstack-query-firebase/react 1.0.5 - Firebase integration for React Query
- @vercel/kv 3.0.0 - Redis caching for server-side operations (used in `src/app/api/reddit/route.ts` for token caching)
- idb 8.0.3 - IndexedDB wrapper for client-side persistent storage (`src/lib/indexed-db.ts` uses this)

**Utilities:**
- lucide-react 0.475.0 - Icon library (SVG icons)
- date-fns 3.6.0 - Date manipulation and formatting
- class-variance-authority 0.7.1 - CSS class generation for variant patterns
- clsx 2.1.1 - Conditional class name utilities
- tailwind-merge 3.0.1 - Merge Tailwind CSS classes
- tailwindcss-animate 1.0.7 - Animation utilities for Tailwind
- react-masonry-css 1.0.16 - Masonry grid layout component
- recharts 2.15.1 - React charting library
- react-day-picker 8.10.1 - Date picker component
- patch-package 8.0.0 - Patch dependencies without forking

## Configuration

**Environment:**
- `.env` file present - contains environment configuration (never read contents per security policy)
- Environment variables required:
  - `GOOGLE_GENAI_API_KEY` - Google Generative AI API key for Genkit
  - `REDDIT_CLIENT_ID` - Reddit OAuth2 app client ID
  - `REDDIT_CLIENT_SECRET` - Reddit OAuth2 app client secret
  - `REDDIT_USERNAME` - Optional Reddit username (defaults to 'candyhunterz' if not provided)

**Build:**
- `tsconfig.json` - TypeScript configuration with:
  - Target: ES2017
  - Module: ESNext
  - Path alias: `@/*` → `./src/*`
  - Strict mode enabled
  - Next.js plugin configured
- `next.config.ts` - Next.js configuration with TypeScript errors enabled and ESLint disabled during builds
- `jest.config.js` - Jest configuration:
  - Test environment: jsdom (browser-like)
  - Module path mapping for `@/` alias
  - Setup file: `jest.setup.js`
  - Ignores: `node_modules/`, `.next/`
- `tailwind.config.ts` - Tailwind CSS configuration with:
  - Dark mode via class
  - Content scanning for pages, components, app directories
  - Extended color palette via CSS custom properties
  - Sidebar variant colors
  - Accordion animations

## Platform Requirements

**Development:**
- Node.js (version not explicitly specified, likely 18+)
- npm (latest, uses package-lock.json)
- TypeScript 5.x required

**Production:**
- Next.js deployment-ready (can deploy to Vercel, Node.js servers, or Docker)
- Redis/Vercel KV compatible environment for token caching
- Browser support: Modern browsers with ES2017 support

---

*Stack analysis: 2026-02-22*
