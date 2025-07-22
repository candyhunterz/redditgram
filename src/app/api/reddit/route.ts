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
// 2. HELPER FUNCTION (Copied directly from your reddit.ts)
// ========================================================================

const extractMediaUrls = (postDetail: any): string[] => {
    if (!postDetail) return [];

    const urls: string[] = [];
    let extracted = false; // Use a single flag

    try {
        // --- Check Order (Most specific/reliable first) ---

        // 1. Gallery
        if (postDetail.is_gallery && postDetail.gallery_data?.items && postDetail.media_metadata) {
            for (const item of postDetail.gallery_data.items) {
                const mediaId = item.media_id;
                const mediaMeta = postDetail.media_metadata[mediaId];
                if (!mediaMeta) continue;
                let bestUrl = '';
                // Prefer highest resolution preview, then source
                if (mediaMeta.p && mediaMeta.p.length > 0) bestUrl = mediaMeta.p[mediaMeta.p.length - 1]?.u;
                if (!bestUrl && mediaMeta.s?.u) bestUrl = mediaMeta.s.u;
                if (bestUrl) urls.push(bestUrl); // raw_json=1 handles unescaping
            }
            if (urls.length > 0) extracted = true;
        }

        // 2. Reddit Video (Primary Check - using fallback_url)
        const redditVideo = postDetail.media?.reddit_video || postDetail.secure_media?.reddit_video;
        if (!extracted && redditVideo?.fallback_url) {
            // Check if fallback_url looks like a direct MP4 and NOT a manifest URL
            if (redditVideo.fallback_url.includes('.mp4') && !redditVideo.fallback_url.includes('DASHPlaylist.mpd') && !redditVideo.fallback_url.includes('.m3u8')) {
                 urls.push(redditVideo.fallback_url);
                 extracted = true;
            }
        }

        // 3. Reddit Video Preview (Often GIFs/MP4s, check if no primary video/gallery)
        if (!extracted && postDetail.preview?.reddit_video_preview?.fallback_url) {
            urls.push(postDetail.preview.reddit_video_preview.fallback_url);
            extracted = true;
        }

        // 4. Direct Image/GIF URL (Check overridden first)
        const finalUrl = postDetail.url_overridden_by_dest || postDetail.url;
        if (!extracted && finalUrl) {
             const lowerUrl = finalUrl.toLowerCase();
             // Add check for webp as well
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp')) {
                urls.push(finalUrl);
                extracted = true;
             }
        }

        // --- Fallbacks (If NOTHING usable found yet) ---

        // 5. oEmbed Thumbnail (For external videos - use as image)
        const oEmbed = postDetail.media?.oembed || postDetail.secure_media?.oembed;
        if (!extracted && oEmbed?.thumbnail_url) {
             const thumbLower = oEmbed.thumbnail_url.toLowerCase();
             if (thumbLower.includes('.jpg') || thumbLower.includes('.png') || thumbLower.includes('.jpeg')) {
                 urls.push(oEmbed.thumbnail_url);
                 extracted = true; // Treat thumbnail as extracted media for the grid
             }
        }

        // 6. **Primary Preview Image (BEST FALLBACK)**
        if (!extracted && postDetail.preview?.images?.[0]?.source?.url) {
             urls.push(postDetail.preview.images[0].source.url);
             extracted = true;
        }

        // --- Logging for posts that were marked is_video but we couldn't use ---
        if (postDetail.is_video && urls.length === 0) {
             console.warn(`Post ${postDetail.id} in r/${postDetail.subreddit} (is_video=true) - No usable direct media URL found (likely DASH/HLS only).`);
        }

    } catch (mediaError) {
        console.error(`Error during media extraction for post ${postDetail?.id}:`, mediaError, postDetail);
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

    // --- Input validation ---
    if (!subreddit || !sortType) {
        return NextResponse.json({ error: 'Missing required parameters: subreddit and sortType' }, { status: 400 });
    }
    if (sortType === 'top' && !timeFrame) {
        return NextResponse.json({ error: 'TimeFrame is required for top sort' }, { status: 400 });
    }

    try {
        // --- Build the Reddit API URL ---
        let url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;
        if (sortType === 'top' && timeFrame) { url += `&t=${timeFrame}`; }
        if (after) { url += `&after=${after}`; }

        // --- Make the server-to-server request to Reddit with User-Agent ---
        const userAgent = 'web:app.redditgram:v1.0.0 (by /u/candyhunterz)';
        const redditResponse = await fetch(url, {
            headers: { 'User-Agent': userAgent },
            // Optional: Configure server-side caching
            next: { revalidate: 300 } // Revalidate cache every 5 minutes
        });

        // --- Handle Reddit API errors ---
        if (!redditResponse.ok) {
            const errorText = `Reddit API Error: ${redditResponse.status} ${redditResponse.statusText}`;
            console.error(errorText, await redditResponse.text());
            return NextResponse.json({ error: errorText }, { status: redditResponse.status });
        }

        const data = await redditResponse.json();

        if (!data?.data?.children) {
            console.warn(`No data or unexpected structure received from ${url}:`, data);
            return NextResponse.json({ posts: [], after: null });
        }

        // --- Process the data using your original logic ---
        const posts: RedditPost[] = data.data.children
            .map((child: any): RedditPost | null => {
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
                    if (mediaUrls.length > 0) {
                       isUnplayableVideo = true;
                    }
                }

                if (mediaUrls.length === 0 && postData.crosspost_parent_list?.[0] && postData.crosspost_parent_list[0].id !== postData.id) {
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
                         if (mediaUrls.length > 0) {
                             isUnplayableVideo = true;
                         }
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
            })
            .filter((post: RedditPost | null): post is RedditPost => post !== null);

        // --- Send the clean data back to the client ---
        return NextResponse.json({
            posts,
            after: data.data.after,
        });

    } catch (error: any) {
        console.error(`[API ROUTE HANDLER ERROR] /r/${subreddit}:`, error);
        return NextResponse.json({ error: `An internal server error occurred: ${error.message}` }, { status: 500 });
    }
}