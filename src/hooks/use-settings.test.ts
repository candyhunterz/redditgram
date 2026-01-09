import { renderHook, act } from '@testing-library/react'
import { useSettings, Settings, DEFAULT_SETTINGS } from './use-settings'

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

// Mock matchMedia
const matchMediaMock = jest.fn().mockImplementation((query: string) => ({
  matches: query === '(prefers-color-scheme: dark)',
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}))

Object.defineProperty(window, 'matchMedia', { value: matchMediaMock })

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('should start with default settings', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('should load settings from localStorage on mount', () => {
    const savedSettings: Partial<Settings> = {
      theme: 'dark',
      gridDensity: 'compact',
      nsfwEnabled: true,
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedSettings))

    const { result } = renderHook(() => useSettings())

    expect(result.current.settings.theme).toBe('dark')
    expect(result.current.settings.gridDensity).toBe('compact')
    expect(result.current.settings.nsfwEnabled).toBe(true)
  })

  it('should merge partial saved settings with defaults', () => {
    const partialSettings: Partial<Settings> = {
      theme: 'light',
    }
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partialSettings))

    const { result } = renderHook(() => useSettings())

    expect(result.current.settings.theme).toBe('light')
    // Other settings should use defaults
    expect(result.current.settings.gridDensity).toBe(DEFAULT_SETTINGS.gridDensity)
    expect(result.current.settings.slideshowInterval).toBe(DEFAULT_SETTINGS.slideshowInterval)
  })

  it('should update a single setting', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSetting('theme', 'dark')
    })

    expect(result.current.settings.theme).toBe('dark')
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('should update multiple settings at once', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({
        theme: 'light',
        gridDensity: 'spacious',
        nsfwEnabled: true,
      })
    })

    expect(result.current.settings.theme).toBe('light')
    expect(result.current.settings.gridDensity).toBe('spacious')
    expect(result.current.settings.nsfwEnabled).toBe(true)
  })

  it('should reset all settings to defaults', () => {
    const { result } = renderHook(() => useSettings())

    // Change some settings first
    act(() => {
      result.current.updateSettings({
        theme: 'dark',
        gridDensity: 'compact',
        nsfwEnabled: true,
      })
    })

    // Reset to defaults
    act(() => {
      result.current.resetSettings()
    })

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('should persist settings to localStorage', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSetting('theme', 'dark')
    })

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'redditgram-settings',
      expect.any(String)
    )
  })

  it('should export settings as JSON', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSetting('theme', 'dark')
    })

    const exported = result.current.exportSettings()
    const parsed = JSON.parse(exported)

    expect(parsed.theme).toBe('dark')
  })

  it('should import settings from JSON', () => {
    const { result } = renderHook(() => useSettings())

    const settingsToImport: Partial<Settings> = {
      theme: 'light',
      gridDensity: 'spacious',
    }

    act(() => {
      result.current.importSettings(JSON.stringify(settingsToImport))
    })

    expect(result.current.settings.theme).toBe('light')
    expect(result.current.settings.gridDensity).toBe('spacious')
  })

  it('should handle invalid JSON on import gracefully', () => {
    const { result } = renderHook(() => useSettings())
    const originalSettings = { ...result.current.settings }

    act(() => {
      result.current.importSettings('invalid json')
    })

    // Settings should remain unchanged
    expect(result.current.settings).toEqual(originalSettings)
  })

  it('should clamp slideshow interval to valid range', () => {
    const { result } = renderHook(() => useSettings())

    // Too low
    act(() => {
      result.current.updateSetting('slideshowInterval', 500)
    })
    expect(result.current.settings.slideshowInterval).toBe(1000)

    // Too high
    act(() => {
      result.current.updateSetting('slideshowInterval', 60000)
    })
    expect(result.current.settings.slideshowInterval).toBe(30000)

    // Valid value
    act(() => {
      result.current.updateSetting('slideshowInterval', 5000)
    })
    expect(result.current.settings.slideshowInterval).toBe(5000)
  })

  it('should resolve system theme based on media query', () => {
    // Mock dark mode preference
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))

    const { result } = renderHook(() => useSettings())

    // With system theme, it should resolve to dark
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('should return explicit theme when not system', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSetting('theme', 'light')
    })

    expect(result.current.resolvedTheme).toBe('light')
  })
})
