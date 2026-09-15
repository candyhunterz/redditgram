import { useState, useCallback, useEffect, useRef } from 'react';
import type { RedditPost } from '@/types/reddit';
import type { FavoritePostInfo, FavoritesMap } from '@/types/reddit';
import {
  getAllFavorites,
  putFavorite,
  deleteFavorite,
} from '@/lib/indexed-db';
import { useToast } from '@/hooks/use-toast';

/**
 * Manages favorites state with granular IndexedDB persistence.
 *
 * On add: calls putFavorite (O(1) single IDB put) then updates state.
 * On remove: calls deleteFavorite (O(1) single IDB delete) then updates state.
 * No bulk clear-and-rewrite — every write is a single-record operation.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritesMap>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoritesLoadComplete, setFavoritesLoadComplete] = useState(false);
  const { toast } = useToast();
  const pending = useRef(new Set<string>());
  const current = useRef<FavoritesMap>({});

  // Load favorites from IndexedDB on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getAllFavorites();
        if (Object.keys(favs).length > 0) {
          current.current = favs as FavoritesMap;
          setFavorites(current.current);
        }
        setFavoritesLoadComplete(true);
      } catch (err) {
        console.error('Failed to load favorites:', err);
        setFavoritesLoadComplete(true);
      }
    };
    loadFavorites();
  }, []);

  /**
   * Toggle a post in/out of favorites.
   * Uses granular putFavorite / deleteFavorite — no bulk save.
   */
  const toggleFavorite = useCallback(async (post: RedditPost) => {
    const postId = post.postId;
    if (!favoritesLoadComplete || pending.current.has(postId)) return;
    pending.current.add(postId);
    try {
      const removing = !!current.current[postId];
      const data: FavoritePostInfo = {
        postId, title: post.title, subreddit: post.subreddit,
        thumbnailUrl: post.mediaUrls?.[0], mediaUrls: post.mediaUrls || [],
        fullQualityUrls: post.fullQualityUrls || post.mediaUrls || [],
        videoManifestUrl: post.videoManifestUrl,
      };
      if (removing) await deleteFavorite(postId);
      else await putFavorite(postId, data);
      const updated = { ...current.current };
      if (removing) delete updated[postId];
      else updated[postId] = data;
      current.current = updated;
      setFavorites(updated);
      toast({ description: removing ? 'Removed from favorites' : 'Added to favorites' });
    } catch {
      toast({ variant: 'destructive', description: 'Could not save favorites. Please try again.' });
    } finally {
      pending.current.delete(postId);
    }
  }, [toast, favoritesLoadComplete]);

  return {
    favorites,
    showFavoritesOnly,
    setShowFavoritesOnly,
    favoritesLoadComplete,
    toggleFavorite,
  };
}
