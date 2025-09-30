/**
 * Improved caching utilities with expiration and memory management
 */

import { clientLogger } from './logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheOptions {
  maxSize?: number;
  defaultTTL?: number; // Time to live in milliseconds
  cleanupInterval?: number;
}

/**
 * Enhanced cache implementation with LRU eviction and TTL support
 */
export class EnhancedCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.defaultTTL = options.defaultTTL ?? 5 * 60 * 1000; // 5 minutes default
    this.cleanupInterval = options.cleanupInterval ?? 60 * 1000; // 1 minute cleanup
    
    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Set a value in the cache with optional TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl ?? this.defaultTTL);
    
    // If cache is at max size, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      data: value,
      timestamp: now,
      expiresAt,
      accessCount: 0,
      lastAccessed: now,
    });
    
    clientLogger.debug('Cache set', { key, expiresAt, cacheSize: this.cache.size });
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      clientLogger.debug('Cache miss', { key });
      return undefined;
    }
    
    const now = Date.now();
    
    // Check if entry has expired
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      clientLogger.debug('Cache expired', { key, expiresAt: entry.expiresAt });
      return undefined;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    
    clientLogger.debug('Cache hit', { 
      key, 
      accessCount: entry.accessCount, 
      age: now - entry.timestamp 
    });
    
    return entry.data;
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      clientLogger.debug('Cache deleted', { key });
    }
    return deleted;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    clientLogger.debug('Cache cleared', { previousSize: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    entries: Array<{
      key: string;
      age: number;
      accessCount: number;
      timeToExpire: number;
    }>;
  } {
    const now = Date.now();
    const entries: Array<{
      key: string;
      age: number;
      accessCount: number;
      timeToExpire: number;
    }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        age: now - entry.timestamp,
        accessCount: entry.accessCount,
        timeToExpire: Math.max(0, entry.expiresAt - now),
      });
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount),
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      clientLogger.debug('Cache cleanup completed', { 
        removedCount, 
        remainingSize: this.cache.size 
      });
    }
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      clientLogger.debug('LRU eviction', { 
        evictedKey: oldestKey, 
        lastAccessed: oldestTime 
      });
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Stop periodic cleanup and clear cache
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

/**
 * Global cache instances for different data types
 */
export const redditCache = new EnhancedCache<unknown>({
  maxSize: 200,
  defaultTTL: 10 * 60 * 1000, // 10 minutes for Reddit data
  cleanupInterval: 2 * 60 * 1000, // Cleanup every 2 minutes
});

export const imageCache = new EnhancedCache<string>({
  maxSize: 500,
  defaultTTL: 30 * 60 * 1000, // 30 minutes for image URLs
  cleanupInterval: 5 * 60 * 1000, // Cleanup every 5 minutes
});

/**
 * Cache key generators for consistent naming
 */
export const cacheKeys = {
  reddit: (subreddit: string, sort: string, timeFrame?: string, after?: string) => {
    const parts = ['reddit', subreddit, sort];
    if (timeFrame) parts.push(timeFrame);
    if (after) parts.push(after);
    return parts.join(':');
  },
  
  image: (url: string) => `image:${encodeURIComponent(url)}`,
  
  user: (action: string, identifier: string) => `user:${action}:${identifier}`,
} as const;

/**
 * Cleanup all caches on app shutdown
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    redditCache.destroy();
    imageCache.destroy();
  });
}