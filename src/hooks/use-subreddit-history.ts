'use client'

import { useState, useEffect, useCallback } from 'react'

const HISTORY_STORAGE_KEY = 'subredditHistory'
const MAX_HISTORY_ITEMS = 20

export function useSubredditHistory() {
  const [history, setHistory] = useState<string[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }, [])

  // Save to localStorage whenever history changes
  const saveHistory = useCallback((newHistory: string[]) => {
    setHistory(newHistory)
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory))
  }, [])

  const addToHistory = useCallback((subreddit: string) => {
    setHistory(current => {
      // Remove if already exists (we'll add to front)
      const filtered = current.filter(
        s => s.toLowerCase() !== subreddit.toLowerCase()
      )
      // Add to front and limit size
      const newHistory = [subreddit, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  const getSuggestions = useCallback((input: string): string[] => {
    if (!input || input.length < 1) return []
    const lowerInput = input.toLowerCase()
    return history.filter(s => s.toLowerCase().includes(lowerInput))
  }, [history])

  const clearHistory = useCallback(() => {
    saveHistory([])
  }, [saveHistory])

  return {
    history,
    addToHistory,
    getSuggestions,
    clearHistory,
  }
}

// Popular subreddits for suggestions
export const POPULAR_SUBREDDITS = [
  'pics',
  'aww',
  'funny',
  'memes',
  'earthporn',
  'art',
  'food',
  'nature',
  'gaming',
  'movies',
]
