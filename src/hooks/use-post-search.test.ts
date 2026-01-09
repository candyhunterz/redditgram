'use client'

import { renderHook, act } from '@testing-library/react'
import { usePostSearch } from './use-post-search'

const mockPosts = [
  {
    title: 'Beautiful sunset over the ocean',
    mediaUrls: ['https://example.com/1.jpg'],
    fullQualityUrls: ['https://example.com/1.jpg'],
    subreddit: 'pics',
    postId: 'abc123',
  },
  {
    title: 'Funny cat video compilation',
    mediaUrls: ['https://example.com/2.jpg'],
    fullQualityUrls: ['https://example.com/2.jpg'],
    subreddit: 'funny',
    postId: 'def456',
  },
  {
    title: 'Amazing mountain landscape',
    mediaUrls: ['https://example.com/3.jpg'],
    fullQualityUrls: ['https://example.com/3.jpg'],
    subreddit: 'earthporn',
    postId: 'ghi789',
  },
  {
    title: 'Sunset at the beach',
    mediaUrls: ['https://example.com/4.jpg'],
    fullQualityUrls: ['https://example.com/4.jpg'],
    subreddit: 'pics',
    postId: 'jkl012',
  },
]

describe('usePostSearch', () => {
  it('should return all posts when search query is empty', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    expect(result.current.filteredPosts).toEqual(mockPosts)
    expect(result.current.searchQuery).toBe('')
  })

  it('should filter posts by title', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('sunset')
    })

    expect(result.current.filteredPosts).toHaveLength(2)
    expect(result.current.filteredPosts[0].title).toContain('sunset')
    expect(result.current.filteredPosts[1].title).toContain('Sunset')
  })

  it('should be case-insensitive', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('SUNSET')
    })

    expect(result.current.filteredPosts).toHaveLength(2)
  })

  it('should filter posts by subreddit', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('pics')
    })

    expect(result.current.filteredPosts).toHaveLength(2)
    expect(result.current.filteredPosts.every(p => p.subreddit === 'pics')).toBe(true)
  })

  it('should return empty array when no matches', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('nonexistent')
    })

    expect(result.current.filteredPosts).toHaveLength(0)
  })

  it('should clear search query', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('sunset')
    })

    expect(result.current.filteredPosts).toHaveLength(2)

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.searchQuery).toBe('')
    expect(result.current.filteredPosts).toEqual(mockPosts)
  })

  it('should update filtered posts when posts change', () => {
    const { result, rerender } = renderHook(
      ({ posts }) => usePostSearch(posts),
      { initialProps: { posts: mockPosts } }
    )

    act(() => {
      result.current.setSearchQuery('sunset')
    })

    expect(result.current.filteredPosts).toHaveLength(2)

    const newPosts = [
      ...mockPosts,
      {
        title: 'Another sunset photo',
        mediaUrls: ['https://example.com/5.jpg'],
        fullQualityUrls: ['https://example.com/5.jpg'],
        subreddit: 'pics',
        postId: 'mno345',
      },
    ]

    rerender({ posts: newPosts })

    expect(result.current.filteredPosts).toHaveLength(3)
  })

  it('should trim whitespace from search query', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('  sunset  ')
    })

    expect(result.current.filteredPosts).toHaveLength(2)
  })

  it('should highlight matching terms in results', () => {
    const { result } = renderHook(() => usePostSearch(mockPosts))

    act(() => {
      result.current.setSearchQuery('sunset')
    })

    const highlighted = result.current.highlightMatch('Beautiful sunset over the ocean', 'sunset')
    expect(highlighted).toHaveLength(3)
    expect(highlighted[1].highlighted).toBe(true)
    expect(highlighted[1].text).toBe('sunset')
  })
})
