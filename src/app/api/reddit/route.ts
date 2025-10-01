import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';

// ========================================================================
// 1. TYPE DEFINITIONS & HELPER FUNCTION (No changes)
// ========================================================================
export interface RedditPost {
    title: string;
    mediaUrls: string[]; // Thumbnail/preview URLs for grid view
    fullQualityUrls: string[]; // Full quality URLs for fullscreen view
    subreddit: string;
    postId: string;
    isUnplayableVideoFormat?: boolean;
}
export type SortType = 'hot' | 'top';
export type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'all';
const extractMediaUrls = (postDetail: any): string[] => {
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
                // Use medium-sized preview (index 2-3) instead of largest for better loading performance
                if (mediaMeta.p && mediaMeta.p.length > 0) {
                    const mediumIndex = Math.min(2, mediaMeta.p.length - 1);
                    bestUrl = mediaMeta.p[mediumIndex]?.u;
                }
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
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.webp')) {
                urls.push(finalUrl);
                extracted = true;
             } else if (lowerUrl.endsWith('.gif')) {
                // For GIFs, try to use a preview/thumbnail instead of the full-size GIF
                if (postDetail.preview?.images?.[0]?.resolutions && postDetail.preview.images[0].resolutions.length > 0) {
                    // Use a medium-sized preview (similar to gallery logic)
                    const resolutions = postDetail.preview.images[0].resolutions;
                    const mediumIndex = Math.min(2, resolutions.length - 1);
                    const previewUrl = resolutions[mediumIndex]?.url;
                    if (previewUrl) {
                        urls.push(previewUrl);
                        extracted = true;
                    }
                }
                // Fallback to full GIF if no preview available
                if (!extracted) {
                    urls.push(finalUrl);
                    extracted = true;
                }
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

const extractFullQualityUrls = (postDetail: any): string[] => {
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
                // Use the LARGEST/highest quality image for fullscreen
                if (mediaMeta.p && mediaMeta.p.length > 0) {
                    bestUrl = mediaMeta.p[mediaMeta.p.length - 1]?.u;
                }
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
        console.error(`Error during full quality media extraction for post ${postDetail?.id}:`, mediaError);
    }
    return urls;
};

// ========================================================================
// 2. OAUTH TOKEN HANDLER (No changes)
// ========================================================================
async function getAccessToken(): Promise<string> {
    const cachedToken = await kv.get<string>('reddit_access_token');
    if (cachedToken) {
        console.log('[AUTH_LOG] Using cached access token.');
        return cachedToken;
    }

    console.log('[AUTH_LOG] Fetching new access token from Reddit...');
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
    const token = data.access_token;
    const expiresIn = data.expires_in;

    await kv.set('reddit_access_token', token, { ex: expiresIn - 60 });
    console.log('[AUTH_LOG] Successfully fetched and cached new token.');

    return token;
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
            }
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
        const posts: RedditPost[] = data.data.children
            .map((child: any): RedditPost | null => {
                let postData = child?.data;
                if (!postData) return null;

                let mediaUrls = extractMediaUrls(postData);
                let fullQualityUrls = extractFullQualityUrls(postData);
                let isUnplayableVideo = false;

                const isVideoPost = postData.is_video === true;
                const usedNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
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
                    mediaUrls = extractMediaUrls(parentData);
                    fullQualityUrls = extractFullQualityUrls(parentData);
                    const isParentVideo = parentData.is_video === true;
                    const usedParentNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
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
                        title: postData.title || '',
                        mediaUrls: mediaUrls,
                        fullQualityUrls: fullQualityUrls.length > 0 ? fullQualityUrls : mediaUrls,
                        subreddit: postData.subreddit || subreddit,
                        postId: postData.id,
                        isUnplayableVideoFormat: isUnplayableVideo,
                    };
                }
                return null;
            })
            .filter((post: RedditPost | null): post is RedditPost => post !== null);

        return NextResponse.json({ posts, after: data.data.after });

    } catch (error: any) {
        console.error(`[GLOBAL_HANDLER_ERROR] An unexpected error occurred:`, error);
        return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}