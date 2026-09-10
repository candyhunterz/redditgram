/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET } from './route';

const mockFetch = jest.fn();
const originalFetch = global.fetch;
const request = (url = 'https://i.redd.it/photo.jpg') => new NextRequest(
  `http://localhost/api/download?url=${encodeURIComponent(url)}&filename=test.jpg`,
);

beforeEach(() => { mockFetch.mockReset(); global.fetch = mockFetch; });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it.each([
  'https://evili.imgur.com/photo.jpg', 'http://i.redd.it/photo.jpg',
  'https://i.redd.it:444/photo.jpg', 'https://user:password@i.redd.it/photo.jpg',
  'https://i.redd.it.attacker.test/photo.jpg',
])('rejects untrusted URL %s before fetching', async url => {
  expect((await GET(request(url))).status).toBe(403);
  expect(mockFetch).not.toHaveBeenCalled();
});

it('rejects redirects outside the allowlist', async () => {
  mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }));
  expect((await GET(request())).status).toBe(403);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(mockFetch.mock.calls[0][1].redirect).toBe('manual');
});

it('follows a validated redirect and streams bytes without buffering the response', async () => {
  const source = new Response('image bytes', { headers: { 'content-type': 'image/jpeg' } });
  const buffer = jest.spyOn(source, 'arrayBuffer');
  mockFetch.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://preview.redd.it/photo.jpg' } }))
    .mockResolvedValueOnce(source);
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('image bytes');
  expect(buffer).not.toHaveBeenCalled();
  expect(mockFetch.mock.calls[1][0].hostname).toBe('preview.redd.it');
  expect(response.headers.get('content-disposition')).toBe('attachment; filename="test.jpg"');
});

it('rejects excessive declared content length', async () => {
  mockFetch.mockResolvedValueOnce(new Response('x', { headers: { 'content-length': String(101 * 1024 * 1024) } }));
  expect((await GET(request())).status).toBe(413);
});

it('enforces the byte limit even when content length is absent', async () => {
  const chunk = new Uint8Array(1024 * 1024);
  const cancel = jest.fn();
  mockFetch.mockResolvedValueOnce(new Response(new ReadableStream({
    pull(stream) { stream.enqueue(chunk); }, cancel,
  })));
  const response = await GET(request());
  const reader = response.body!.getReader();
  await expect((async () => { while (!(await reader.read()).done) { /* Drain without retaining chunks. */ } })())
    .rejects.toThrow('Download size limit exceeded');
  expect(cancel).toHaveBeenCalled();
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
});

it('times out stalled upstream headers', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const response = GET(request());
  await jest.advanceTimersByTimeAsync(30_000);
  expect((await response).status).toBe(504);
});

it('cancels the upstream when the client cancels the response stream', async () => {
  const cancel = jest.fn();
  mockFetch.mockResolvedValueOnce(new Response(new ReadableStream({ cancel })));
  const response = await GET(request());
  await response.body!.cancel();
  expect(cancel).toHaveBeenCalled();
  expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true);
});

it('bounds redirect loops', async () => {
  mockFetch.mockImplementation(() => Promise.resolve(new Response(null, { status: 302, headers: { location: '/again.jpg' } })));
  expect((await GET(request())).status).toBe(502);
  expect(mockFetch).toHaveBeenCalledTimes(4);
});
