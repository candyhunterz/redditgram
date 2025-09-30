/**
 * Progressive Image Component
 * Shows a blurred placeholder while the full image loads
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  alt,
  className,
  loading = 'lazy',
  onLoad,
  onError,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Create a tiny thumbnail URL from Reddit's CDN
  // Reddit provides different sizes, we can try to construct a smaller version
  const thumbnailSrc = src.replace(/\.(jpg|jpeg|png|gif|webp)$/i, 'm.$1');

  useEffect(() => {
    // If image is already cached, it will load immediately
    if (imgRef.current?.complete) {
      setImageLoaded(true);
    }
  }, []);

  const handleLoad = () => {
    setImageLoaded(true);
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
    <div className="relative w-full h-full overflow-hidden">
      {/* Blurred placeholder - shows until main image loads */}
      {!imageLoaded && (
        <img
          src={thumbnailSrc}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover blur-xl scale-110 transition-opacity duration-300',
            imageLoaded ? 'opacity-0' : 'opacity-100',
            className
          )}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          imageLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Loading shimmer effect */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      )}
    </div>
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
