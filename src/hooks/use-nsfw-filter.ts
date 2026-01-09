'use client'

import { useState, useEffect, useCallback } from 'react'

const NSFW_STORAGE_KEY = 'hideNsfw'

export function useNsfwFilter() {
  const [hideNsfw, setHideNsfwState] = useState(true)

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(NSFW_STORAGE_KEY)
    if (stored === 'false') {
      setHideNsfwState(false)
    } else if (stored === 'true') {
      setHideNsfwState(true)
    }
    // Default is true (hide NSFW) if nothing stored
  }, [])

  const setHideNsfw = useCallback((value: boolean) => {
    setHideNsfwState(value)
    localStorage.setItem(NSFW_STORAGE_KEY, String(value))
  }, [])

  const toggleNsfwFilter = useCallback(() => {
    setHideNsfw(!hideNsfw)
  }, [hideNsfw, setHideNsfw])

  return {
    hideNsfw,
    setHideNsfw,
    toggleNsfwFilter,
  }
}
