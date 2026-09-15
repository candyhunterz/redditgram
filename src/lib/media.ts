/** Extensions belong to URL paths, not query strings or fragments. */
export function mediaExtension(url: string): string {
  try {
    return new URL(url).pathname.split('.').pop()?.toLowerCase() || '';
  } catch {
    return '';
  }
}

export function isVideoUrl(url?: string): boolean {
  return !!url && mediaExtension(url) === 'mp4';
}

/** Recover the stream for saved posts created before manifests were persisted. */
export function redditDashManifest(src?: string): string | undefined {
  if (!src) return;
  try {
    const url = new URL(src);
    if (url.protocol === 'https:' && url.hostname === 'v.redd.it' &&
        /^\/[a-z0-9]+\/DASH_[^/]+\.mp4$/i.test(url.pathname)) {
      return new URL('DASHPlaylist.mpd', url).href;
    }
  } catch { /* Non-URL sources have no Reddit stream. */ }
}
