'use client'

import React, { useId } from 'react'
import { Settings, Theme } from '@/hooks/use-settings'
import { GridDensity } from '@/hooks/use-grid-density'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  X,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Monitor,
  Grid3X3,
  LayoutGrid,
  Grid2X2,
  RotateCcw,
} from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: Settings
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
  resolvedTheme: 'light' | 'dark'
}

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
]

const DENSITY_OPTIONS: { value: GridDensity; label: string; icon: React.ReactNode }[] = [
  { value: 'compact', label: 'Compact', icon: <Grid3X3 className="h-4 w-4" /> },
  { value: 'comfortable', label: 'Comfortable', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'spacious', label: 'Spacious', icon: <Grid2X2 className="h-4 w-4" /> },
]

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  updateSetting,
  resetSettings,
  resolvedTheme,
}: SettingsModalProps) {
  const titleId = useId()
  const { containerRef } = useFocusTrap({ isActive: isOpen })

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-md mx-4 bg-background rounded-lg shadow-lg",
          "animate-in fade-in-0 zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2
            id={titleId}
            className="text-lg font-semibold flex items-center gap-2"
          >
            <SettingsIcon className="h-5 w-5" />
            Settings
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close settings"
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Theme Section */}
          <section aria-labelledby="theme-heading">
            <h3 id="theme-heading" className="text-sm font-medium mb-3">
              Theme
            </h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme selection">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  role="radio"
                  aria-checked={settings.theme === option.value}
                  aria-label={option.label}
                  onClick={() => updateSetting('theme', option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors",
                    settings.theme === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
            {settings.theme === 'system' && (
              <p className="text-xs text-muted-foreground mt-2">
                Currently using {resolvedTheme} mode based on system preference
              </p>
            )}
          </section>

          {/* Grid Density Section */}
          <section aria-labelledby="density-heading">
            <h3 id="density-heading" className="text-sm font-medium mb-3">
              Grid Density
            </h3>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Grid density selection">
              {DENSITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  role="radio"
                  aria-checked={settings.gridDensity === option.value}
                  aria-label={option.label}
                  onClick={() => updateSetting('gridDensity', option.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors",
                    settings.gridDensity === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {option.icon}
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Content Filters Section */}
          <section aria-labelledby="filters-heading">
            <h3 id="filters-heading" className="text-sm font-medium mb-3">
              Content Filters
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="nsfw-toggle" className="text-sm cursor-pointer">
                  Show NSFW content
                </Label>
                <button
                  id="nsfw-toggle"
                  role="switch"
                  aria-checked={settings.nsfwEnabled}
                  aria-label="Show NSFW content"
                  onClick={() => updateSetting('nsfwEnabled', !settings.nsfwEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.nsfwEnabled ? "bg-orange-500" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.nsfwEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              {settings.nsfwEnabled && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="blur-toggle" className="text-sm cursor-pointer">
                    Blur NSFW thumbnails
                  </Label>
                  <button
                    id="blur-toggle"
                    role="switch"
                    aria-checked={settings.nsfwBlurred}
                    aria-label="Blur NSFW thumbnails"
                    onClick={() => updateSetting('nsfwBlurred', !settings.nsfwBlurred)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      settings.nsfwBlurred ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        settings.nsfwBlurred ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Accessibility Section */}
          <section aria-labelledby="a11y-heading">
            <h3 id="a11y-heading" className="text-sm font-medium mb-3">
              Accessibility
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="keyboard-toggle" className="text-sm cursor-pointer">
                  Enable keyboard shortcuts
                </Label>
                <button
                  id="keyboard-toggle"
                  role="switch"
                  aria-checked={settings.keyboardShortcutsEnabled}
                  aria-label="Enable keyboard shortcuts"
                  onClick={() => updateSetting('keyboardShortcutsEnabled', !settings.keyboardShortcutsEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.keyboardShortcutsEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.keyboardShortcutsEnabled ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="autoplay-toggle" className="text-sm cursor-pointer">
                  Autoplay videos
                </Label>
                <button
                  id="autoplay-toggle"
                  role="switch"
                  aria-checked={settings.autoplayVideos}
                  aria-label="Autoplay videos"
                  onClick={() => updateSetting('autoplayVideos', !settings.autoplayVideos)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.autoplayVideos ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.autoplayVideos ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="metadata-toggle" className="text-sm cursor-pointer">
                  Show post metadata on hover
                </Label>
                <button
                  id="metadata-toggle"
                  role="switch"
                  aria-checked={settings.showMetadata}
                  aria-label="Show post metadata on hover"
                  onClick={() => updateSetting('showMetadata', !settings.showMetadata)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings.showMetadata ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      settings.showMetadata ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSettings}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button variant="default" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
