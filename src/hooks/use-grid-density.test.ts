import { renderHook, act } from '@testing-library/react'
import { useGridDensity, GridDensity, DENSITY_CONFIG } from './use-grid-density'

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

describe('useGridDensity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('should default to comfortable density', () => {
    const { result } = renderHook(() => useGridDensity())
    expect(result.current.density).toBe('comfortable')
  })

  it('should load density from localStorage on mount', () => {
    localStorageMock.getItem.mockReturnValueOnce('compact')
    const { result } = renderHook(() => useGridDensity())
    expect(result.current.density).toBe('compact')
  })

  it('should set density and save to localStorage', () => {
    const { result } = renderHook(() => useGridDensity())

    act(() => {
      result.current.setDensity('spacious')
    })

    expect(result.current.density).toBe('spacious')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('gridDensity', 'spacious')
  })

  it('should cycle through densities', () => {
    const { result } = renderHook(() => useGridDensity())

    expect(result.current.density).toBe('comfortable')

    act(() => {
      result.current.cycleDensity()
    })
    expect(result.current.density).toBe('spacious')

    act(() => {
      result.current.cycleDensity()
    })
    expect(result.current.density).toBe('compact')

    act(() => {
      result.current.cycleDensity()
    })
    expect(result.current.density).toBe('comfortable')
  })

  it('should return correct config for compact density', () => {
    localStorageMock.getItem.mockReturnValueOnce('compact')
    const { result } = renderHook(() => useGridDensity())

    expect(result.current.config).toEqual(DENSITY_CONFIG.compact)
    expect(result.current.config.gap).toBe(4)
    expect(result.current.config.columns.mobile).toBe(3)
  })

  it('should return correct config for comfortable density', () => {
    const { result } = renderHook(() => useGridDensity())

    expect(result.current.config).toEqual(DENSITY_CONFIG.comfortable)
    expect(result.current.config.gap).toBe(8)
  })

  it('should return correct config for spacious density', () => {
    localStorageMock.getItem.mockReturnValueOnce('spacious')
    const { result } = renderHook(() => useGridDensity())

    expect(result.current.config).toEqual(DENSITY_CONFIG.spacious)
    expect(result.current.config.gap).toBe(16)
  })

  it('should ignore invalid stored values', () => {
    localStorageMock.getItem.mockReturnValueOnce('invalid')
    const { result } = renderHook(() => useGridDensity())
    expect(result.current.density).toBe('comfortable')
  })

  it('should provide grid style object', () => {
    const { result } = renderHook(() => useGridDensity())

    expect(result.current.gridStyle).toHaveProperty('gap')
    expect(typeof result.current.gridStyle.gap).toBe('string')
  })
})
