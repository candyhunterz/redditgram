// src/hooks/use-reddit-posts.test.ts
// Tests for useRedditPosts hook

import { renderHook, act, waitFor } from '@testing-library/react'
import type { RedditPost } from '@/types/reddit'

// Mock Reddit service
jest.mock('@/services/reddit', () => ({
  getPosts: jest.fn(),
}))

// Mock indexed-db module
jest.mock('@/lib/indexed-db', () => ({
  getCachedPosts: jest.fn(),
  setCachedPosts: jest.fn(),
}))

// Mock use-toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

// Mock use-prefetch
jest.mock('@/hooks/use-prefetch', () => ({
  usePrefetch: () => ({ resetPrefetch: jest.fn(), isPrefetching: false }),
}))

// Mock IntersectionObserver (not available in jsdom)
const mockObserve = jest.fn()
const mockDisconnect = jest.fn()
const mockUnobserve = jest.fn()
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  unobserve: mockUnobserve,
})) as unknown as typeof IntersectionObserver

import { useRedditPosts } from './use-reddit-posts'
import { getPosts } from '@/services/reddit'
import { getCachedPosts, setCachedPosts } from '@/lib/indexed-db'

const mockGetPosts = getPosts as jest.MockedFunction<typeof getPosts>
const mockGetCachedPosts = getCachedPosts as jest.MockedFunction<typeof getCachedPosts>
const mockSetCachedPosts = setCachedPosts as jest.MockedFunction<typeof setCachedPosts>

const mockPost: RedditPost = {
  postId: 'abc123',
  title: 'Test Post',
  subreddit: 'pics',
  mediaUrls: ['https://i.redd.it/test.jpg'],
  fullQualityUrls: ['https://i.redd.it/test.jpg'],
}

const mockPost2: RedditPost = {
  postId: 'def456',
  title: 'Test Post 2',
  subreddit: 'pics',
  mediaUrls: ['https://i.redd.it/test2.jpg'],
  fullQualityUrls: ['https://i.redd.it/test2.jpg'],
}

const defaultOptions = {
  subredditInput: 'pics',
  sortType: 'hot' as const,
  timeFrame: 'day' as const,
  showFavoritesOnly: false,
  addToHistory: jest.fn(),
}

describe('useRedditPosts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetCachedPosts.mockResolvedValue(null)
    mockSetCachedPosts.mockResolvedValue(undefined)
    mockGetPosts.mockResolvedValue({ posts: [mockPost], after: null })
    mockObserve.mockClear()
    mockDisconnect.mockClear()
  })

  it('starts with empty posts, isLoading=false, error=null, hasMore=true, fetchInitiated=false', () => {
    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    expect(result.current.posts).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasMore).toBe(true)
    expect(result.current.fetchInitiated).toBe(false)
  })

  it('fetchInitialPosts fetches and stores posts (cache miss path)', async () => {
    mockGetCachedPosts.mockResolvedValue(null)
    mockGetPosts.mockResolvedValue({ posts: [mockPost], after: 't3_next' })

    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].postId).toBe('abc123')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.fetchInitiated).toBe(true)
    expect(mockSetCachedPosts).toHaveBeenCalledTimes(1)
    expect(mockGetPosts).toHaveBeenCalledWith('pics', 'hot', expect.any(Object))
  })

  it('fetchInitialPosts uses IndexedDB cache on hit — does not call getPosts', async () => {
    mockGetCachedPosts.mockResolvedValue({ posts: [mockPost], after: null })

    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(mockGetPosts).not.toHaveBeenCalled()
    expect(result.current.posts).toHaveLength(1)
    expect(result.current.posts[0].postId).toBe('abc123')
    expect(result.current.fetchInitiated).toBe(true)
  })

  it('fetchInitialPosts sets error state when getPosts rejects', async () => {
    mockGetCachedPosts.mockResolvedValue(null)
    mockGetPosts.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(result.current.error).toMatch(/Network error|Fetch error/)
    expect(result.current.posts).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('fetchInitialPosts sets error for empty/invalid subreddit input', async () => {
    const { result } = renderHook(() => useRedditPosts({
      ...defaultOptions,
      subredditInput: '',
    }))

    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(result.current.error).toMatch(/valid subreddit|at least one/)
    expect(result.current.posts).toEqual([])
    expect(result.current.fetchInitiated).toBe(false)
  })

  it('loadMorePosts appends to existing posts', async () => {
    // First fetch returns mockPost with an after token
    mockGetCachedPosts.mockResolvedValue(null)
    mockGetPosts
      .mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
      .mockResolvedValueOnce({ posts: [mockPost2], after: null })

    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    // Initial fetch
    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(result.current.posts).toHaveLength(1)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.fetchInitiated).toBe(true)

    // Load more
    await act(async () => {
      await result.current.loadMorePosts()
    })

    expect(result.current.posts).toHaveLength(2)
    expect(result.current.posts[0].postId).toBe('abc123')
    expect(result.current.posts[1].postId).toBe('def456')
    expect(result.current.hasMore).toBe(false)
  })

  it('loadMorePosts does nothing when fetchInitiated=false', async () => {
    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    await act(async () => {
      await result.current.loadMorePosts()
    })

    expect(mockGetPosts).not.toHaveBeenCalled()
    expect(result.current.posts).toEqual([])
  })

  it('lastPostRef is a function (IntersectionObserver callback ref)', () => {
    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    expect(typeof result.current.lastPostRef).toBe('function')
  })
})
