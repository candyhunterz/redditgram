'use client'

import { useState, useEffect, useCallback } from 'react'

export interface CollectionPost {
  title: string
  mediaUrls: string[]
  fullQualityUrls: string[]
  subreddit: string
  postId: string
}

export interface Collection {
  id: string
  name: string
  posts: CollectionPost[]
  createdAt: number
}

const COLLECTIONS_STORAGE_KEY = 'postCollections'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([])

  // Load collections from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setCollections(parsed)
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }, [])

  // Save to localStorage helper
  const saveCollections = useCallback((newCollections: Collection[]) => {
    setCollections(newCollections)
    try {
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(newCollections))
    } catch {
      // localStorage not available
    }
  }, [])

  const createCollection = useCallback((name: string) => {
    const newCollection: Collection = {
      id: generateId(),
      name,
      posts: [],
      createdAt: Date.now(),
    }
    setCollections(current => {
      const updated = [...current, newCollection]
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const deleteCollection = useCallback((id: string) => {
    setCollections(current => {
      const updated = current.filter(c => c.id !== id)
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const renameCollection = useCallback((id: string, newName: string) => {
    setCollections(current => {
      const updated = current.map(c =>
        c.id === id ? { ...c, name: newName } : c
      )
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const addPostToCollection = useCallback((collectionId: string, post: CollectionPost) => {
    setCollections(current => {
      const updated = current.map(c => {
        if (c.id !== collectionId) return c
        // Check if post already exists
        if (c.posts.some(p => p.postId === post.postId)) return c
        return { ...c, posts: [...c.posts, post] }
      })
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const removePostFromCollection = useCallback((collectionId: string, postId: string) => {
    setCollections(current => {
      const updated = current.map(c => {
        if (c.id !== collectionId) return c
        return { ...c, posts: c.posts.filter(p => p.postId !== postId) }
      })
      localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const isPostInCollection = useCallback((collectionId: string, postId: string): boolean => {
    const collection = collections.find(c => c.id === collectionId)
    if (!collection) return false
    return collection.posts.some(p => p.postId === postId)
  }, [collections])

  const getCollection = useCallback((id: string): Collection | undefined => {
    return collections.find(c => c.id === id)
  }, [collections])

  const getCollectionsForPost = useCallback((postId: string): Collection[] => {
    return collections.filter(c => c.posts.some(p => p.postId === postId))
  }, [collections])

  const exportCollections = useCallback((): string => {
    return JSON.stringify(collections)
  }, [collections])

  const importCollections = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        saveCollections(parsed)
      }
    } catch {
      // Invalid JSON, ignore
    }
  }, [saveCollections])

  return {
    collections,
    createCollection,
    deleteCollection,
    renameCollection,
    addPostToCollection,
    removePostFromCollection,
    isPostInCollection,
    getCollection,
    getCollectionsForPost,
    exportCollections,
    importCollections,
  }
}
