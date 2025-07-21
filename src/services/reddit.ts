// src/services/reddit.ts

/**
 * Represents a Reddit post containing media.
 */
export interface RedditPost {
    /** The title of the post. */
    title: string;
    /** The URL(s) of the media (image or video). Will contain preview image URL if video is unplayable */
    mediaUrls: string[];
    /** The subreddit the post belongs to. */
    subreddit: string;
    /** The ID of the post */
    postId: string;
    /** Flag indicating if the media is a video format this app cannot play directly */
    isUnplayableVideoFormat?: boolean; // <-- ADDED FLAG
}

/**
 * Specifies the sorting method for Reddit posts.
 */
export type SortType = 'hot' | 'top';

/**
 * Specifies the time frame for 'top' posts.
 * Required when sortType is 'top'. Corresponds to Reddit API's 't' parameter.
 */
export type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'all';


// --- Helper Function to Extract Media (v4 - Explicitly Ignore DASH/HLS, Robust Fallback) ---
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
                 // console.log(`Found video via fallback_url for post ${postDetail.id}`);
            } else {
                 // This fallback IS likely a streaming manifest, log it but DO NOT add to urls
                 console.log(`Post ${postDetail.id} fallback_url detected as likely DASH/HLS, skipping: ${redditVideo.fallback_url}`);
            }
        }
        // We EXPLICITLY DO NOT use hls_url or dash_url because <video> can't play them

        // 3. Reddit Video Preview (Often GIFs/MP4s, check if no primary video/gallery)
        if (!extracted && postDetail.preview?.reddit_video_preview?.fallback_url) {
             // These previews are usually direct MP4s
            urls.push(postDetail.preview.reddit_video_preview.fallback_url);
            extracted = true;
           // console.log(`Found video via preview fallback for post ${postDetail.id}`);
        }

        // 4. Direct Image/GIF URL (Check overridden first)
        const finalUrl = postDetail.url_overridden_by_dest || postDetail.url;
        if (!extracted && finalUrl) {
             const lowerUrl = finalUrl.toLowerCase();
             // Add check for webp as well
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif') || lowerUrl.endsWith('.webp')) {
                urls.push(finalUrl);
                extracted = true;
                // console.log(`Found direct image/gif URL for post ${postDetail.id}`);
             }
        }

        // --- Fallbacks (If NOTHING usable found yet) ---

        // 5. oEmbed Thumbnail (For external videos - use as image)
        const oEmbed = postDetail.media?.oembed || postDetail.secure_media?.oembed;
        if (!extracted && oEmbed?.thumbnail_url) {
             // Check if it looks like an image URL
             const thumbLower = oEmbed.thumbnail_url.toLowerCase();
             if (thumbLower.includes('.jpg') || thumbLower.includes('.png') || thumbLower.includes('.jpeg')) {
                 urls.push(oEmbed.thumbnail_url);
                 extracted = true; // Treat thumbnail as extracted media for the grid
                 console.log(`Using oEmbed thumbnail for post ${postDetail.id}`);
             }
        }

        // 6. **Primary Preview Image (BEST FALLBACK)**
        // Use this if absolutely no other media URL was suitable.
        if (!extracted && postDetail.preview?.images?.[0]?.source?.url) {
            // Use the source URL directly (raw_json=1 handles escaping)
             urls.push(postDetail.preview.images[0].source.url);
             extracted = true; // Mark as extracted so we don't skip the post entirely
             console.log(`Using Preview Image as fallback for post ${postDetail.id}`);
        }

        // --- Logging for posts that were marked is_video but we couldn't use ---
        if (postDetail.is_video && urls.length === 0) {
             console.warn(`Post ${postDetail.id} in r/${postDetail.subreddit} (is_video=true) - No usable direct media URL found (likely DASH/HLS only). Falling back to other checks/preview. Data:`, { media: postDetail.media, secure_media: postDetail.secure_media, preview: postDetail.preview });
        }
        // Note: We no longer need the general failure log here as step 6 tries to ensure something is always returned if a preview exists.

    } catch (mediaError) {
        console.error(`Error during media extraction for post ${postDetail?.id}:`, mediaError, postDetail);
    }
    // Return whatever URLs were found (could be playable video, gallery images, direct image, oEmbed thumb, preview image, or empty)
    return urls;
};
// --- End Helper Function ---


/**
 * Asynchronously retrieves posts containing media from a given subreddit based on sort type and timeframe.
 */
export async function getPosts(
    subreddit: string,
    sortType: SortType,
    options: {
        timeFrame?: TimeFrame;
        after?: string;
        limit?: number;
    }
): Promise<{ posts: RedditPost[], after: string | null }> {
    const { timeFrame, after, limit = 20 } = options;

    if (sortType === 'top' && !timeFrame) {
        console.error("TimeFrame parameter is missing for 'top' sort.");
        throw new Error("TimeFrame ('day', 'week', 'month', 'year', 'all') is required when using sortType 'top'.");
    }

    const params = new URLSearchParams({
        subreddit,
        sortType,
        limit: limit.toString(),
        raw_json: '1',
    });
    if (sortType === 'top' && timeFrame) {
        params.append('timeFrame', timeFrame);
    }
    if (after) {
        params.append('after', after);
    }
    const url = `/api/reddit?${params.toString()}`;

    try {
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            let errorData = null;
            let errorText = `HTTP error! status: ${response.status} ${response.statusText}. URL: ${url}`;
            try {
                errorData = await response.json();
                if (errorData?.message) errorText += ` Reddit message: ${errorData.message}`;
                if (errorData?.reason) errorText += ` Reason: ${errorData.reason}`;
            } catch (e) { /* ignore */ }
            console.error("Reddit API Error Response:", errorData);
            throw new Error(errorText);
        }

        const data = await response.json();

        if (!data?.data?.children) {
             console.warn(`No data or unexpected structure received from ${url}:`, data);
             return { posts: [], after: null };
        }

        // --- MAP Function Updated to Set isUnplayableVideoFormat ---
        const posts: RedditPost[] = data.data.children
            .map((child: any): RedditPost | null => {
                let postData = child?.data;
                if (!postData) return null;

                // 1. Attempt extraction using the helper
                let mediaUrls = extractMediaUrls(postData);
                let isUnplayableVideo = false; // Initialize flag

                // 2. Check if it *was* a video but extraction failed or used a non-MP4 fallback
                const isVideoPost = postData.is_video === true;
                // Check if we ended up with a non-MP4 URL (e.g., preview JPG/PNG) or if extraction failed entirely for a video post
                const usedNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
                const extractionFailedForVideo = isVideoPost && mediaUrls.length === 0;

                if (isVideoPost && (usedNonVideoUrl || extractionFailedForVideo)) {
                    // It was flagged as a video, but we couldn't get a usable MP4 URL.
                    // Try to get the preview image as a fallback if mediaUrls is empty.
                    if (extractionFailedForVideo && postData.preview?.images?.[0]?.source?.url) {
                        mediaUrls = [postData.preview.images[0].source.url]; // Use preview as the URL
                        console.log(`Using Preview Image for unplayable video post ${postData.id}`);
                    } else if(extractionFailedForVideo) {
                        // Truly unrenderable video - no fallback MP4, no preview image
                         console.warn(`Post ${postData.id} is video but has NO fallback_url and NO preview image.`);
                         return null; // Skip this post entirely
                    }
                    // If we have a URL (which must be the preview image now), mark it
                    if (mediaUrls.length > 0) {
                       isUnplayableVideo = true;
                       console.log(`Marking post ${postData.id} as unplayable video format (using preview).`);
                    }
                }


                // 3. If no media found *at all* and it's a crosspost, try the original post
                if (mediaUrls.length === 0 && postData.crosspost_parent_list?.[0] && postData.crosspost_parent_list[0].id !== postData.id) {
                    const parentData = postData.crosspost_parent_list[0];
                    mediaUrls = extractMediaUrls(parentData);

                    // Check again if the *parent* was an unplayable video
                    const isParentVideo = parentData.is_video === true;
                    const usedParentNonVideoUrl = mediaUrls.length > 0 && !mediaUrls[0].endsWith('.mp4');
                    const extractionFailedForParentVideo = isParentVideo && mediaUrls.length === 0;

                     if(isParentVideo && (usedParentNonVideoUrl || extractionFailedForParentVideo)) {
                         // Use parent's preview if available and extraction failed
                         if (extractionFailedForParentVideo && parentData.preview?.images?.[0]?.source?.url) {
                             mediaUrls = [parentData.preview.images[0].source.url];
                             console.log(`Using Parent Preview Image for unplayable crosspost ${postData.id}`);
                         } else if (extractionFailedForParentVideo) {
                             console.warn(`Crosspost parent ${parentData.id} is video but has NO fallback_url and NO preview image.`);
                             return null; // Skip if parent also unrenderable
                         }
                         // If we have a URL (parent's preview), mark it
                         if (mediaUrls.length > 0) {
                             isUnplayableVideo = true;
                             console.log(`Marking crosspost ${postData.id} as unplayable video format (using parent preview).`);
                         }
                     }
                }

                // 4. Only create the post object if we have *some* URL (playable or preview)
                if (mediaUrls.length > 0) {
                    return {
                        title: postData.title || '',
                        mediaUrls: mediaUrls, // Contains playable URL or preview URL
                        subreddit: postData.subreddit || subreddit,
                        postId: postData.id,
                        isUnplayableVideoFormat: isUnplayableVideo, // Set the flag
                    };
                }

                return null; // Skip if absolutely no URL found after all checks
            })
            .filter((post: RedditPost | null): post is RedditPost => post !== null);
        // --- End MAP Function ---

        return {
            posts: posts,
            after: data.data.after,
        };
    } catch (error: any) {
        console.error(`Error processing fetch for ${sortType} posts from /r/${subreddit} (t=${timeFrame}, after=${after}, limit=${limit}):`, error);
        throw new Error(`Failed to fetch ${sortType} posts from /r/${subreddit}. ${error.message}`);
    }
}