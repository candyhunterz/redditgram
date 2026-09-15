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

  it('explicit fetch bypasses IndexedDB even on a cache hit', async () => {
    mockGetCachedPosts.mockResolvedValue({ posts: [mockPost], after: null })

    const { result } = renderHook(() => useRedditPosts(defaultOptions))

    await act(async () => {
      await result.current.fetchInitialPosts()
    })

    expect(mockGetPosts).toHaveBeenCalledWith('pics', 'hot', expect.objectContaining({ refresh: true }))
    expect(mockGetCachedPosts).not.toHaveBeenCalled()
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


describe('feed consistency regressions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedPosts.mockResolvedValue(null);
    mockSetCachedPosts.mockResolvedValue(undefined);
    mockGetPosts.mockReset();
  });

  it('uses explicit preset filters for the first page and all pagination', async () => {
    mockGetPosts.mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
      .mockResolvedValueOnce({ posts: [mockPost2], after: null });
    const { result, rerender } = renderHook(props => useRedditPosts(props), { initialProps: defaultOptions });
    await act(async () => { await result.current.fetchInitialPosts('aww', { sortType: 'top', timeFrame: 'year' }); });
    rerender({ ...defaultOptions, subredditInput: 'cats' });
    await act(async () => { await result.current.loadMorePosts(); });
    expect(mockGetPosts).toHaveBeenNthCalledWith(1, 'aww', 'top', expect.objectContaining({ timeFrame: 'year', refresh: true }));
    expect(mockGetPosts).toHaveBeenNthCalledWith(2, 'aww', 'top', expect.objectContaining({ timeFrame: 'year', after: 't3_next' }));
  });

  it('does not let a slow old feed overwrite a newer feed or cache it', async () => {
    let finishOld!: (value: { posts: RedditPost[]; after: null }) => void;
    mockGetPosts.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
      .mockResolvedValueOnce({ posts: [mockPost2], after: null });
    const { result } = renderHook(() => useRedditPosts(defaultOptions));
    let oldRequest!: Promise<void>;
    await act(async () => { oldRequest = result.current.fetchInitialPosts('pics'); });
    const oldSignal = mockGetPosts.mock.calls[0][2].signal;
    await act(async () => { await result.current.fetchInitialPosts('aww'); });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finishOld({ posts: [mockPost], after: null }); await oldRequest; });
    expect(result.current.posts.map(p => p.postId)).toEqual(['def456']);
    expect(mockSetCachedPosts).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('ignores stale pagination after switching feeds', async () => {
    let finishPage!: (value: { posts: RedditPost[]; after: null }) => void;
    mockGetPosts.mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
      .mockImplementationOnce(() => new Promise(resolve => { finishPage = resolve; }))
      .mockResolvedValueOnce({ posts: [mockPost2], after: null });
    const { result } = renderHook(() => useRedditPosts(defaultOptions));
    await act(async () => { await result.current.fetchInitialPosts(); });
    let oldPage!: Promise<void>;
    await act(async () => { oldPage = result.current.loadMorePosts(); });
    await act(async () => { await result.current.fetchInitialPosts('aww'); });
    await act(async () => { finishPage({ posts: [mockPost], after: null }); await oldPage; });
    expect(result.current.posts.map(p => p.postId)).toEqual(['def456']);
  });

  it('locks pagination synchronously and deduplicates repeated posts', async () => {
    mockGetPosts.mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
      .mockResolvedValueOnce({ posts: [mockPost, mockPost2], after: null });
    const { result } = renderHook(() => useRedditPosts(defaultOptions));
    await act(async () => { await result.current.fetchInitialPosts(); });
    await act(async () => { await Promise.all([result.current.loadMorePosts(), result.current.loadMorePosts()]); });
    expect(mockGetPosts).toHaveBeenCalledTimes(2);
    expect(result.current.posts.map(p => p.postId)).toEqual(['abc123', 'def456']);
  });
});


it('refreshes pagination instead of reusing a stale persistent page', async () => {
  jest.clearAllMocks();
  mockGetPosts.mockReset();
  mockGetCachedPosts.mockResolvedValue({ posts: [mockPost], after: null });
  mockGetPosts.mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
    .mockResolvedValueOnce({ posts: [mockPost2], after: null });
  const { result } = renderHook(() => useRedditPosts(defaultOptions));
  await act(async () => { await result.current.fetchInitialPosts(); });
  await act(async () => { await result.current.loadMorePosts(); });
  expect(mockGetCachedPosts).not.toHaveBeenCalled();
  expect(mockGetPosts).toHaveBeenLastCalledWith('pics', 'hot', expect.objectContaining({ after: 't3_next', refresh: true }));
  expect(result.current.posts).toHaveLength(2);
});

it('retries the failed cursor without dropping posts or using edited feed inputs', async () => {
  jest.clearAllMocks();
  mockGetPosts.mockReset();
  mockGetPosts.mockResolvedValueOnce({ posts: [mockPost], after: 't3_next' })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ posts: [mockPost2], after: null });
  const { result, rerender } = renderHook(options => useRedditPosts(options), { initialProps: defaultOptions });
  await act(async () => { await result.current.fetchInitialPosts(); });
  await act(async () => { await result.current.loadMorePosts(); });
  expect(result.current.posts).toHaveLength(1);
  expect(result.current.hasMore).toBe(true);
  expect(result.current.error).toContain('offline');
  await act(async () => { await result.current.loadMorePosts(); });
  expect(mockGetPosts).toHaveBeenCalledTimes(2);
  rerender({ ...defaultOptions, subredditInput: 'cats' });
  await act(async () => { await result.current.retryFetch(); });
  expect(mockGetPosts).toHaveBeenLastCalledWith('pics', 'hot', expect.objectContaining({ after: 't3_next' }));
  expect(result.current.posts.map(p => p.postId)).toEqual(['abc123', 'def456']);
  expect(result.current.error).toBeNull();
});
