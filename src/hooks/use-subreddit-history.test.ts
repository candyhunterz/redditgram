import { renderHook, act } from '@testing-library/react'
import { useSubredditHistory } from './use-subreddit-history'

// Mock localStorage
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

describe('useSubredditHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('should start with empty history', () => {
    const { result } = renderHook(() => useSubredditHistory())
    expect(result.current.history).toEqual([])
  })

  it('should load history from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['pics', 'funny', 'aww']))
    const { result } = renderHook(() => useSubredditHistory())
    expect(result.current.history).toEqual(['pics', 'funny', 'aww'])
  })

  it('should add subreddit to history', () => {
    const { result } = renderHook(() => useSubredditHistory())

    act(() => {
      result.current.addToHistory('pics')
    })

    expect(result.current.history).toContain('pics')
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('should not add duplicate subreddits', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['pics']))
    const { result } = renderHook(() => useSubredditHistory())

    act(() => {
      result.current.addToHistory('pics')
    })

    expect(result.current.history.filter(s => s === 'pics').length).toBe(1)
  })

  it('should move recently used subreddit to front', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['funny', 'pics', 'aww']))
    const { result } = renderHook(() => useSubredditHistory())

    act(() => {
      result.current.addToHistory('aww')
    })

    expect(result.current.history[0]).toBe('aww')
  })

  it('should limit history to max items', () => {
    const { result } = renderHook(() => useSubredditHistory())

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addToHistory(`sub${i}`)
      }
    })

    expect(result.current.history.length).toBeLessThanOrEqual(20)
  })

  it('should get suggestions matching input', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['pics', 'funny', 'pictures', 'aww']))
    const { result } = renderHook(() => useSubredditHistory())

    const suggestions = result.current.getSuggestions('pic')
    expect(suggestions).toContain('pics')
    expect(suggestions).toContain('pictures')
    expect(suggestions).not.toContain('funny')
  })

  it('should be case-insensitive for suggestions', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['Pics', 'FUNNY']))
    const { result } = renderHook(() => useSubredditHistory())

    const suggestions = result.current.getSuggestions('pic')
    expect(suggestions).toContain('Pics')
  })

  it('should clear history', () => {
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['pics', 'funny']))
    const { result } = renderHook(() => useSubredditHistory())

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.history).toEqual([])
  })
})
