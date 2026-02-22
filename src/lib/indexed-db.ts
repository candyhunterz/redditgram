/**
 * IndexedDB utility for persistent caching of Reddit posts
 * Provides better performance than localStorage with support for larger datasets
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { RedditPost } from '@/services/reddit';

// --- Feed Preset Type ---
export interface FeedPreset {
  name: string;
  subreddits: string;
  sortType: string;
  timeFrame: string;
  order: number;
  timestamp: number;
}

// Database schema definition
interface RedditCacheDB extends DBSchema {
  posts: {
    key: string; // cacheKey
    value: {
      cacheKey: string;
      posts: RedditPost[];
      after: string | null;
      timestamp: number;
      subreddit: string;
      sortType: string;
      timeFrame?: string;
    };
    indexes: {
      'by-timestamp': number;
      'by-subreddit': string;
    };
  };
  favorites: {
    key: string; // postId
    value: {
      postId: string;
      title: string;
      subreddit: string;
      thumbnailUrl?: string;
      mediaUrls?: string[];
      fullQualityUrls?: string[];
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
  savedLists: {
    key: string; // list name
    value: {
      name: string;
      subreddits: string;
      sortType: string;
      timeFrame: string;
      order: number;
      timestamp: number;
    };
    indexes: { 'by-timestamp': number };
  };
}

const DB_NAME = 'redditgram-cache';
const DB_VERSION = 2;
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

let dbPromise: Promise<IDBPDatabase<RedditCacheDB>> | null = null;

/**
 * Initialize and open the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase<RedditCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RedditCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Create posts store
        if (!db.objectStoreNames.contains('posts')) {
          const postsStore = db.createObjectStore('posts', { keyPath: 'cacheKey' });
          postsStore.createIndex('by-timestamp', 'timestamp');
          postsStore.createIndex('by-subreddit', 'subreddit');
        }

        // Create favorites store
        if (!db.objectStoreNames.contains('favorites')) {
          const favoritesStore = db.createObjectStore('favorites', { keyPath: 'postId' });
          favoritesStore.createIndex('by-timestamp', 'timestamp');
        }

        // Create saved lists store
        if (!db.objectStoreNames.contains('savedLists')) {
          const listsStore = db.createObjectStore('savedLists', { keyPath: 'name' });
          listsStore.createIndex('by-timestamp', 'timestamp');
        }

        // Migrate v1 -> v2: add sortType, timeFrame, order to existing savedLists records
        if (oldVersion < 2) {
          const listsStore = transaction.objectStore('savedLists');
          const migrateRecords = async () => {
            let cursor = await listsStore.openCursor();
            while (cursor) {
              const value = cursor.value as any;
              if (!value.sortType) {
                await cursor.update({
                  ...value,
                  sortType: 'hot',
                  timeFrame: 'day',
                  order: value.timestamp || Date.now(),
                });
              }
              cursor = await cursor.continue();
            }
          };
          migrateRecords();
        }
      },
    });
  }
  return dbPromise;
}

// ========================================================================
// POSTS CACHE
// ========================================================================

/**
 * Get cached posts by cache key
 */
export async function getCachedPosts(cacheKey: string): Promise<{ posts: RedditPost[]; after: string | null } | null> {
  try {
    const db = await getDB();
    const cached = await db.get('posts', cacheKey);

    if (!cached) return null;

    // Check if cache is expired
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      // Cache expired, delete it
      await db.delete('posts', cacheKey);
      return null;
    }

    return {
      posts: cached.posts,
      after: cached.after,
    };
  } catch (error) {
    console.error('Error getting cached posts:', error);
    return null;
  }
}

/**
 * Save posts to cache
 */
export async function setCachedPosts(
  cacheKey: string,
  posts: RedditPost[],
  after: string | null,
  metadata: {
    subreddit: string;
    sortType: string;
    timeFrame?: string;
  }
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('posts', {
      cacheKey,
      posts,
      after,
      timestamp: Date.now(),
      ...metadata,
    });
  } catch (error) {
    console.error('Error caching posts:', error);
  }
}

/**
 * Clear old cached posts (older than 1 hour)
 */
export async function clearOldCache(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('posts', 'readwrite');
    const index = tx.store.index('by-timestamp');
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour

    let cursor = await index.openCursor();
    while (cursor) {
      if (cursor.value.timestamp < cutoff) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }

    await tx.done;
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }
}

/**
 * Clear all cached posts
 */
export async function clearAllPostsCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('posts');
  } catch (error) {
    console.error('Error clearing all posts cache:', error);
  }
}

// ========================================================================
// FAVORITES
// ========================================================================

/**
 * Get all favorites
 */
export async function getAllFavorites(): Promise<Record<string, any>> {
  try {
    const db = await getDB();
    const favorites = await db.getAll('favorites');

    // Convert array to object with postId as key
    return favorites.reduce((acc, fav) => {
      acc[fav.postId] = {
        postId: fav.postId,
        title: fav.title,
        subreddit: fav.subreddit,
        thumbnailUrl: fav.thumbnailUrl,
        mediaUrls: fav.mediaUrls,
        fullQualityUrls: fav.fullQualityUrls,
      };
      return acc;
    }, {} as Record<string, any>);
  } catch (error) {
    console.error('Error getting favorites:', error);
    return {};
  }
}

/**
 * Save all favorites
 */
export async function saveAllFavorites(favorites: Record<string, any>): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('favorites', 'readwrite');

    // Clear existing favorites
    await tx.store.clear();

    // Add all favorites
    for (const [postId, favorite] of Object.entries(favorites)) {
      await tx.store.put({
        postId,
        title: favorite.title,
        subreddit: favorite.subreddit,
        thumbnailUrl: favorite.thumbnailUrl,
        mediaUrls: favorite.mediaUrls,
        fullQualityUrls: favorite.fullQualityUrls,
        timestamp: Date.now(),
      });
    }

    await tx.done;
  } catch (error) {
    console.error('Error saving favorites:', error);
  }
}

// ========================================================================
// SAVED LISTS (Feed Presets)
// ========================================================================

/**
 * Get all feed presets (saved lists)
 */
export async function getAllSavedLists(): Promise<FeedPreset[]> {
  try {
    const db = await getDB();
    const lists = await db.getAll('savedLists');

    // Return as FeedPreset array sorted by order
    return lists
      .map((list) => ({
        name: list.name,
        subreddits: list.subreddits,
        sortType: list.sortType || 'hot',
        timeFrame: list.timeFrame || 'day',
        order: list.order ?? list.timestamp ?? Date.now(),
        timestamp: list.timestamp,
      }))
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error('Error getting saved lists:', error);
    return [];
  }
}

/**
 * Save all feed presets
 */
export async function saveAllLists(presets: FeedPreset[]): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('savedLists', 'readwrite');

    // Clear existing lists
    await tx.store.clear();

    // Add all presets
    for (const preset of presets) {
      await tx.store.put({
        name: preset.name,
        subreddits: preset.subreddits,
        sortType: preset.sortType,
        timeFrame: preset.timeFrame,
        order: preset.order,
        timestamp: preset.timestamp,
      });
    }

    await tx.done;
  } catch (error) {
    console.error('Error saving lists:', error);
  }
}

// ========================================================================
// GRANULAR FAVORITES OPERATIONS (O(1) single-record IDB ops)
// ========================================================================

/**
 * Add or overwrite a single favorite record by postId.
 * O(1) — single IDB put operation, no clear+rewrite.
 */
export async function putFavorite(
  postId: string,
  data: {
    title: string;
    subreddit: string;
    thumbnailUrl?: string;
    mediaUrls?: string[];
    fullQualityUrls?: string[];
  }
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('favorites', { postId, ...data, timestamp: Date.now() });
  } catch (error) {
    console.error('Error putting favorite:', error);
  }
}

/**
 * Delete a single favorite record by postId.
 * O(1) — single IDB delete operation, no clear+rewrite.
 */
export async function deleteFavorite(postId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('favorites', postId);
  } catch (error) {
    console.error('Error deleting favorite:', error);
  }
}

// ========================================================================
// GRANULAR PRESET OPERATIONS (O(1) single-record IDB ops)
// ========================================================================

/**
 * Add or overwrite a single preset record by name.
 * O(1) — single IDB put operation, no clear+rewrite.
 */
export async function putPreset(preset: FeedPreset): Promise<void> {
  try {
    const db = await getDB();
    await db.put('savedLists', preset);
  } catch (error) {
    console.error('Error putting preset:', error);
  }
}

/**
 * Delete a single preset record by name.
 * O(1) — single IDB delete operation, no clear+rewrite.
 */
export async function deletePreset(name: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('savedLists', name);
  } catch (error) {
    console.error('Error deleting preset:', error);
  }
}

/**
 * Rename a preset: reads old record, writes new record with updated name,
 * then deletes the old record — all in a single readwrite transaction.
 * If oldName does not exist, does nothing.
 */
export async function renamePreset(oldName: string, newName: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction('savedLists', 'readwrite');
    const old = await tx.store.get(oldName);
    if (old) {
      await tx.store.put({ ...old, name: newName });
      await tx.store.delete(oldName);
    }
    await tx.done;
  } catch (error) {
    console.error('Error renaming preset:', error);
  }
}

// ========================================================================
// UTILITY
// ========================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  postsCount: number;
  favoritesCount: number;
  listsCount: number;
}> {
  try {
    const db = await getDB();
    const [postsCount, favoritesCount, listsCount] = await Promise.all([
      db.count('posts'),
      db.count('favorites'),
      db.count('savedLists'),
    ]);

    return { postsCount, favoritesCount, listsCount };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { postsCount: 0, favoritesCount: 0, listsCount: 0 };
  }
}

/**
 * Clear all data from IndexedDB
 */
export async function clearAllData(): Promise<void> {
  try {
    const db = await getDB();
    await Promise.all([
      db.clear('posts'),
      db.clear('favorites'),
      db.clear('savedLists'),
    ]);
  } catch (error) {
    console.error('Error clearing all data:', error);
  }
}
