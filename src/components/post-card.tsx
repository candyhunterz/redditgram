'use client';

import React, { useCallback } from 'react';
import { isVideoUrl } from '@/lib/media';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Video, Copy as GalleryIcon, ArrowUpCircle, MessageCircle } from 'lucide-react';
import { formatRelativeTime, formatNumber } from '@/lib/format-time';
import { MediaCarousel } from '@/components/media-carousel';
import type { RedditPost } from '@/types/reddit';

interface PostCardProps {
  post: RedditPost;
  isFavorite: boolean;
  onToggleFavorite: (post: RedditPost) => void;
  onClick: (post: RedditPost) => void;
  showMetadata: boolean;
  gap: number;
}

export const PostCard = React.memo(React.forwardRef<HTMLDivElement, PostCardProps>(
  function PostCard({ post, isFavorite, onToggleFavorite, onClick, gap, showMetadata }, ref) {
    const firstUrl = post?.mediaUrls?.[0];
    const isVideoPost = isVideoUrl(firstUrl);
    const isGalleryPost = post?.mediaUrls?.length > 1;
    const isUnplayable = post.isUnplayableVideoFormat ?? false;
    const mediaType = isVideoPost ? 'video' : isGalleryPost ? 'gallery' : 'image';

    const toggleFavorite = useCallback(() => onToggleFavorite(post), [onToggleFavorite, post]);

    return (
      <div
        ref={ref}
        style={{ marginBottom: `${gap}px` }}
        role="listitem"
      >
        <Card
          onClick={() => !isUnplayable && onClick(post)}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && !isUnplayable && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onClick(post);
            }
          }}
          tabIndex={isUnplayable ? -1 : 0}
          role="button"
          aria-label={`${post.title} - ${mediaType} from r/${post.subreddit}${post.ups ? `, ${formatNumber(post.ups)} upvotes` : ''}${isFavorite ? ', favorited' : ''}`}
          className={cn(
            'group relative overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            !isUnplayable && 'hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer',
            isUnplayable && 'cursor-default'
          )}
        >
          {/* Indicators */}
          {(isVideoPost || isGalleryPost || isUnplayable) && (
            <div className="absolute top-1 right-1 z-20 p-1 rounded-full bg-black/40 text-white transition-opacity opacity-70 group-hover:opacity-100">
              {isUnplayable ? (
                <Video className="h-3 w-3 opacity-70" />
              ) : isVideoPost ? (
                <Video className="h-3 w-3" />
              ) : (
                <GalleryIcon className="h-3 w-3" />
              )}
            </div>
          )}
          {/* Metadata Overlay */}
          {showMetadata && <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-0.5" title="Upvotes">
                  <ArrowUpCircle className="h-3 w-3" />
                  {formatNumber(post.ups ?? 0)}
                </span>
                <span className="flex items-center gap-0.5" title="Comments">
                  <MessageCircle className="h-3 w-3" />
                  {formatNumber(post.numComments ?? 0)}
                </span>
              </div>
              {post.createdUtc && (
                <span
                  className="text-white/80"
                  title={new Date((post.createdUtc ?? 0) * 1000).toLocaleString()}
                >
                  {formatRelativeTime(post.createdUtc)}
                </span>
              )}
            </div>
          </div>}
          {/* Grid Item Media Carousel */}
          <MediaCarousel
            mediaUrls={post.mediaUrls}
            fullQualityUrls={post.fullQualityUrls}
            title={post.title}
            subreddit={post.subreddit}
            postId={post.postId}
            isUnplayableVideoFormat={isUnplayable}
            onToggleFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        </Card>
      </div>
    );
  }
));

PostCard.displayName = 'PostCard';
