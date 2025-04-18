// src/services/reddit.ts

/**
 * Represents a Reddit post containing media.
 */
export interface RedditPost {
    /** The title of the post. */
    title: string;
    /** The URL(s) of the media (image or video). Can be multiple for galleries. */
    mediaUrls: string[];
    /** The subreddit the post belongs to. */
    subreddit: string;
    /** The ID of the post */
    postId: string;
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

// --- Helper Function to Extract Media (v3 - Adding Preview Fallback & oEmbed Thumb) ---
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
                if (mediaMeta.p && mediaMeta.p.length > 0) bestUrl = mediaMeta.p[mediaMeta.p.length - 1]?.u;
                if (!bestUrl && mediaMeta.s?.u) bestUrl = mediaMeta.s.u;
                if (bestUrl) urls.push(bestUrl);
            }
            if (urls.length > 0) extracted = true;
        }

        // 2. Reddit Video (Primary Check - using fallback_url)
        const redditVideo = postDetail.media?.reddit_video || postDetail.secure_media?.reddit_video;
        if (!extracted && redditVideo?.fallback_url) {
            urls.push(redditVideo.fallback_url);
            extracted = true;
        }

        // 3. Reddit Video Preview (Often GIFs/MP4s)
        if (!extracted && postDetail.preview?.reddit_video_preview?.fallback_url) {
            urls.push(postDetail.preview.reddit_video_preview.fallback_url);
            extracted = true;
        }

        // 4. Direct Image/GIF URL (Check overridden first)
        const finalUrl = postDetail.url_overridden_by_dest || postDetail.url;
        if (!extracted && finalUrl) {
             const lowerUrl = finalUrl.toLowerCase();
             if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif')) {
                urls.push(finalUrl);
                extracted = true;
             }
        }

        // --- Fallbacks (If NOTHING above worked) ---

        // 5. oEmbed Thumbnail (For external videos like streamable, redgifs etc.)
        // We usually can't play these directly, so a thumbnail is the best we can get here.
        const oEmbed = postDetail.media?.oembed || postDetail.secure_media?.oembed;
        if (!extracted && oEmbed?.thumbnail_url) {
             // Check if it looks like an image URL
             const thumbLower = oEmbed.thumbnail_url.toLowerCase();
             if (thumbLower.includes('.jpg') || thumbLower.includes('.png') || thumbLower.includes('.jpeg')) {
                 urls.push(oEmbed.thumbnail_url);
                 extracted = true; // Treat thumbnail as extracted media for the grid
                 console.log(`Using oEmbed thumbnail for post ${postDetail.id} from ${oEmbed.provider_name || 'N/A'}`);
             }
        }

        // 6. **Primary Preview Image (BEST FALLBACK)**
        // Use this if absolutely no other media URL was suitable. Ensures *something* is displayed.
        if (!extracted && postDetail.preview?.images?.[0]?.source?.url) {
            // Use the source URL directly (raw_json=1 handles escaping)
             urls.push(postDetail.preview.images[0].source.url);
             extracted = true; // Mark as extracted so we don't skip the post entirely
             console.log(`Using Preview Image as fallback for post ${postDetail.id}`);
        }

        // --- Logging for completely failed posts ---
        if (urls.length === 0) {
             console.warn(`Post ${postDetail.id} in r/${postDetail.subreddit}: Could not extract any usable media URL.`, postDetail);
        }

    } catch (mediaError) {
        console.error(`Error during media extraction for post ${postDetail?.id}:`, mediaError, postDetail);
    }
    return urls; // Return whatever URLs were found (might be empty)
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

    // Validate timeframe if sortType is 'top'
    if (sortType === 'top' && !timeFrame) {
        console.error("TimeFrame parameter is missing for 'top' sort.");
        throw new Error("TimeFrame ('day', 'week', 'month', 'year', 'all') is required when using sortType 'top'.");
    }

    try {
        // Construct the base URL with raw_json=1 to get unescaped URLs
        let url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;

        // Add timeframe parameter if sortType is 'top'
        if (sortType === 'top' && timeFrame) {
            url += `&t=${timeFrame}`;
        }

        // Add pagination parameter if 'after' is provided
        if (after) {
            url += `&after=${after}`;
        }

        // Use 'no-store' cache to try and avoid stale data issues
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            // Try to get more specific error from Reddit if possible
            let errorData = null;
            let errorText = `HTTP error! status: ${response.status} ${response.statusText}. URL: ${url}`;
            try {
                errorData = await response.json();
                if (errorData?.message) errorText += ` Reddit message: ${errorData.message}`;
                if (errorData?.reason) errorText += ` Reason: ${errorData.reason}`;
            } catch (e) { /* Ignore JSON parse error if response isn't JSON */ }
            console.error("Reddit API Error Response:", errorData);
            throw new Error(errorText);
        }

        const data = await response.json();

        // Check if data structure is valid
        if (!data?.data?.children) {
             console.warn(`No data or unexpected structure received from ${url}:`, data);
             return { posts: [], after: null }; // Return empty for invalid structure
        }


        const posts: RedditPost[] = data.data.children
            .map((child: any): RedditPost | null => {
                let postData = child?.data;
                if (!postData) return null; // Skip if essential data is missing

                let mediaUrls: string[] = [];

                // 1. Attempt to extract media from the post itself using the helper
                mediaUrls = extractMediaUrls(postData);

                // 2. If no media found and it's a crosspost, try the original post
                if (mediaUrls.length === 0 && postData.crosspost_parent_list?.[0] && postData.crosspost_parent_list[0].id !== postData.id) {
                    mediaUrls = extractMediaUrls(postData.crosspost_parent_list[0]);
                }

                // 3. Only create the post object if we actually found usable media
                if (mediaUrls.length > 0) {
                    return {
                        title: postData.title || '', // Default to empty string if title is missing
                        mediaUrls: mediaUrls,
                        // Use the subreddit where the post appeared in the listing
                        subreddit: postData.subreddit || subreddit,
                        postId: postData.id,
                    };
                }

                return null; // Skip this post if no media could be extracted
            })
            .filter((post: RedditPost | null): post is RedditPost => post !== null); // Filter out the nulls

        return {
            posts: posts,
            after: data.data.after, // Can be null from Reddit API
        };
    } catch (error: any) {
        // Log the full error context for debugging
        console.error(`Error processing fetch for ${sortType} posts from /r/${subreddit} (t=${timeFrame}, after=${after}, limit=${limit}):`, error);
        // Re-throw a user-friendly error, including the original message
        throw new Error(`Failed to fetch ${sortType} posts from /r/${subreddit}. ${error.message}`);
    }
}