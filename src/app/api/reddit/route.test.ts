/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';

it('keeps fallback MP4 query URLs playable and returns uncached refresh responses', async () => {
  const oldFetch = global.fetch;
  const oldId = process.env.REDDIT_CLIENT_ID;
  const oldSecret = process.env.REDDIT_CLIENT_SECRET;
  process.env.REDDIT_CLIENT_ID = 'test-id';
  process.env.REDDIT_CLIENT_SECRET = 'test-secret';
  const url = 'https://v.redd.it/id/DASH_720.mp4?source=fallback';
  const mockFetch = jest.fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'test-token', expires_in: 3600 }))
    .mockResolvedValueOnce(Response.json({ data: { after: null, children: [{ data: {
      id: 'id', title: 'Video', subreddit: 'pics', is_video: true,
      media: { reddit_video: { fallback_url: url } },
    } }] } }));
  global.fetch = mockFetch;
  try {
    const response = await GET(new NextRequest('http://localhost/api/reddit?subreddit=pics&sortType=hot&refresh=1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = await response.json();
    expect(data.posts[0]).toMatchObject({ mediaUrls: [url], fullQualityUrls: [url], isUnplayableVideoFormat: false });
    expect(mockFetch.mock.calls[1][1].cache).toBe('no-store');
  } finally {
    global.fetch = oldFetch;
    if (oldId === undefined) delete process.env.REDDIT_CLIENT_ID; else process.env.REDDIT_CLIENT_ID = oldId;
    if (oldSecret === undefined) delete process.env.REDDIT_CLIENT_SECRET; else process.env.REDDIT_CLIENT_SECRET = oldSecret;
  }
});
