import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv'; // Vercel's Key-Value store for caching our token

// ========================================================================
// 1. TYPE DEFINITIONS & HELPER FUNCTION (No changes needed here)
// ========================================================================
export interface RedditPost {
    title: string;
    mediaUrls: string[];
    subreddit: string;
    postId: string;
    isUnplayableVideoFormat?: boolean;
}
export type SortType = 'hot' | 'top';
export type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'all';
const extractMediaUrls = (postDetail: any): string[] => {
    // This is your existing media extraction logic. No changes are needed.
    if (!postDetail) return [];
    const urls: string[] = [];
    let extracted = false;
    try {
        if (postDetail.is_gallery && postDetail.gallery_data?.items && postDetail.media_metadata) {
            for (const item of postDetail.gallery_data.items) {
                const mediaId = item.media_id;
                const mediaMeta = postDetail.media_metadata[mediaId];
                if (!mediaMeta) continue;
                let bestUrl = '';
                if (mediaMeta.p && mediaMeta.p.length > 0) bestUrl = mediaMeta.p[mediaMeta.p.length - 1]?.u;
                if (!bestUrl && mediaMeta.s?.u) bestUrl = mediaMeta.s.u;
                if (bestUrl) urls.push(bestUrl);
            }
            if (urls.length > 0) extracted = true;
        }
        const redditVideo = postDetail.media?.reddit_video || postDetail.secure_media?.reddit_video;
        if (!extracted && redditVideo?.fallback_url) {
            if (redditVideo.fallback_url.includes('.mp4') && !redditVideo.fallback_url.includes('DASHPlaylist.mpd') && !redditVideo.fallback_url.includes('.m3u8')) {
                 urls.push(redditVideo.fallback_url);
                 extracted = true;
            }
        }
        if (!extracted && postDetail.preview?.reddit_video_preview?.fallback_url) {
            urls.push(postDetail.preview.reddit_video_preview.fallback_url);
            extracted = true;
        }
        const finalUrl = postDetail.url_overridden_by_dest || postDetail.url;
        if (!extracted && finalUrl) {
             const lowerUrl = finalUrl.toLowerCase();
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp')) {
                urls.push(finalUrl);
                extracted = true;
             }
        }
        const oEmbed = postDetail.media?.oembed || postDetail.secure_media?.oembed;
        if (!extracted && oEmbed?.thumbnail_url) {
             const thumbLower = oEmbed.thumbnail_url.toLowerCase();
             if (thumbLower.includes('.jpg') || thumbLower.includes('.png') || thumbLower.includes('.jpeg')) {
                 urls.push(oEmbed.thumbnail_url);
                 extracted = true;
             }
        }
        if (!extracted && postDetail.preview?.images?.[0]?.source?.url) {
             urls.push(postDetail.preview.images[0].source.url);
             extracted = true;
        }
    } catch (mediaError) {
        console.error(`Error during media extraction for post ${postDetail?.id}:`, mediaError);
    }
    return urls;
};

// ========================================================================
// 2. NEW OAUTH TOKEN HANDLER
// This function gets and caches the application's access token.
// ========================================================================
async function getAccessToken(): Promise<string> {
    // First, check if we have a valid token in our cache
    const cachedToken = await kv.get<string>('reddit_access_token');
    if (cachedToken) {
        console.log('[AUTH_LOG] Using cached access token.');
        return cachedToken;
    }

    // If not, fetch a new one
    console.log('[AUTH_LOG] No cached token. Fetching new access token from Reddit...');
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('Missing Reddit API credentials in environment variables.');
    }

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenUrl = 'https://www.reddit.com/api/v1/access_token';

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store'
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const token = data.access_token;
    const expiresIn = data.expires_in; // Typically 3600 seconds (1 hour)

    // Cache the new token in Vercel KV, setting its expiration time.
    // We subtract 60 seconds as a safety buffer.
    await kv.set('reddit_access_token', token, { ex: expiresIn - 60 });
    console.log('[AUTH_LOG] Successfully fetched and cached new token.');

    return token;
}

// ========================================================================
// 3. UPDATED API ROUTE HANDLER
// Now uses the access token for all requests.
// ========================================================================
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const sortType = searchParams.get('sortType') as SortType;
    const timeFrame = searchParams.get('timeFrame') as TimeFrame | null;
    const after = searchParams.get('after');
    const limit = searchParams.get('limit') || '20';

    if (!subreddit || !sortType) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    try {
        // Step 1: Get our official access token.
        const accessToken = await getAccessToken();

        // Step 2: Build the request URL. We still use oauth.reddit.com
        let url = `https://oauth.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;
        if (sortType === 'top' && timeFrame) { url += `&t=${timeFrame}`; }
        if (after) { url += `&after=${after}`; }

        const userAgent = `web:gramviewer:v2.0.0 (by /u/${process.env.REDDIT_USERNAME || 'candyhunterz'})`;

        // Step 3: Make the authenticated request to Reddit's API.
        const redditResponse = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Use the Bearer token
                'User-Agent': userAgent, // User-Agent is still required!
            }
        });

        if (!redditResponse.ok) {
            const errorDetails = await redditResponse.text();
            console.error(`[REDDIT_API_ERROR] Status: ${redditResponse.status}. Details: ${errorDetails}`);
            return NextResponse.json({ error: `Reddit API Error: ${redditResponse.status}` }, { status: redditResponse.status });
        }

        const data = await redditResponse.json();

        // Step 4: Process the data (no changes to your logic here)
        if (!data?.data?.children) {
            return NextResponse.json({ posts: [], after: null });
        }
        const posts: RedditPost[] = data.data.children
            .map(/* Your existing mapping logic */)
            .filter(Boolean);
            
        return NextResponse.json({ posts, after: data.data.after });

    } catch (error: any) {
        console.error(`[GLOBAL_HANDLER_ERROR] An unexpected error occurred:`, error);
        return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}