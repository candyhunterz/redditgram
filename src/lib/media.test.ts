import { isVideoUrl, mediaExtension, redditDashManifest } from './media';
import { generateFilename } from './download';

it('recognizes video paths with queries, fragments and uppercase extensions', () => {
  expect(isVideoUrl('https://v.redd.it/id/DASH_720.MP4?source=fallback#video')).toBe(true);
  expect(isVideoUrl('https://i.redd.it/photo.jpg?filename=video.mp4')).toBe(false);
  expect(isVideoUrl('invalid')).toBe(false);
  expect(mediaExtension('https://i.redd.it/photo.webp?width=640')).toBe('webp');
  expect(generateFilename('pics', 'id', 'https://v.redd.it/id/video.mp4?source=fallback')).toBe('reddit_pics_id.mp4');
});


it('recovers a streaming manifest for older saved Reddit video URLs only', () => {
  expect(redditDashManifest('https://v.redd.it/abc/DASH_1080.mp4?source=fallback')).toBe('https://v.redd.it/abc/DASHPlaylist.mpd');
  expect(redditDashManifest('https://example.com/abc/DASH_1080.mp4')).toBeUndefined();
  expect(redditDashManifest('https://i.redd.it/photo.jpg')).toBeUndefined();
});
