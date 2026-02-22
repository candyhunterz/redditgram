// src/hooks/use-favorites.test.ts
// Tests for useFavorites hook

import { renderHook, act, waitFor } from '@testing-library/react'
import type { RedditPost } from '@/types/reddit'

// Mock indexed-db module
jest.mock('@/lib/indexed-db', () => ({
  getAllFavorites: jest.fn(),
  putFavorite: jest.fn(),
  deleteFavorite: jest.fn(),
}))

// Mock use-toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

import { useFavorites } from './use-favorites'
import {
  getAllFavorites,
  putFavorite,
  deleteFavorite,
} from '@/lib/indexed-db'

const mockGetAllFavorites = getAllFavorites as jest.MockedFunction<typeof getAllFavorites>
const mockPutFavorite = putFavorite as jest.MockedFunction<typeof putFavorite>
const mockDeleteFavorite = deleteFavorite as jest.MockedFunction<typeof deleteFavorite>

const makePost = (overrides: Partial<RedditPost> = {}): RedditPost => ({
  postId: 'abc123',
  title: 'Test Post',
  subreddit: 'pics',
  mediaUrls: ['https://i.redd.it/test.jpg'],
  fullQualityUrls: ['https://i.redd.it/test.jpg'],
  ...overrides,
})

describe('useFavorites', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAllFavorites.mockResolvedValue({})
    mockPutFavorite.mockResolvedValue(undefined)
    mockDeleteFavorite.mockResolvedValue(undefined)
  })

  it('starts with empty favorites, showFavoritesOnly=false, favoritesLoadComplete=false', () => {
    const { result } = renderHook(() => useFavorites())

    expect(result.current.favorites).toEqual({})
    expect(result.current.showFavoritesOnly).toBe(false)
    expect(result.current.favoritesLoadComplete).toBe(false)
  })

  it('loads favorites from IndexedDB on mount', async () => {
    const storedFavorites = {
      abc123: {
        postId: 'abc123',
        title: 'Test Post',
        subreddit: 'pics',
        thumbnailUrl: 'https://i.redd.it/test.jpg',
        mediaUrls: ['https://i.redd.it/test.jpg'],
        fullQualityUrls: ['https://i.redd.it/test.jpg'],
      },
    }
    mockGetAllFavorites.mockResolvedValue(storedFavorites)

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(result.current.favoritesLoadComplete).toBe(true)
    })

    expect(result.current.favorites).toEqual(storedFavorites)
    expect(mockGetAllFavorites).toHaveBeenCalledTimes(1)
  })

  it('sets favoritesLoadComplete=true even when IndexedDB returns empty object', async () => {
    mockGetAllFavorites.mockResolvedValue({})

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(result.current.favoritesLoadComplete).toBe(true)
    })

    expect(result.current.favorites).toEqual({})
  })

  it('toggleFavorite adds a new favorite and calls putFavorite', async () => {
    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.favoritesLoadComplete).toBe(true))

    const post = makePost()

    await act(async () => {
      await result.current.toggleFavorite(post)
    })

    expect(result.current.favorites['abc123']).toMatchObject({
      postId: 'abc123',
      title: 'Test Post',
      subreddit: 'pics',
    })
    expect(mockPutFavorite).toHaveBeenCalledWith('abc123', expect.objectContaining({
      title: 'Test Post',
      subreddit: 'pics',
    }))
  })

  it('toggleFavorite removes an existing favorite and calls deleteFavorite', async () => {
    const storedFavorites = {
      abc123: {
        postId: 'abc123',
        title: 'Test Post',
        subreddit: 'pics',
        thumbnailUrl: undefined,
        mediaUrls: ['https://i.redd.it/test.jpg'],
        fullQualityUrls: ['https://i.redd.it/test.jpg'],
      },
    }
    mockGetAllFavorites.mockResolvedValue(storedFavorites)

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.favoritesLoadComplete).toBe(true))

    // Verify the post is currently in favorites
    expect(result.current.favorites['abc123']).toBeDefined()

    const post = makePost()

    await act(async () => {
      await result.current.toggleFavorite(post)
    })

    expect(result.current.favorites['abc123']).toBeUndefined()
    expect(mockDeleteFavorite).toHaveBeenCalledWith('abc123')
  })

  it('setShowFavoritesOnly toggles the state correctly', async () => {
    const { result } = renderHook(() => useFavorites())

    await waitFor(() => expect(result.current.favoritesLoadComplete).toBe(true))

    act(() => {
      result.current.setShowFavoritesOnly(true)
    })

    expect(result.current.showFavoritesOnly).toBe(true)

    act(() => {
      result.current.setShowFavoritesOnly(false)
    })

    expect(result.current.showFavoritesOnly).toBe(false)
  })

  it('handles IndexedDB load error gracefully — favoritesLoadComplete still becomes true', async () => {
    mockGetAllFavorites.mockRejectedValue(new Error('IDB unavailable'))

    const { result } = renderHook(() => useFavorites())

    await waitFor(() => {
      expect(result.current.favoritesLoadComplete).toBe(true)
    })

    // Should not crash and favorites remain empty
    expect(result.current.favorites).toEqual({})
  })
})
