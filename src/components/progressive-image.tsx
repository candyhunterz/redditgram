/**
 * Progressive Image Component
 * Uses next/image for automatic WebP conversion, responsive sizing, and lazy loading.
 * Shows a blur placeholder while the full image loads.
 */

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  unoptimized?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const optimizedHosts = new Set(['i.redd.it', 'preview.redd.it', 'external-preview.redd.it', 'i.imgur.com', 'v.redd.it']);
function canOptimize(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && optimizedHosts.has(url.hostname);
  } catch {
    return false;
  }
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
  unoptimized = false,
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
      unoptimized={unoptimized || !canOptimize(src)}
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
  manifestUrl?: string;
  fallbackSrc?: string;
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
  manifestUrl,
  fallbackSrc,
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
  const [useFallback, setUseFallback] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!manifestUrl || streamFailed) return;
    let disposed = false;
    let player: import('dashjs').MediaPlayerClass | undefined;
    const fail = () => {
      if (!disposed) setStreamFailed(true);
    };
    // Load streaming code only when opening a Reddit video in the detailed view.
    void import('dashjs').then(dash => {
      if (disposed || !videoRef.current) return;
      player = dash.MediaPlayer().create();
      player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
      player.on(dash.MediaPlayer.events.STREAM_INITIALIZED, () => {
        if (!player || disposed) return;
        const representations = player.getRepresentationsByType('video');
        const best = [...representations].sort((a, b) =>
          (b.height - a.height) || (b.bitrateInKbit - a.bitrateInKbit))[0];
        if (best) player.setRepresentationForTypeById('video', best.id, true);
      });
      player.on(dash.MediaPlayer.events.ERROR, (event: { error?: { code?: number } }) => {
        if (event.error?.code !== dash.MediaPlayer.errors.TIME_SYNC_FAILED_ERROR_CODE) fail();
      });
      player.initialize(videoRef.current, manifestUrl, autoPlay);
    }).catch(fail);
    return () => {
      disposed = true;
      player?.reset();
    };
  }, [manifestUrl, autoPlay, streamFailed]);

  const handleLoadedData = () => {
    setVideoLoaded(true);
  };

  const handleError = () => {
    if (manifestUrl && !streamFailed) {
      setStreamFailed(true);
      return;
    }
    if (!useFallback && fallbackSrc && fallbackSrc !== src) {
      setUseFallback(true);
      setVideoLoaded(false);
      return;
    }
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}

      <video
        key={manifestUrl && !streamFailed ? 'stream' : 'mp4'}
        ref={videoRef}
        src={manifestUrl && !streamFailed ? undefined : useFallback ? fallbackSrc : src}
        className={cn('w-full h-full object-contain transition-opacity duration-300', className)}
        controls={controls}
        muted={muted}
        playsInline={playsInline}
        autoPlay={autoPlay}
        loop={loop}
        preload={preload}
        poster={poster}
        onLoadedMetadata={handleLoadedData}
        onLoadedData={handleLoadedData}
        onError={handleError}
      />
      {streamFailed && !videoError && (
        <p className="absolute bottom-16 left-2 right-2 text-center text-xs text-white bg-black/70 p-2">
          Streaming unavailable. Playing the MP4 fallback, which may have no audio.
        </p>
      )}
    </div>
  );
};
