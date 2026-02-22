import { useState, useCallback, useEffect } from 'react';
import type { SortType, TimeFrame } from '@/types/reddit';
import {
  FeedPreset,
  getAllSavedLists,
  clearOldCache,
  putPreset,
  deletePreset,
  renamePreset,
} from '@/lib/indexed-db';
import { useToast } from '@/hooks/use-toast';

/**
 * Manages feed presets CRUD with granular IndexedDB persistence.
 *
 * Each handler calls a single-record IDB operation (putPreset, deletePreset,
 * renamePreset) instead of a bulk clear-and-rewrite.
 *
 * window.prompt() and window.confirm() for user input are intentionally
 * inside the handlers — they are part of the business logic.
 */
export function useFeedPresets() {
  const [presets, setPresets] = useState<FeedPreset[]>([]);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { toast } = useToast();

  // Load presets from IndexedDB on mount (also clears old post cache)
  useEffect(() => {
    const loadLists = async () => {
      try {
        await clearOldCache();
        const loadedPresets = await getAllSavedLists();
        if (loadedPresets.length > 0) {
          setPresets(loadedPresets);
        }
        setInitialLoadComplete(true);
      } catch (err) {
        console.error('Failed to load presets:', err);
        setInitialLoadComplete(true);
      }
    };
    loadLists();
  }, []);

  /**
   * Save current feed params as a new named preset.
   * Accepts subredditInput, sortType, timeFrame as arguments so the hook
   * does not need to close over page-level state.
   */
  const handleSavePreset = useCallback((
    subredditInput: string,
    sortType: SortType,
    timeFrame: TimeFrame,
  ) => {
    const currentInput = subredditInput.trim();
    if (!currentInput) {
      toast({ variant: 'destructive', description: 'Input field is empty.' });
      return;
    }
    const presetName = window.prompt('Enter a name for this preset:', '');
    if (presetName === null) return;
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      toast({ variant: 'destructive', description: 'Preset name cannot be empty.' });
      return;
    }
    if (presets.some(p => p.name === trimmedName)) {
      toast({ variant: 'destructive', description: `A preset named "${trimmedName}" already exists.` });
      return;
    }
    const newPreset: FeedPreset = {
      name: trimmedName,
      subreddits: currentInput,
      sortType,
      timeFrame,
      order: Date.now(),
      timestamp: Date.now(),
    };
    putPreset(newPreset);
    setPresets(prev => [...prev, newPreset]);
    setActivePresetName(trimmedName);
    toast({ description: `Preset "${trimmedName}" saved.` });
  }, [presets, toast]);

  /**
   * Load a preset: updates activePresetName and returns the preset so the
   * caller (page.tsx) can set its own subredditInput, sortType, timeFrame,
   * and trigger a fetch. The hook does NOT call fetchInitialPosts directly.
   */
  const handleLoadPreset = useCallback((preset: FeedPreset) => {
    setActivePresetName(preset.name);
    return preset;
  }, []);

  /**
   * Overwrite a preset with new feed params.
   */
  const handleUpdatePreset = useCallback((
    presetName: string,
    subredditInput: string,
    sortType: SortType,
    timeFrame: TimeFrame,
  ) => {
    const currentInput = subredditInput.trim();
    if (!currentInput) {
      toast({ variant: 'destructive', description: 'Input field is empty.' });
      return;
    }
    setPresets(prev => {
      const updated = prev.map(p =>
        p.name === presetName
          ? { ...p, subreddits: currentInput, sortType, timeFrame, timestamp: Date.now() }
          : p
      );
      const updatedPreset = updated.find(p => p.name === presetName);
      if (updatedPreset) {
        putPreset(updatedPreset);
      }
      return updated;
    });
    toast({ description: `Preset "${presetName}" updated.` });
  }, [toast]);

  /**
   * Delete a preset by name.
   */
  const handleDeletePreset = useCallback((presetName: string) => {
    if (window.confirm(`Delete preset "${presetName}"?`)) {
      deletePreset(presetName);
      setPresets(prev => prev.filter(p => p.name !== presetName));
      setActivePresetName(prev => (prev === presetName ? null : prev));
      toast({ description: `Preset "${presetName}" deleted.` });
    }
  }, [toast]);

  /**
   * Rename a preset. Uses the atomic renamePreset IDB transaction.
   */
  const handleRenamePreset = useCallback((oldName: string) => {
    const newName = window.prompt('Enter new name:', oldName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', description: 'Name cannot be empty.' });
      return;
    }
    if (trimmed !== oldName && presets.some(p => p.name === trimmed)) {
      toast({ variant: 'destructive', description: `A preset named "${trimmed}" already exists.` });
      return;
    }
    renamePreset(oldName, trimmed);
    setPresets(prev => prev.map(p => p.name === oldName ? { ...p, name: trimmed } : p));
    setActivePresetName(prev => (prev === oldName ? trimmed : prev));
    toast({ description: `Preset renamed to "${trimmed}".` });
  }, [presets, toast]);

  return {
    presets,
    activePresetName,
    setActivePresetName,
    initialLoadComplete,
    handleSavePreset,
    handleLoadPreset,
    handleUpdatePreset,
    handleDeletePreset,
    handleRenamePreset,
  };
}
