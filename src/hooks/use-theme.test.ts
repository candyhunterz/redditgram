import { renderHook, act } from '@testing-library/react'
import { useTheme, Theme } from './use-theme'

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

// Mock document.documentElement
const mockClassList = {
  add: jest.fn(),
  remove: jest.fn(),
  contains: jest.fn(),
}
Object.defineProperty(document, 'documentElement', {
  value: { classList: mockClassList },
  writable: true,
})

describe('useTheme', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    mockClassList.add.mockClear()
    mockClassList.remove.mockClear()
  })

  it('should default to dark theme', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('should load theme from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValueOnce('light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('should toggle between dark and light themes', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
  })

  it('should save theme to localStorage when changed', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light')
  })

  it('should apply dark class to document when theme is dark', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(mockClassList.add).toHaveBeenCalledWith('dark')
    expect(mockClassList.remove).toHaveBeenCalledWith('light')
  })

  it('should apply light class and remove dark class when theme is light', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(mockClassList.add).toHaveBeenCalledWith('light')
    expect(mockClassList.remove).toHaveBeenCalledWith('dark')
  })

  it('should allow setting specific theme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.setTheme('dark')
    })

    expect(result.current.theme).toBe('dark')
  })
})
