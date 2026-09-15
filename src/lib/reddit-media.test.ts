/** @jest-environment node */
import { bestRedditVideo, extractRedditMedia, fullQualityRedditMedia, redditVideoManifest } from './reddit-media';

const fallback = 'https://v.redd.it/id/DASH_480.mp4?source=fallback';
const manifest = 'https://v.redd.it/id/DASHPlaylist.mpd';
const xml = `<MPD><Period><AdaptationSet mimeType="video/mp4" codecs="avc1.640028">
  <Representation height="720" bandwidth="2000"><BaseURL>DASH_720.mp4</BaseURL></Representation>
  <Representation height="1080" bandwidth="3000"><BaseURL>DASH_1080.mp4?x=1&amp;y=2</BaseURL></Representation>
  <Representation height="2160" codecs="av01.0.12M.08"><BaseURL>av1.mp4</BaseURL></Representation>
  </AdaptationSet><AdaptationSet mimeType="audio/mp4">
  <Representation bandwidth="99999"><BaseURL>audio.mp4</BaseURL></Representation>
  </AdaptationSet></Period></MPD>`;

it('preserves gallery order, originals, animation, and preview fallbacks', () => {
  const post = {
    is_gallery: true, gallery_data: { items: ['a', 'b', 'c', 'd'].map(media_id => ({ media_id })) },
    media_metadata: {
      a: { p: [{ u: 'small.jpg' }, { u: 'large.jpg' }], s: { u: 'original.jpg?x=1&amp;y=2' } },
      b: { p: [{ u: 'still.jpg' }], s: { gif: 'animated.gif', mp4: 'transcoded.mp4' } },
      c: { p: [{ u: 'only-preview.jpg' }] },
      d: { s: { mp4: 'animation.mp4' } },
    },
  };
  expect(extractRedditMedia(post)).toEqual(['large.jpg', 'still.jpg', 'only-preview.jpg', 'animation.mp4']);
  expect(extractRedditMedia(post, true)).toEqual(['original.jpg?x=1&y=2', 'animated.gif', 'only-preview.jpg', 'animation.mp4']);
});

it('prefers original GIFs over MP4 previews while keeping feed thumbnails', async () => {
  const post = { url: 'https://i.redd.it/animation.gif', preview: {
    reddit_video_preview: { fallback_url: fallback, dash_url: manifest },
    images: [{ resolutions: [{ url: 'https://preview.redd.it/still.jpg' }] }],
  } };
  expect(extractRedditMedia(post)).toEqual(['https://preview.redd.it/still.jpg']);
  expect(await fullQualityRedditMedia(post)).toEqual([post.url]);
});

it('uses a GIF variant when the destination is not a direct media URL', () => {
  expect(extractRedditMedia({ url: 'https://example.com/post', preview: {
    reddit_video_preview: { fallback_url: fallback },
    images: [{ variants: { gif: { source: { url: 'https://preview.redd.it/animated.gif' } } } }],
  } }, true)).toEqual(['https://preview.redd.it/animated.gif']);
});

it('selects the highest compatible video resolution and decodes URL entities', () => {
  expect(bestRedditVideo(xml, manifest, fallback, 480)).toBe('https://v.redd.it/id/DASH_1080.mp4?x=1&y=2');
  expect(bestRedditVideo(xml, manifest, fallback, 1440)).toBe(fallback);
});

it('rejects unsafe URLs, segmented streams, and malformed manifests', () => {
  for (const body of [
    '<MPD><broken>',
    xml.replace(/DASH_\d+\.mp4/g, 'https://evil.example/video.mp4'),
    xml.replace('<AdaptationSet mimeType="video/mp4"', '<AdaptationSet><SegmentTemplate media="chunk-$Number$.m4s" /></AdaptationSet><AdaptationSet mimeType="video/mp4"').replace(/<BaseURL>/g, '<SegmentTemplate media="chunk.m4s" /><BaseURL>'),
  ]) expect(bestRedditVideo(body, manifest, fallback, 480)).toBe(fallback);
});

it('upgrades video from its manifest and retains fallback on network failure', async () => {
  const saved = global.fetch;
  const fetchMock = jest.fn().mockResolvedValueOnce(new Response(xml)).mockRejectedValueOnce(new Error('offline'));
  global.fetch = fetchMock;
  const post = { media: { reddit_video: { fallback_url: fallback, dash_url: manifest, height: 480 } } };
  try {
    expect(await fullQualityRedditMedia(post)).toEqual(['https://v.redd.it/id/DASH_1080.mp4?x=1&y=2']);
    expect(await fullQualityRedditMedia(post)).toEqual([fallback]);
    expect(await fullQualityRedditMedia({ media: { reddit_video: { ...post.media.reddit_video, dash_url: 'http://localhost/private' } } })).toEqual([fallback]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  } finally { global.fetch = saved; }
});


it('preserves native streaming manifests without replacing original GIF playback', () => {
  const video = { media: { reddit_video: { fallback_url: fallback, dash_url: manifest } } };
  expect(redditVideoManifest(video)).toBe(manifest);
  expect(redditVideoManifest({ ...video, url: 'https://i.redd.it/original.gif' })).toBeUndefined();
  expect(redditVideoManifest({ media: { reddit_video: { fallback_url: fallback, dash_url: 'http://localhost/private' } } })).toBeUndefined();
});
