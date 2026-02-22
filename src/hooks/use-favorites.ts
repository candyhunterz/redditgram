import { useState, useCallback, useEffect } from 'react';
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

  // Load favorites from IndexedDB on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favs = await getAllFavorites();
        if (Object.keys(favs).length > 0) {
          setFavorites(favs as FavoritesMap);
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
    setFavorites(currentFavorites => {
      const newFavorites = { ...currentFavorites };
      if (!currentFavorites[postId]) {
        // Add to favorites
        const data: FavoritePostInfo = {
          postId,
          title: post.title,
          subreddit: post.subreddit,
          thumbnailUrl: post.mediaUrls?.[0],
          mediaUrls: post.mediaUrls || [],
          fullQualityUrls: post.fullQualityUrls || post.mediaUrls || [],
        };
        newFavorites[postId] = data;
        // Granular IDB write (fire-and-forget; errors logged inside putFavorite)
        putFavorite(postId, {
          title: data.title,
          subreddit: data.subreddit,
          thumbnailUrl: data.thumbnailUrl,
          mediaUrls: data.mediaUrls,
          fullQualityUrls: data.fullQualityUrls,
        });
        toast({ description: 'Added to favorites' });
      } else {
        // Remove from favorites
        delete newFavorites[postId];
        deleteFavorite(postId);
        toast({ description: 'Removed from favorites' });
      }
      return newFavorites;
    });
  }, [toast]);

  return {
    favorites,
    showFavoritesOnly,
    setShowFavoritesOnly,
    favoritesLoadComplete,
    toggleFavorite,
  };
}
