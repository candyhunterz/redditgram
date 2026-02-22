# Testing Patterns

**Analysis Date:** 2026-02-22

## Test Framework

**Runner:**
- Jest 30.2.0
- Config: `jest.config.js`
- Environment: jsdom (for DOM testing)

**Assertion Library:**
- Jest built-in matchers
- `@testing-library/jest-dom` v6.9.1 for DOM assertions

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode for development
```

Coverage command not exposed in package.json; run `jest --coverage` manually.

## Test File Organization

**Location:**
- Co-located with source files: `use-settings.ts` paired with `use-settings.test.ts`
- Same directory structure: `src/hooks/use-settings.test.ts`, `src/components/settings-modal.test.tsx`

**Naming:**
- Pattern: `[filename].test.ts` or `[filename].test.tsx`
- Examples: `settings-modal.test.tsx`, `use-settings.test.ts`, `download.test.ts`, `format-time.test.ts`

**Structure:**
```
src/
├── hooks/
│   ├── use-settings.ts
│   ├── use-settings.test.ts
│   ├── use-focus-trap.ts
│   ├── use-focus-trap.test.ts
│   └── [more hooks]
├── components/
│   ├── settings-modal.tsx
│   ├── settings-modal.test.tsx
│   └── ui/
└── lib/
    ├── download.ts
    ├── download.test.ts
    ├── format-time.ts
    └── format-time.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { renderHook, act } from '@testing-library/react'
import { useSettings, Settings, DEFAULT_SETTINGS } from './use-settings'

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Setup test state
  })

  it('should start with default settings', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })
})
```

**Patterns:**

**Setup (beforeEach):**
- `jest.clearAllMocks()` to reset all mock state
- Mock setup for localStorage, matchMedia, fetch
- DOM structure creation for accessibility tests
- State reset between tests

**Teardown (afterEach):**
- `jest.restoreAllMocks()` to restore spied methods
- `document.body.innerHTML = ''` to clean up DOM
- Reset fake timers if used: `jest.useRealTimers()`

**Assertions:**
- Expect actual values: `expect(result.current.settings).toEqual(DEFAULT_SETTINGS)`
- Expect function calls: `expect(mockClick).toHaveBeenCalled()`
- Expect call arguments: `expect(mockClick).toHaveBeenCalledWith(expectedArg)`
- Expect DOM presence: `expect(screen.getByRole('dialog')).toBeInTheDocument()`
- Expect DOM absence: `expect(screen.queryByRole('dialog')).not.toBeInTheDocument()`

## Mocking

**Framework:** Jest `jest.fn()` and `jest.mock()`

**Patterns:**

**Function Mocks:**
```typescript
const mockOnClose = jest.fn()
const mockUpdateSetting = jest.fn()

// Use in tests
expect(mockOnClose).toHaveBeenCalled()
expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'dark')
```

**Module Mocks:**
```typescript
jest.mock('lucide-react', () => ({
  X: () => <span data-testid="x-icon">X</span>,
  Settings: () => <span data-testid="settings-icon">Settings</span>,
  // ... more icons
}))
```

**Global Object Mocks:**
```typescript
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
Object.defineProperty(window, 'matchMedia', { value: matchMediaMock })
Object.defineProperty(window, 'indexedDB', { value: indexedDBMock })
```

**Mock Return Values:**
```typescript
mockFetch.mockResolvedValueOnce({ ok: true, blob: () => Promise.resolve(mockBlob) })
mockWriteText.mockResolvedValueOnce(undefined)
mockShare.mockRejectedValueOnce(new Error('Share failed'))
```

**What to Mock:**
- External APIs: fetch, navigator.share, clipboard
- Browser APIs: localStorage, matchMedia, IndexedDB
- Icon libraries: lucide-react (UI detail, not logic)
- Complex hooks: useFocusTrap (dependencies)

**What NOT to Mock:**
- The component/function being tested
- Core React hooks (useEffect, useState, useCallback)
- Test utilities (renderHook, render, screen, fireEvent)
- Custom hooks that ARE the subject of the test
- Validation/utility functions being tested

## Fixtures and Factories

**Test Data:**
```typescript
const mockSettings: Settings = { ...DEFAULT_SETTINGS }
const mockOnClose = jest.fn()

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  gridDensity: 'comfortable',
  keyboardShortcutsEnabled: true,
  autoplayVideos: true,
  showMetadata: true,
}
```

**Location:**
- Inline in test files near usage
- Shared constants exported from source: `DEFAULT_SETTINGS` from `use-settings.ts`
- No separate fixtures directory detected

## Coverage

**Requirements:** Not enforced in package.json

**View Coverage:**
```bash
jest --coverage
```

Coverage data in codebase shows good test coverage for:
- Utility functions: `formatRelativeTime`, `formatNumber`, `generateFilename`
- Hooks: `useSettings`, `useFocusTrap`, `useGridDensity`, `usePostSearch`
- Components: `SettingsModal`

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, simple components
- Approach: Test function input/output, hook state changes, component rendering
- Examples: `formatNumber()` tests, `useSettings()` tests, `generateFilename()` tests

**Integration Tests:**
- Scope: Component behavior with mocked dependencies
- Approach: Render component, interact with it, verify outputs
- Examples: `SettingsModal` tests (theme selection triggers callback), `sharePost()` tests (fallback chain)

**E2E Tests:**
- Status: Not used
- Would test full user flows (search → fetch → display)

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operations', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    blob: () => Promise.resolve(mockBlob),
  })

  const result = await downloadMedia({
    url: 'https://i.redd.it/image.jpg',
    subreddit: 'funny',
    postId: 'abc123',
  })

  expect(result).toBe(true)
})
```

**Hook Testing with act():**
```typescript
const { result } = renderHook(() => useSettings())

act(() => {
  result.current.updateSetting('theme', 'dark')
})

expect(result.current.settings.theme).toBe('dark')
```

**Component Testing with Queries:**
```typescript
it('should display theme options', () => {
  render(
    <SettingsModal
      isOpen={true}
      onClose={mockOnClose}
      settings={mockSettings}
      updateSetting={mockUpdateSetting}
      resetSettings={mockResetSettings}
      resolvedTheme="light"
    />
  )

  expect(screen.getByText('Theme')).toBeInTheDocument()
  expect(screen.getByLabelText('Light')).toBeInTheDocument()
})
```

**Fake Timers for Time-Based Tests:**
```typescript
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2024-01-15T12:00:00Z'))
})

afterEach(() => {
  jest.useRealTimers()
})

it('should return "just now" for times less than a minute ago', () => {
  const thirtySecondsAgo = Math.floor(Date.now() / 1000) - 30
  expect(formatRelativeTime(thirtySecondsAgo)).toBe('just now')
})
```

**Error Testing:**
```typescript
it('should return false on fetch error', async () => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
  })

  const result = await downloadMedia({
    url: 'https://i.redd.it/image.jpg',
    subreddit: 'funny',
    postId: 'abc123',
  })

  expect(result).toBe(false)
})

it('should return false on network error', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Network error'))

  const result = await downloadMedia({
    url: 'https://i.redd.it/image.jpg',
    subreddit: 'funny',
    postId: 'abc123',
  })

  expect(result).toBe(false)
})
```

**DOM Interaction Testing:**
```typescript
it('should call updateSetting when theme is changed', () => {
  render(
    <SettingsModal
      isOpen={true}
      onClose={mockOnClose}
      settings={mockSettings}
      updateSetting={mockUpdateSetting}
      resetSettings={mockResetSettings}
      resolvedTheme="light"
    />
  )

  fireEvent.click(screen.getByLabelText('Dark'))

  expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'dark')
})
```

**Accessibility Testing:**
```typescript
it('should have proper ARIA attributes', () => {
  render(
    <SettingsModal
      isOpen={true}
      onClose={mockOnClose}
      settings={mockSettings}
      updateSetting={mockUpdateSetting}
      resetSettings={mockResetSettings}
      resolvedTheme="light"
    />
  )

  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog).toHaveAttribute('aria-labelledby')
})
```

**Mocking localStorage:**
```typescript
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })
```

## Setup Files

**jest.setup.js:**
- Imports `@testing-library/jest-dom` for extended matchers
- Mocks `window.matchMedia` for responsive component tests
- Mocks `window.localStorage` for storage tests
- Mocks `window.indexedDB` for database tests
- All tests inherit these global mocks

---

*Testing analysis: 2026-02-22*
