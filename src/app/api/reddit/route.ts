import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ========================================================================
// 1. TYPE DEFINITIONS
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


// ========================================================================
// 2. MEDIA EXTRACTION HELPER FUNCTION
// ========================================================================

const extractMediaUrls = (postDetail: any): string[] => {
    if (!postDetail) return [];

    const urls: string[] = [];
    let extracted = false;

    try {
        // 1. Gallery
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

        // 2. Reddit Video
        const redditVideo = postDetail.media?.reddit_video || postDetail.secure_media?.reddit_video;
        if (!extracted && redditVideo?.fallback_url) {
            if (redditVideo.fallback_url.includes('.mp4') && !redditVideo.fallback_url.includes('DASHPlaylist.mpd') && !redditVideo.fallback_url.includes('.m3u8')) {
                 urls.push(redditVideo.fallback_url);
                 extracted = true;
            }
        }

        // 3. Reddit Video Preview
        if (!extracted && postDetail.preview?.reddit_video_preview?.fallback_url) {
            urls.push(postDetail.preview.reddit_video_preview.fallback_url);
            extracted = true;
        }

        // 4. Direct Image/GIF URL
        const finalUrl = postDetail.url_overridden_by_dest || postDetail.url;
        if (!extracted && finalUrl) {
             const lowerUrl = finalUrl.toLowerCase();
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp')) {
                urls.push(finalUrl);
                extracted = true;
             }
        }

        // 5. oEmbed Thumbnail (Fallback)
        const oEmbed = postDetail.media?.oembed || postDetail.secure_media?.oembed;
        if (!extracted && oEmbed?.thumbnail_url) {
             const thumbLower = oEmbed.thumbnail_url.toLowerCase();
             if (thumbLower.includes('.jpg') || thumbLower.includes('.png') || thumbLower.includes('.jpeg')) {
                 urls.push(oEmbed.thumbnail_url);
                 extracted = true;
             }
        }

        // 6. Primary Preview Image (Best Fallback)
        if (!extracted && postDetail.preview?.images?.[0]?.source?.url) {
             urls.push(postDetail.preview.images[0].source.url);
             extracted = true;
        }

        if (postDetail.is_video && urls.length === 0) {
             console.warn(`Post ${postDetail.id} in r/${postDetail.subreddit} (is_video=true) - No usable direct media URL found.`);
        }

    } catch (mediaError) {
        console.error(`Error during media extraction for post ${postDetail?.id}:`, mediaError);
    }
    return urls;
};


// ========================================================================
// 3. API ROUTE HANDLER (This runs on the server)
// ========================================================================

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');
    const sortType = searchParams.get('sortType') as SortType;
    const timeFrame = searchParams.get('timeFrame') as TimeFrame | null;
    const after = searchParams.get('after');
    const limit = searchParams.get('limit') || '20';

    if (!subreddit || !sortType) {
        return NextResponse.json({ error: 'Missing required parameters: subreddit and sortType' }, { status: 400 });
    }
    if (sortType === 'top' && !timeFrame) {
        return NextResponse.json({ error: 'TimeFrame is required for top sort' }, { status: 400 });
    }

    try {
        // --- IP DETECTION LOGIC ---
        // This block finds the server's public IP address before making the request.
        let serverIp = 'unknown';
        try {
            // We use an external service to tell us our own IP.
            // 'no-store' is important to prevent caching of the IP address.
            const ipResponse = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                serverIp = ipData.ip;
            }
        } catch (ipError) {
            console.error("[IP_DETECTION_ERROR] Could not fetch server IP address:", ipError);
        }
        // --- END IP DETECTION ---

        // Build the URL using the correct oauth.reddit.com domain
        let url = `https://oauth.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;
        if (sortType === 'top' && timeFrame) { url += `&t=${timeFrame}`; }
        if (after) { url += `&after=${after}`; }

        const redditUsername = process.env.REDDIT_USERNAME || 'default_user';
        const userAgent = `web:app.redditgram:v1.0.1 (by /u/${redditUsername})`;

        // --- DIAGNOSTIC LOGGING ---
        // This is the information you will provide to Reddit Support.
        console.log(`[DIAGNOSTIC_LOG] Request from Vercel Server IP: ${serverIp}`);
        console.log(`[DIAGNOSTIC_LOG] Using User-Agent: "${userAgent}"`);
        console.log(`[DIAGNOSTIC_LOG] Fetching URL: "${url}"`);
        // --- END DIAGNOSTIC LOGGING ---

        const redditResponse = await fetch(url, {
            headers: { 'User-Agent': userAgent },
            next: { revalidate: 300 }
        });

        if (!redditResponse.ok) {
            const errorDetails = await redditResponse.text();
            console.error(`[REDDIT_API_ERROR] Status: ${redditResponse.status}. Details: ${errorDetails}`);
            return NextResponse.json({ error: `Reddit API Error: ${redditResponse.status}` }, { status: redditResponse.status });
        }

        const data = await redditResponse.json();

        // --- Process posts (Your original logic) ---
        if (!data?.data?.children) {
            return NextResponse.json({ posts: [], after: null });
        }
        const posts: RedditPost[] = data.data.children.map((child: any): RedditPost | null => {
            let postData = child?.data;
            if (!postData) return null;
            let mediaUrls = extractMediaUrls(postData);
            let isUnplayableVideo = false;
            const isVideoPost = postData.is_video === true;
            const usedNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
            const extractionFailedForVideo = isVideoPost && mediaUrls.length === 0;
            if (isVideoPost && (usedNonVideoUrl || extractionFailedForVideo)) {
                if (extractionFailedForVideo && postData.preview?.images?.[0]?.source?.url) {
                    mediaUrls = [postData.preview.images[0].source.url];
                } else if (extractionFailedForVideo) {
                    return null;
                }
                if (mediaUrls.length > 0) isUnplayableVideo = true;
            }
            if (mediaUrls.length === 0 && postData.crosspost_parent_list?.[0]) {
                const parentData = postData.crosspost_parent_list[0];
                mediaUrls = extractMediaUrls(parentData);
                const isParentVideo = parentData.is_video === true;
                const usedParentNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
                const extractionFailedForParentVideo = isParentVideo && mediaUrls.length === 0;
                if (isParentVideo && (usedParentNonVideoUrl || extractionFailedForParentVideo)) {
                    if (extractionFailedForParentVideo && parentData.preview?.images?.[0]?.source?.url) {
                        mediaUrls = [parentData.preview.images[0].source.url];
                    } else if (extractionFailedForParentVideo) {
                        return null;
                    }
                    if (mediaUrls.length > 0) isUnplayableVideo = true;
                }
            }
            if (mediaUrls.length > 0) {
                return {
                    title: postData.title || '',
                    mediaUrls: mediaUrls,
                    subreddit: postData.subreddit || subreddit,
                    postId: postData.id,
                    isUnplayableVideoFormat: isUnplayableVideo,
                };
            }
            return null;
        }).filter(Boolean);

        return NextResponse.json({ posts, after: data.data.after });

    } catch (error: any) {
        console.error(`[GLOBAL_HANDLER_ERROR] An unexpected error occurred:`, error);
        return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}