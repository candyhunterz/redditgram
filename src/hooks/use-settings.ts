'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { GridDensity } from './use-grid-density'

export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  theme: Theme
  gridDensity: GridDensity
  keyboardShortcutsEnabled: boolean
  autoplayVideos: boolean
  showMetadata: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  gridDensity: 'comfortable',
  keyboardShortcutsEnabled: true,
  autoplayVideos: true,
  showMetadata: true,
}

const SETTINGS_STORAGE_KEY = 'redditgram-settings'

function validateSettings(settings: Partial<Settings>): Partial<Settings> {
  const validated = { ...settings }

  // Validate theme
  if (validated.theme && !['light', 'dark', 'system'].includes(validated.theme)) {
    validated.theme = DEFAULT_SETTINGS.theme
  }

  // Validate grid density
  if (validated.gridDensity && !['compact', 'comfortable', 'spacious'].includes(validated.gridDensity)) {
    validated.gridDensity = DEFAULT_SETTINGS.gridDensity
  }

  return validated
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) {
          const validated = validateSettings(parsed)
          setSettings(current => ({ ...current, ...validated }))
        }
      }
    } catch {
      // Invalid JSON, ignore
    }

    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setSystemPrefersDark(mediaQuery.matches)

      const handler = (e: MediaQueryListEvent) => {
        setSystemPrefersDark(e.matches)
      }

      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [])

  // Save to localStorage helper
  const saveSettings = useCallback((newSettings: Settings) => {
    setSettings(newSettings)
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings))
    } catch {
      // localStorage not available
    }
  }, [])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(current => {
      const updated = { ...current, [key]: value }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Update multiple settings at once
  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings(current => {
      const validated = validateSettings(partial)
      const updated = { ...current, ...validated }
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS)
  }, [saveSettings])

  // Export settings as JSON
  const exportSettings = useCallback((): string => {
    return JSON.stringify(settings)
  }, [settings])

  // Import settings from JSON
  const importSettings = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json)
      if (typeof parsed === 'object' && parsed !== null) {
        const validated = validateSettings(parsed)
        const merged = { ...DEFAULT_SETTINGS, ...validated }
        saveSettings(merged)
      }
    } catch {
      // Invalid JSON, ignore
    }
  }, [saveSettings])

  // Resolved theme (accounts for system preference)
  const resolvedTheme = useMemo((): 'light' | 'dark' => {
    if (settings.theme === 'system') {
      return systemPrefersDark ? 'dark' : 'light'
    }
    return settings.theme
  }, [settings.theme, systemPrefersDark])

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    exportSettings,
    importSettings,
    resolvedTheme,
  }
}
