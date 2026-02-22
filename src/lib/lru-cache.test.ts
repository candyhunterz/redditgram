import { LRUCache } from './lru-cache'

describe('LRUCache', () => {
  describe('basic get/set operations', () => {
    it('should return value for existing key', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)
    })

    it('should return undefined for missing key', () => {
      const cache = new LRUCache<string, number>(5)
      expect(cache.get('missing')).toBeUndefined()
    })

    it('should update value when setting existing key', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      cache.set('a', 2)
      expect(cache.get('a')).toBe(2)
    })
  })

  describe('has()', () => {
    it('should return true for existing key', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      expect(cache.has('a')).toBe(true)
    })

    it('should return false for missing key', () => {
      const cache = new LRUCache<string, number>(5)
      expect(cache.has('missing')).toBe(false)
    })
  })

  describe('delete()', () => {
    it('should remove entry and return true when it existed', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      expect(cache.delete('a')).toBe(true)
      expect(cache.get('a')).toBeUndefined()
    })

    it('should return false when entry did not exist', () => {
      const cache = new LRUCache<string, number>(5)
      expect(cache.delete('missing')).toBe(false)
    })
  })

  describe('size getter', () => {
    it('should return 0 for empty cache', () => {
      const cache = new LRUCache<string, number>(5)
      expect(cache.size).toBe(0)
    })

    it('should reflect current entry count', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.size).toBe(2)
    })

    it('should not increase size when updating existing key', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      cache.set('a', 2)
      expect(cache.size).toBe(1)
    })
  })

  describe('clear()', () => {
    it('should remove all entries', () => {
      const cache = new LRUCache<string, number>(5)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBeUndefined()
    })
  })

  describe('LRU eviction', () => {
    it('should evict least-recently-used entry when at capacity', () => {
      const cache = new LRUCache<string, number>(2)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3) // 'a' should be evicted (LRU)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
    })

    it('should promote accessed entry to most-recently-used', () => {
      const cache = new LRUCache<string, number>(2)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.get('a') // promote 'a', so 'b' becomes LRU
      cache.set('c', 3) // 'b' should be evicted
      expect(cache.get('a')).toBe(1)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
    })

    it('should not evict when updating an existing key at capacity', () => {
      const cache = new LRUCache<string, number>(2)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('a', 99) // update existing key, no eviction needed
      expect(cache.size).toBe(2)
      expect(cache.get('a')).toBe(99)
      expect(cache.get('b')).toBe(2)
    })

    it('should keep size at capacity after eviction', () => {
      const cache = new LRUCache<string, number>(3)
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4) // evicts 'a'
      cache.set('e', 5) // evicts 'b'
      expect(cache.size).toBe(3)
    })
  })

  describe('generic type support', () => {
    it('should work with string keys and object values', () => {
      const cache = new LRUCache<string, { name: string }>(5)
      cache.set('user', { name: 'Alice' })
      expect(cache.get('user')).toEqual({ name: 'Alice' })
    })

    it('should work with number keys', () => {
      const cache = new LRUCache<number, string>(5)
      cache.set(1, 'one')
      cache.set(2, 'two')
      expect(cache.get(1)).toBe('one')
      expect(cache.get(2)).toBe('two')
    })
  })
})
