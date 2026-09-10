import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'i.redd.it', 'preview.redd.it', 'i.imgur.com', 'v.redd.it', 'external-preview.redd.it',
]);
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

function allowedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname) &&
      !url.username && !url.password && (!url.port || url.port === '443') ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('url');
  if (!input) return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  let url = allowedUrl(input);
  if (!url) return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });

  // Keep header values ASCII and exclude quotes, separators, and control characters.
  const filename = (request.nextUrl.searchParams.get('filename') || 'download')
    .replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'download';
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, DOWNLOAD_TIMEOUT_MS);
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const cleanup = () => {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', cancel);
  };
  const failure = (error: string, status: number) => {
    cleanup();
    controller.abort();
    return NextResponse.json({ error }, { status });
  };

  try {
    let response: Response;
    for (let redirects = 0; ; redirects++) {
      response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RedditGram/1.0)' },
        redirect: 'manual',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      await response.body?.cancel();
      const location = response.headers.get('location');
      if (!location || redirects >= MAX_REDIRECTS) return failure('Invalid or excessive redirects', 502);
      url = allowedUrl(new URL(location, url).href);
      if (!url) return failure('Redirect URL not allowed', 403);
    }

    if (!response.ok) {
      await response.body?.cancel();
      return failure('Failed to fetch media', response.status);
    }
    if (Number(response.headers.get('content-length')) > MAX_DOWNLOAD_BYTES) {
      await response.body?.cancel();
      return failure('Media exceeds the 100 MiB download limit', 413);
    }
    if (!response.body) return failure('Empty upstream response', 502);

    const reader = response.body.getReader();
    let bytes = 0;
    // Read on demand: backpressure prevents buffering the whole file on the server.
    const body = new ReadableStream<Uint8Array>({
      async pull(stream) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            cleanup();
            reader.releaseLock();
            stream.close();
            return;
          }
          bytes += chunk.value.byteLength;
          if (bytes > MAX_DOWNLOAD_BYTES) throw new Error('Download size limit exceeded');
          stream.enqueue(chunk.value);
        } catch (error) {
          cleanup();
          controller.abort();
          await reader.cancel().catch(() => {});
          stream.error(error);
        }
      },
      async cancel() {
        cleanup();
        controller.abort();
        await reader.cancel().catch(() => {});
      },
    });
    return new NextResponse(body, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    const timedOut = controller.signal.aborted;
    return failure(timedOut ? 'Download timed out or was cancelled' : 'Failed to process download', timedOut ? 504 : 502);
  }
}
