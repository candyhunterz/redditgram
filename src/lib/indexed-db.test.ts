// src/lib/indexed-db.test.ts
// Tests for granular IndexedDB operations in indexed-db.ts

// Mock the entire idb module so tests run without a real browser IndexedDB
jest.mock('idb', () => {
  // In-memory stores per test run
  const stores: { [storeName: string]: { [key: string]: any } } = {
    favorites: {},
    savedLists: {},
    posts: {},
  };

  const makeStore = (storeName: string) => ({
    put: jest.fn(async (value: any) => {
      const keyPath =
        storeName === 'favorites' ? 'postId' :
        storeName === 'savedLists' ? 'name' :
        'cacheKey';
      stores[storeName][value[keyPath]] = value;
    }),
    delete: jest.fn(async (key: string) => {
      delete stores[storeName][key];
    }),
    get: jest.fn(async (key: string) => stores[storeName][key] ?? undefined),
    getAll: jest.fn(async () => Object.values(stores[storeName])),
    count: jest.fn(async () => Object.keys(stores[storeName]).length),
    clear: jest.fn(async () => {
      Object.keys(stores[storeName]).forEach(k => delete stores[storeName][k]);
    }),
    index: jest.fn(() => ({
      openCursor: jest.fn(async () => null),
    })),
  });

  // Build a mock transaction that exposes the same methods directly
  const makeTx = (storeName: string, _mode: string) => {
    const store = makeStore(storeName);
    return {
      store,
      done: Promise.resolve(),
    };
  };

  // db mock returned by openDB
  const makeDB = () => {
    const db = {
      put: jest.fn(async (storeName: string, value: any) => {
        const keyPath =
          storeName === 'favorites' ? 'postId' :
          storeName === 'savedLists' ? 'name' :
          'cacheKey';
        stores[storeName][value[keyPath]] = value;
      }),
      delete: jest.fn(async (storeName: string, key: string) => {
        delete stores[storeName][key];
      }),
      get: jest.fn(async (storeName: string, key: string) => stores[storeName][key] ?? undefined),
      getAll: jest.fn(async (storeName: string) => Object.values(stores[storeName])),
      count: jest.fn(async (storeName: string) => Object.keys(stores[storeName]).length),
      clear: jest.fn(async (storeName: string) => {
        Object.keys(stores[storeName]).forEach(k => delete stores[storeName][k]);
      }),
      transaction: jest.fn((storeName: string, mode: string) => {
        return makeTx(storeName, mode);
      }),
    };
    return db;
  };

  return {
    openDB: jest.fn(async (_name: string, _version: number, _callbacks: any) => makeDB()),
  };
});

// Re-require after mocking so module uses mocked idb
import {
  putFavorite,
  deleteFavorite,
  putPreset,
  deletePreset,
  renamePreset,
} from '@/lib/indexed-db';

import { FeedPreset } from '@/lib/indexed-db';

// ============================================================
// Helper factories
// ============================================================
const makeFavoriteData = (overrides = {}) => ({
  title: 'Test Post',
  subreddit: 'pics',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  mediaUrls: ['https://example.com/media.jpg'],
  fullQualityUrls: ['https://example.com/hq.jpg'],
  ...overrides,
});

const makePreset = (overrides: Partial<FeedPreset> = {}): FeedPreset => ({
  name: 'My Preset',
  subreddits: 'pics,aww',
  sortType: 'hot',
  timeFrame: 'day',
  order: 1000,
  timestamp: 1000,
  ...overrides,
});

// ============================================================
// putFavorite
// ============================================================
describe('putFavorite', () => {
  it('adds a single favorite record to the favorites store', async () => {
    const data = makeFavoriteData();
    await expect(putFavorite('post123', data)).resolves.toBeUndefined();
  });

  it('overwrites an existing favorite with the same postId', async () => {
    const original = makeFavoriteData({ title: 'Original' });
    await putFavorite('post-overwrite', original);

    const updated = makeFavoriteData({ title: 'Updated' });
    await expect(putFavorite('post-overwrite', updated)).resolves.toBeUndefined();
  });

  it('handles missing optional fields (mediaUrls, fullQualityUrls)', async () => {
    const data = makeFavoriteData({ mediaUrls: undefined, fullQualityUrls: undefined });
    await expect(putFavorite('post-minimal', data)).resolves.toBeUndefined();
  });
});

// ============================================================
// deleteFavorite
// ============================================================
describe('deleteFavorite', () => {
  it('deletes a single favorite record by postId', async () => {
    await putFavorite('post-to-delete', makeFavoriteData());
    await expect(deleteFavorite('post-to-delete')).resolves.toBeUndefined();
  });

  it('does not throw when postId does not exist', async () => {
    await expect(deleteFavorite('nonexistent-post-id')).resolves.toBeUndefined();
  });
});

// ============================================================
// putPreset
// ============================================================
describe('putPreset', () => {
  it('adds a single preset to the savedLists store', async () => {
    const preset = makePreset({ name: 'New Preset' });
    await expect(putPreset(preset)).resolves.toBeUndefined();
  });

  it('overwrites an existing preset with the same name', async () => {
    const original = makePreset({ name: 'Overwrite Me', subreddits: 'pics' });
    await putPreset(original);

    const updated = makePreset({ name: 'Overwrite Me', subreddits: 'aww,funny' });
    await expect(putPreset(updated)).resolves.toBeUndefined();
  });
});

// ============================================================
// deletePreset
// ============================================================
describe('deletePreset', () => {
  it('deletes a single preset by name', async () => {
    await putPreset(makePreset({ name: 'Delete Me' }));
    await expect(deletePreset('Delete Me')).resolves.toBeUndefined();
  });

  it('does not throw when name does not exist', async () => {
    await expect(deletePreset('this-preset-does-not-exist')).resolves.toBeUndefined();
  });
});

// ============================================================
// renamePreset
// ============================================================
describe('renamePreset', () => {
  it('reads old record, writes new record with updated name, deletes old record', async () => {
    const preset = makePreset({ name: 'Old Name', subreddits: 'pics,aww' });
    await putPreset(preset);
    await expect(renamePreset('Old Name', 'New Name')).resolves.toBeUndefined();
  });

  it('does not throw when oldName does not exist', async () => {
    await expect(renamePreset('ghost-preset', 'new-ghost-name')).resolves.toBeUndefined();
  });

  it('preserves all other fields when renaming (subreddits, sortType, timeFrame, order, timestamp)', async () => {
    const preset: FeedPreset = {
      name: 'Preserve Fields',
      subreddits: 'earthporn,cityporn',
      sortType: 'top',
      timeFrame: 'week',
      order: 9999,
      timestamp: 12345,
    };
    await putPreset(preset);
    await expect(renamePreset('Preserve Fields', 'Renamed')).resolves.toBeUndefined();
  });
});
