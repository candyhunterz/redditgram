/**
 * Progressive Image Component
 * Uses next/image for automatic WebP conversion, responsive sizing, and lazy loading.
 * Shows a blur placeholder while the full image loads.
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

// Neutral gray SVG used as blur placeholder while image loads.
// Zero network requests; next/image applies CSS blur automatically.
const blurDataURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="%23888"/></svg>'
)}`;

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className,
  loading = 'lazy',
  onLoad,
  onError,
}) => {
  const [imageError, setImageError] = useState(false);

  const handleLoad = () => {
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  if (imageError) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-300 dark:bg-gray-700', className)}>
        <span className="text-muted-foreground text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      loading={loading}
      placeholder="blur"
      blurDataURL={blurDataURL}
      className={cn('object-cover', className)}
      style={{ width: '100%', height: 'auto' }}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
};

// Video component with loading state
interface ProgressiveVideoProps {
  src: string;
  className?: string;
  controls?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  poster?: string;
}

export const ProgressiveVideo: React.FC<ProgressiveVideoProps> = ({
  src,
  className,
  controls = false,
  muted = true,
  playsInline = true,
  autoPlay = false,
  loop = true,
  preload = 'metadata',
  poster,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const handleLoadedData = () => {
    setVideoLoaded(true);
  };

  const handleError = () => {
    setVideoError(true);
  };

  if (videoError) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-900', className)}>
        <span className="text-white text-sm">Failed to load video</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Loading indicator */}
      {!videoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <video
        src={src}
        className={cn('w-full h-full object-contain transition-opacity duration-300', className)}
        controls={controls}
        muted={muted}
        playsInline={playsInline}
        autoPlay={autoPlay}
        loop={loop}
        preload={preload}
        poster={poster}
        onLoadedData={handleLoadedData}
        onError={handleError}
      />
    </div>
  );
};
