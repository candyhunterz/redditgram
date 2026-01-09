import { renderHook, act } from '@testing-library/react'
import { useCollections, Collection, CollectionPost } from './use-collections'

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

const mockPost: CollectionPost = {
  title: 'Test Post',
  mediaUrls: ['https://example.com/1.jpg'],
  fullQualityUrls: ['https://example.com/1-full.jpg'],
  subreddit: 'pics',
  postId: 'abc123',
}

const mockPost2: CollectionPost = {
  title: 'Another Post',
  mediaUrls: ['https://example.com/2.jpg'],
  fullQualityUrls: ['https://example.com/2-full.jpg'],
  subreddit: 'funny',
  postId: 'def456',
}

describe('useCollections', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
  })

  it('should start with empty collections', () => {
    const { result } = renderHook(() => useCollections())
    expect(result.current.collections).toEqual([])
  })

  it('should load collections from localStorage on mount', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [mockPost], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())
    expect(result.current.collections).toHaveLength(1)
    expect(result.current.collections[0].name).toBe('My Collection')
  })

  it('should create a new collection', () => {
    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.createCollection('Favorites')
    })

    expect(result.current.collections).toHaveLength(1)
    expect(result.current.collections[0].name).toBe('Favorites')
    expect(result.current.collections[0].posts).toEqual([])
    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('should delete a collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'Collection 1', posts: [], createdAt: Date.now() },
      { id: '2', name: 'Collection 2', posts: [], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.deleteCollection('1')
    })

    expect(result.current.collections).toHaveLength(1)
    expect(result.current.collections[0].name).toBe('Collection 2')
  })

  it('should rename a collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'Old Name', posts: [], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.renameCollection('1', 'New Name')
    })

    expect(result.current.collections[0].name).toBe('New Name')
  })

  it('should add post to collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.addPostToCollection('1', mockPost)
    })

    expect(result.current.collections[0].posts).toHaveLength(1)
    expect(result.current.collections[0].posts[0].postId).toBe('abc123')
  })

  it('should not add duplicate post to collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [mockPost], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.addPostToCollection('1', mockPost)
    })

    expect(result.current.collections[0].posts).toHaveLength(1)
  })

  it('should remove post from collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [mockPost, mockPost2], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.removePostFromCollection('1', 'abc123')
    })

    expect(result.current.collections[0].posts).toHaveLength(1)
    expect(result.current.collections[0].posts[0].postId).toBe('def456')
  })

  it('should check if post is in collection', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [mockPost], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    expect(result.current.isPostInCollection('1', 'abc123')).toBe(true)
    expect(result.current.isPostInCollection('1', 'nonexistent')).toBe(false)
  })

  it('should get collection by id', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'Collection 1', posts: [], createdAt: Date.now() },
      { id: '2', name: 'Collection 2', posts: [mockPost], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    const collection = result.current.getCollection('2')
    expect(collection?.name).toBe('Collection 2')
    expect(collection?.posts).toHaveLength(1)
  })

  it('should return undefined for non-existent collection', () => {
    const { result } = renderHook(() => useCollections())
    expect(result.current.getCollection('nonexistent')).toBeUndefined()
  })

  it('should export collections as JSON', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'My Collection', posts: [mockPost], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    const exported = result.current.exportCollections()
    expect(typeof exported).toBe('string')

    const parsed = JSON.parse(exported)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].name).toBe('My Collection')
  })

  it('should import collections from JSON', () => {
    const { result } = renderHook(() => useCollections())

    const collectionsToImport: Collection[] = [
      { id: '1', name: 'Imported Collection', posts: [mockPost], createdAt: Date.now() }
    ]

    act(() => {
      result.current.importCollections(JSON.stringify(collectionsToImport))
    })

    expect(result.current.collections).toHaveLength(1)
    expect(result.current.collections[0].name).toBe('Imported Collection')
  })

  it('should handle invalid JSON on import', () => {
    const { result } = renderHook(() => useCollections())

    act(() => {
      result.current.importCollections('invalid json')
    })

    expect(result.current.collections).toEqual([])
  })

  it('should get all collections containing a specific post', () => {
    const savedCollections: Collection[] = [
      { id: '1', name: 'Collection 1', posts: [mockPost], createdAt: Date.now() },
      { id: '2', name: 'Collection 2', posts: [mockPost, mockPost2], createdAt: Date.now() },
      { id: '3', name: 'Collection 3', posts: [mockPost2], createdAt: Date.now() }
    ]
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedCollections))

    const { result } = renderHook(() => useCollections())

    const collections = result.current.getCollectionsForPost('abc123')
    expect(collections).toHaveLength(2)
    expect(collections.map(c => c.name)).toContain('Collection 1')
    expect(collections.map(c => c.name)).toContain('Collection 2')
  })
})
