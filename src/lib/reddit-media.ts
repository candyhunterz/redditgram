import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { isVideoUrl, mediaExtension } from './media';

const clean = (url: string) => url.replace(/&amp;/g, '&');

/** Keep gallery entries aligned between the grid and expanded view. */
export function extractRedditMedia(post: any, fullQuality = false): string[] {
  if (!post) return [];
  if (post.is_gallery && post.gallery_data?.items && post.media_metadata) {
    const urls = post.gallery_data.items.flatMap((item: any) => {
      const meta = post.media_metadata[item.media_id];
      if (!meta) return [];
      const original = meta.s?.gif || meta.s?.u || meta.s?.mp4;
      const previews = meta.p || [];
      const largest = previews[previews.length - 1]?.u;
      const url = fullQuality
        ? original || largest
        : previews[Math.min(2, previews.length - 1)]?.u || original;
      return url ? [clean(url)] : [];
    });
    if (urls.length) return urls;
  }

  const original = post.url_overridden_by_dest || post.url;
  const extension = original ? mediaExtension(original) : '';
  // An actual image/GIF source takes precedence over a transcoded video preview.
  if (original && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    const thumbnail = extension === 'gif' && !fullQuality
      ? post.preview?.images?.[0]?.resolutions?.[0]?.url
      : undefined;
    return [clean(thumbnail || original)];
  }
  if (original && isVideoUrl(original)) return [clean(original)];

  const preview = post.preview?.images?.[0];
  if (fullQuality && preview?.variants?.gif?.source?.url) {
    return [clean(preview.variants.gif.source.url)];
  }
  const video = post.media?.reddit_video || post.secure_media?.reddit_video;
  const fallback = video?.fallback_url || post.preview?.reddit_video_preview?.fallback_url;
  if (fallback && isVideoUrl(fallback)) return [clean(fallback)];
  const embed = post.media?.oembed || post.secure_media?.oembed;
  const thumbnail = embed?.thumbnail_url;
  if (thumbnail && ['jpg', 'jpeg', 'png'].includes(mediaExtension(thumbnail))) return [clean(thumbnail)];
  return preview?.source?.url ? [clean(preview.source.url)] : [];
}

function redditVideoUrl(value: string, base?: string): URL | null {
  try {
    const url = new URL(clean(value), base);
    return url.protocol === 'https:' && url.hostname === 'v.redd.it' &&
      !url.username && !url.password && (!url.port || url.port === '443') ? url : null;
  } catch { return null; }
}

const array = (value: any): any[] => value == null ? [] : Array.isArray(value) ? value : [value];

/** Select complete H.264 MP4 files, not audio tracks or segmented-only streams. */
export function bestRedditVideo(xml: string, manifestUrl: string, fallback: string, fallbackHeight = 0): string {
  if (xml.includes('<!DOCTYPE') || XMLValidator.validate(xml) !== true) return fallback;
  let best = { url: fallback, height: fallbackHeight, bandwidth: 0 };
  const baseUrl = (node: any, parent: string) => {
    const base = array(node?.BaseURL)[0];
    const text = typeof base === 'string' ? base : base?.['#text'];
    return text ? new URL(text, parent).href : parent;
  };
  try {
    const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
    const mpd = parsed.MPD;
    const rootBase = baseUrl(mpd, manifestUrl);
    for (const period of array(mpd?.Period)) {
      const periodBase = baseUrl(period, rootBase);
      for (const set of array(period.AdaptationSet)) {
        const setBase = baseUrl(set, periodBase);
        for (const rep of array(set.Representation)) {
          const mime = rep['@_mimeType'] || set['@_mimeType'];
          const codec = rep['@_codecs'] || set['@_codecs'] || '';
          if (mime !== 'video/mp4' || !/^avc[13]\./i.test(codec)) continue;
          if (rep.SegmentTemplate || set.SegmentTemplate || period.SegmentTemplate || rep.SegmentList || set.SegmentList) continue;
          const url = redditVideoUrl(baseUrl(rep, setBase));
          const height = Number(rep['@_height'] || set['@_height'] || 0);
          const bandwidth = Number(rep['@_bandwidth'] || 0);
          if (url && isVideoUrl(url.href) && height > 0 &&
              (height > best.height || (height === best.height && bandwidth > best.bandwidth))) {
            best = { url: url.href, height, bandwidth };
          }
        }
      }
    }
  } catch { return fallback; }
  return best.url;
}

export async function fullQualityRedditMedia(post: any): Promise<string[]> {
  const urls = extractRedditMedia(post, true);
  const video = post?.media?.reddit_video || post?.secure_media?.reddit_video || post?.preview?.reddit_video_preview;
  // Never replace an original GIF or a gallery with a video preview.
  if (post?.is_gallery || urls.length !== 1 || !isVideoUrl(urls[0]) || !video?.dash_url ||
      urls[0] !== clean(video.fallback_url || '')) return urls;
  const manifest = redditVideoUrl(video.dash_url);
  if (!manifest) return urls;
  try {
    const response = await fetch(manifest.href, {
      signal: AbortSignal.timeout(3000), redirect: 'error', next: { revalidate: 3600 },
    });
    if (!response.ok) return urls;
    const xml = await response.text();
    if (xml.length > 1_000_000) return urls;
    return [bestRedditVideo(xml, manifest.href, urls[0], Number(video.height) || 0)];
  } catch { return urls; }
}

/** Only native Reddit video streams need a separate audio/video manifest. */
export function redditVideoManifest(post: any): string | undefined {
  const urls = extractRedditMedia(post, true);
  const video = post?.media?.reddit_video || post?.secure_media?.reddit_video || post?.preview?.reddit_video_preview;
  if (post?.is_gallery || urls.length !== 1 || !isVideoUrl(urls[0]) || !video?.dash_url) return;
  return redditVideoUrl(video.dash_url)?.href;
}
