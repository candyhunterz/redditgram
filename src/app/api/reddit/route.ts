import { isVideoUrl } from '@/lib/media';
import { extractRedditMedia, fullQualityRedditMedia, redditVideoManifest } from '@/lib/reddit-media';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { RedditPost, SortType, TimeFrame } from '@/services/reddit';

// ========================================================================
// 2. OAUTH TOKEN HANDLER
// ========================================================================
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

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
        throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return cachedToken!;
}

// ========================================================================
// 3. UPDATED API ROUTE HANDLER (With the fix)
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
        const accessToken = await getAccessToken();
        let url = `https://oauth.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;
        if (sortType === 'top' && timeFrame) { url += `&t=${timeFrame}`; }
        if (after) { url += `&after=${after}`; }

        const userAgent = `web:gramviewer:v2.0.0 (by /u/${process.env.REDDIT_USERNAME || 'candyhunterz'})`;

        const redditResponse = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': userAgent,
            },
            cache: 'no-store'
        });

        if (!redditResponse.ok) {
            const errorDetails = await redditResponse.text();
            console.error(`[REDDIT_API_ERROR] Status: ${redditResponse.status}. Details: ${errorDetails}`);
            return NextResponse.json({ error: `Reddit API Error: ${redditResponse.status}` }, { status: redditResponse.status });
        }

        const data = await redditResponse.json();

        if (!data?.data?.children) {
            return NextResponse.json({ posts: [], after: null });
        }

        // ★★★★★★★★★★★★★★★★★★★★ THE FIX ★★★★★★★★★★★★★★★★★★★★
        // The mapping logic is now correctly placed inside the .map() call.
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        const mappedPosts = await Promise.all(data.data.children
            .map(async (child: any): Promise<RedditPost | null> => {
                let postData = child?.data;
                if (!postData) return null;

                let mediaUrls = extractRedditMedia(postData);
                let fullQualityUrls = await fullQualityRedditMedia(postData);
                let videoManifestUrl = redditVideoManifest(postData);
                let isUnplayableVideo = false;

                const isVideoPost = postData.is_video === true;
                const usedNonVideoUrl = mediaUrls.length > 0 && !isVideoUrl(mediaUrls[0]);
                const extractionFailedForVideo = isVideoPost && mediaUrls.length === 0;

                if (isVideoPost && (usedNonVideoUrl || extractionFailedForVideo)) {
                    if (extractionFailedForVideo && postData.preview?.images?.[0]?.source?.url) {
                        mediaUrls = [postData.preview.images[0].source.url];
                        fullQualityUrls = [postData.preview.images[0].source.url];
                    } else if (extractionFailedForVideo) {
                        return null;
                    }
                    if (mediaUrls.length > 0) {
                       isUnplayableVideo = true;
                    }
                }

                if (mediaUrls.length === 0 && postData.crosspost_parent_list?.[0]) {
                    const parentData = postData.crosspost_parent_list[0];
                    mediaUrls = extractRedditMedia(parentData);
                    fullQualityUrls = await fullQualityRedditMedia(parentData);
                    videoManifestUrl = redditVideoManifest(parentData);
                    const isParentVideo = parentData.is_video === true;
                    const usedParentNonVideoUrl = mediaUrls.length > 0 && !isVideoUrl(mediaUrls[0]);
                    const extractionFailedForParentVideo = isParentVideo && mediaUrls.length === 0;

                    if (isParentVideo && (usedParentNonVideoUrl || extractionFailedForParentVideo)) {
                        if (extractionFailedForParentVideo && parentData.preview?.images?.[0]?.source?.url) {
                            mediaUrls = [parentData.preview.images[0].source.url];
                            fullQualityUrls = [parentData.preview.images[0].source.url];
                        } else if (extractionFailedForParentVideo) {
                            return null;
                        }
                        if (mediaUrls.length > 0) {
                            isUnplayableVideo = true;
                        }
                    }
                }

                if (mediaUrls.length > 0) {
                    return {
                        videoManifestUrl,
                        title: postData.title || '',
                        mediaUrls: mediaUrls,
                        fullQualityUrls: fullQualityUrls.length > 0 ? fullQualityUrls : mediaUrls,
                        subreddit: postData.subreddit || subreddit,
                        postId: postData.id,
                        isUnplayableVideoFormat: isUnplayableVideo,
                        ups: postData.ups ?? 0,
                        numComments: postData.num_comments ?? 0,
                        createdUtc: postData.created_utc ?? 0,
                        isNsfw: postData.over_18 ?? false,
                    };
                }
                return null;
            }));
        const posts = mappedPosts.filter((post: RedditPost | null): post is RedditPost => post !== null);

        return NextResponse.json(
            { posts, after: data.data.after },
            { headers: { 'Cache-Control': searchParams.get('refresh') === '1' ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300' } }
        );

    } catch (error: any) {
        console.error(`[GLOBAL_HANDLER_ERROR] An unexpected error occurred:`, error);
        return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}