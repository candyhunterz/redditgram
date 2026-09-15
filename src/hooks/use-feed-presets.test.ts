// src/hooks/use-feed-presets.test.ts
// Tests for useFeedPresets hook

import { renderHook, act, waitFor } from '@testing-library/react'

// Mock indexed-db module
jest.mock('@/lib/indexed-db', () => ({
  getAllSavedLists: jest.fn(),
  clearOldCache: jest.fn(),
  putPreset: jest.fn(),
  deletePreset: jest.fn(),
  renamePreset: jest.fn(),
}))

// Mock use-toast
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { useFeedPresets } from './use-feed-presets'
import {
  getAllSavedLists,
  clearOldCache,
  putPreset,
  deletePreset,
  renamePreset,
} from '@/lib/indexed-db'
import type { FeedPreset } from '@/lib/indexed-db'

const mockGetAllSavedLists = getAllSavedLists as jest.MockedFunction<typeof getAllSavedLists>
const mockClearOldCache = clearOldCache as jest.MockedFunction<typeof clearOldCache>
const mockPutPreset = putPreset as jest.MockedFunction<typeof putPreset>
const mockDeletePreset = deletePreset as jest.MockedFunction<typeof deletePreset>
const mockRenamePreset = renamePreset as jest.MockedFunction<typeof renamePreset>

const makePreset = (overrides: Partial<FeedPreset> = {}): FeedPreset => ({
  name: 'My Feed',
  subreddits: 'pics,aww',
  sortType: 'hot',
  timeFrame: 'day',
  order: 1000,
  timestamp: 1000,
  ...overrides,
})

describe('useFeedPresets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAllSavedLists.mockResolvedValue([])
    mockClearOldCache.mockResolvedValue(undefined)
    mockPutPreset.mockResolvedValue(undefined)
    mockDeletePreset.mockResolvedValue(undefined)
    mockRenamePreset.mockResolvedValue(undefined)
  })

  it('starts with empty presets, activePresetName=null, initialLoadComplete=false', () => {
    const { result } = renderHook(() => useFeedPresets())

    expect(result.current.presets).toEqual([])
    expect(result.current.activePresetName).toBeNull()
    expect(result.current.initialLoadComplete).toBe(false)
  })

  it('loads presets from IndexedDB on mount', async () => {
    const storedPresets: FeedPreset[] = [
      makePreset({ name: 'My Feed', subreddits: 'pics,aww' }),
      makePreset({ name: 'News', subreddits: 'worldnews', sortType: 'top' }),
    ]
    mockGetAllSavedLists.mockResolvedValue(storedPresets)

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true)
    })

    expect(result.current.presets).toEqual(storedPresets)
    expect(mockGetAllSavedLists).toHaveBeenCalledTimes(1)
  })

  it('sets initialLoadComplete=true even when IndexedDB returns empty array', async () => {
    mockGetAllSavedLists.mockResolvedValue([])

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true)
    })

    expect(result.current.presets).toEqual([])
  })

  it('handleSavePreset creates a new preset and persists it', async () => {
    // Mock window.prompt to return a preset name
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('My Feed')

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true))

    await act(async () => {
      await result.current.handleSavePreset('pics,aww', 'hot', 'day')
    })

    expect(mockPutPreset).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My Feed',
      subreddits: 'pics,aww',
      sortType: 'hot',
      timeFrame: 'day',
    }))
    expect(result.current.presets).toHaveLength(1)
    expect(result.current.presets[0].name).toBe('My Feed')
    expect(result.current.activePresetName).toBe('My Feed')

    promptSpy.mockRestore()
  })

  it('handleDeletePreset removes the preset and persists deletion', async () => {
    const storedPresets: FeedPreset[] = [
      makePreset({ name: 'My Feed' }),
    ]
    mockGetAllSavedLists.mockResolvedValue(storedPresets)
    // Mock window.confirm to return true
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true))
    expect(result.current.presets).toHaveLength(1)

    await act(async () => {
      await result.current.handleDeletePreset('My Feed')
    })

    expect(mockDeletePreset).toHaveBeenCalledWith('My Feed')
    expect(result.current.presets).toHaveLength(0)

    confirmSpy.mockRestore()
  })

  it('handleRenamePreset renames the preset and persists the rename', async () => {
    const storedPresets: FeedPreset[] = [
      makePreset({ name: 'Old Name' }),
    ]
    mockGetAllSavedLists.mockResolvedValue(storedPresets)
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('New Name')

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true))

    await act(async () => {
      await result.current.handleRenamePreset('Old Name')
    })

    expect(mockRenamePreset).toHaveBeenCalledWith('Old Name', 'New Name')
    expect(result.current.presets[0].name).toBe('New Name')

    promptSpy.mockRestore()
  })

  it('handleSavePreset does nothing when prompt is cancelled (returns null)', async () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null)

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => expect(result.current.initialLoadComplete).toBe(true))

    await act(async () => {
      await result.current.handleSavePreset('pics', 'hot', 'day')
    })

    expect(mockPutPreset).not.toHaveBeenCalled()
    expect(result.current.presets).toHaveLength(0)

    promptSpy.mockRestore()
  })

  it('handles IndexedDB load error gracefully — initialLoadComplete still becomes true', async () => {
    mockGetAllSavedLists.mockRejectedValue(new Error('IDB unavailable'))

    const { result } = renderHook(() => useFeedPresets())

    await waitFor(() => {
      expect(result.current.initialLoadComplete).toBe(true)
    })

    // Should not crash and presets remain empty
    expect(result.current.presets).toEqual([])
  })
})


it('does not report a preset as saved until the write commits, and reports rejection', async () => {
  jest.clearAllMocks();
  mockGetAllSavedLists.mockResolvedValue([]);
  mockClearOldCache.mockResolvedValue(undefined);
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('New');
  let reject!: (error: Error) => void;
  mockPutPreset.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const { result } = renderHook(() => useFeedPresets());
  await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));
  let pending: Promise<void> | undefined;
  act(() => { pending = result.current.handleSavePreset('pics', 'hot', 'day'); });
  expect(result.current.presets).toEqual([]);
  expect(mockToast).not.toHaveBeenCalled();
  await act(async () => { reject(new Error('Quota exceeded')); await pending; });
  expect(result.current.presets).toEqual([]);
  expect(result.current.activePresetName).toBeNull();
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  prompt.mockRestore();
});

it.each(['delete', 'rename', 'update'])('retains saved presets when %s fails', async operation => {
  jest.clearAllMocks();
  mockGetAllSavedLists.mockResolvedValue([makePreset()]);
  mockClearOldCache.mockResolvedValue(undefined);
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue('Renamed');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  const { result } = renderHook(() => useFeedPresets());
  await waitFor(() => expect(result.current.initialLoadComplete).toBe(true));
  const failure = new Error('Storage unavailable');
  await act(async () => {
    if (operation === 'delete') {
      mockDeletePreset.mockRejectedValueOnce(failure);
      await result.current.handleDeletePreset('My Feed');
    } else if (operation === 'rename') {
      mockRenamePreset.mockRejectedValueOnce(failure);
      await result.current.handleRenamePreset('My Feed');
    } else {
      mockPutPreset.mockRejectedValueOnce(failure);
      await result.current.handleUpdatePreset('My Feed', 'cats', 'top', 'year');
    }
  });
  expect(result.current.presets).toEqual([makePreset()]);
  expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  prompt.mockRestore(); confirm.mockRestore();
});
