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
