import { renderHook, act } from '@testing-library/react'
import { useNsfwFilter } from './use-nsfw-filter'

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

describe('useNsfwFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('should default to hiding NSFW content', () => {
    const { result } = renderHook(() => useNsfwFilter())
    expect(result.current.hideNsfw).toBe(true)
  })

  it('should load preference from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValueOnce('false')
    const { result } = renderHook(() => useNsfwFilter())
    expect(result.current.hideNsfw).toBe(false)
  })

  it('should toggle NSFW filter state', () => {
    const { result } = renderHook(() => useNsfwFilter())

    expect(result.current.hideNsfw).toBe(true)

    act(() => {
      result.current.toggleNsfwFilter()
    })

    expect(result.current.hideNsfw).toBe(false)

    act(() => {
      result.current.toggleNsfwFilter()
    })

    expect(result.current.hideNsfw).toBe(true)
  })

  it('should save preference to localStorage when changed', () => {
    const { result } = renderHook(() => useNsfwFilter())

    act(() => {
      result.current.setHideNsfw(false)
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('hideNsfw', 'false')
  })

  it('should allow setting specific filter state', () => {
    const { result } = renderHook(() => useNsfwFilter())

    act(() => {
      result.current.setHideNsfw(false)
    })

    expect(result.current.hideNsfw).toBe(false)

    act(() => {
      result.current.setHideNsfw(true)
    })

    expect(result.current.hideNsfw).toBe(true)
  })
})
