'use client'

import { useState, useMemo, useCallback } from 'react'

interface Post {
  title: string
  subreddit: string
  [key: string]: any
}

interface HighlightedSegment {
  text: string
  highlighted: boolean
}

export function usePostSearch<T extends Post>(posts: T[]) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredPosts = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()
    if (!trimmedQuery) return posts

    return posts.filter(post => {
      const titleMatch = post.title.toLowerCase().includes(trimmedQuery)
      const subredditMatch = post.subreddit.toLowerCase().includes(trimmedQuery)
      return titleMatch || subredditMatch
    })
  }, [posts, searchQuery])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
  }, [])

  const highlightMatch = useCallback((text: string, query: string): HighlightedSegment[] => {
    if (!query.trim()) {
      return [{ text, highlighted: false }]
    }

    const lowerText = text.toLowerCase()
    const lowerQuery = query.trim().toLowerCase()
    const segments: HighlightedSegment[] = []
    let lastIndex = 0

    let index = lowerText.indexOf(lowerQuery)
    while (index !== -1) {
      // Add non-highlighted segment before match
      if (index > lastIndex) {
        segments.push({
          text: text.slice(lastIndex, index),
          highlighted: false,
        })
      }

      // Add highlighted segment
      segments.push({
        text: text.slice(index, index + query.trim().length),
        highlighted: true,
      })

      lastIndex = index + query.trim().length
      index = lowerText.indexOf(lowerQuery, lastIndex)
    }

    // Add remaining non-highlighted segment
    if (lastIndex < text.length) {
      segments.push({
        text: text.slice(lastIndex),
        highlighted: false,
      })
    }

    return segments.length > 0 ? segments : [{ text, highlighted: false }]
  }, [])

  return {
    searchQuery,
    setSearchQuery,
    filteredPosts,
    clearSearch,
    highlightMatch,
  }
}
