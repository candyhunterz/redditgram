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

/**
 * Asynchronously retrieves posts containing media from a given subreddit based on sort type and timeframe.
 *
 * @param subreddit The name of the subreddit to fetch posts from.
 * @param sortType The sorting method ('hot' or 'top').
 * @param options Options including timeframe (for 'top' sort), pagination, and limit.
 * @param options.timeFrame The time frame for 'top' posts ('day', 'week', 'month', 'year', 'all'). Required if sortType is 'top'.
 * @param options.after The 'after' parameter for pagination (use undefined for the first page).
 * @param options.limit The maximum number of posts to retrieve per request (default: 20).
 * @returns A promise that resolves to an object containing an array of RedditPost objects and the next 'after' token (which can be null).
 */
export async function getPosts(
    subreddit: string,
    sortType: SortType,
    options: {
        timeFrame?: TimeFrame; // Optional here, but logic enforces it for 'top'
        after?: string;       // Use undefined for first page
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
        // Construct the base URL
        let url = `https://www.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`; // Added raw_json=1 for unescaped URLs

        // Add timeframe parameter if sortType is 'top'
        if (sortType === 'top' && timeFrame) { // Check timeFrame exists for type safety
            url += `&t=${timeFrame}`;
        }

        // Add pagination parameter if 'after' is provided
        if (after) {
            url += `&after=${after}`;
        }

        // Use 'no-store' cache to avoid potential issues with stale data from Reddit or CDNs
        const response = await fetch(url, { cache: 'no-store' });

        if (!response.ok) {
            // Try to get more specific error from Reddit if possible
            let errorData = null;
            let errorText = `HTTP error! status: ${response.status} ${response.statusText}. URL: ${url}`;
            try {
                // Reddit might return JSON with error details
                errorData = await response.json();
                if (errorData?.message) {
                    errorText += ` Reddit message: ${errorData.message}`;
                }
                if (errorData?.reason) {
                     errorText += ` Reason: ${errorData.reason}`; // Common for private/banned subs
                }
            } catch (e) { /* ignore json parse error if response is not JSON */ }

            console.error("Reddit API Error Response:", errorData);
            throw new Error(errorText);
        }

        const data = await response.json();

        // Check if data exists and has the expected structure
        if (!data?.data?.children) {
             console.warn(`No data or unexpected structure received from ${url}:`, data);
             // Return empty if the structure is wrong (e.g., private/banned/invalid subreddit)
             return { posts: [], after: null };
        }


        const posts: RedditPost[] = data.data.children
            .map((child: any): RedditPost | null => { // Allow returning null for easier filtering
                const postData = child?.data;
                if (!postData) return null; // Skip if child or data is missing

                const mediaUrls: string[] = [];

                // --- Media Extraction Logic ---
                try {
                    if (postData.is_gallery && postData.gallery_data?.items && postData.media_metadata) {
                        // Handle gallery posts reliably
                        for (const item of postData.gallery_data.items) {
                            const mediaId = item.media_id;
                            const mediaMeta = postData.media_metadata[mediaId];
                            if (!mediaMeta) continue;

                            // Prefer highest resolution preview ('p'), fallback to source ('s')
                            let bestUrl = '';
                            if (mediaMeta.p && mediaMeta.p.length > 0) {
                                bestUrl = mediaMeta.p[mediaMeta.p.length - 1]?.u; // Highest res preview
                            }
                            if (!bestUrl && mediaMeta.s?.u) {
                                bestUrl = mediaMeta.s.u; // Fallback to source
                            }

                            if (bestUrl) {
                                // Already unescaped due to raw_json=1
                                mediaUrls.push(bestUrl);
                            }
                        }
                    } else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
                        // Handle Reddit hosted videos
                        // Already unescaped due to raw_json=1
                        mediaUrls.push(postData.media.reddit_video.fallback_url);
                    } else if (postData.preview?.reddit_video_preview?.fallback_url) {
                        // Handle video previews (often GIFs hosted as MP4)
                         // Already unescaped due to raw_json=1
                        mediaUrls.push(postData.preview.reddit_video_preview.fallback_url);
                    } else if (postData.url_overridden_by_dest) {
                        // Handle direct image/gif links (using the final URL)
                         const lowerUrl = postData.url_overridden_by_dest.toLowerCase();
                         if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif')) {
                            // Already unescaped due to raw_json=1
                            mediaUrls.push(postData.url_overridden_by_dest);
                         }
                    }
                } catch (mediaError) {
                    // Log error extracting media for a specific post but continue processing others
                    console.error(`Error extracting media for post ${postData.id} in r/${subreddit}:`, mediaError, postData);
                }
                // --- End Media Extraction ---


                // Only return the post object if we found media
                if (mediaUrls.length > 0) {
                    return {
                        title: postData.title || '', // Provide default empty string
                        mediaUrls: mediaUrls,
                        subreddit: postData.subreddit || subreddit, // Prefer actual data if available
                        postId: postData.id
                    };
                }

                return null; // Return null if no media was found for this child
            })
            // Filter out the null entries where no media was found or data was invalid
            .filter((post): post is RedditPost => post !== null);

        return {
            posts: posts,
            after: data.data.after, // This can be null if it's the last page
        };
    } catch (error: any) {
        // Log the full error context
        console.error(`Error processing fetch for ${sortType} posts from /r/${subreddit} (t=${timeFrame}, after=${after}, limit=${limit}):`, error);
        // Re-throw a user-friendly error, keeping the original message
        throw new Error(`Failed to fetch ${sortType} posts from /r/${subreddit}. ${error.message}`);
    }
}