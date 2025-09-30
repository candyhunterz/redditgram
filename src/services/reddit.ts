// src/services/reddit.ts

// The types remain the same as they are used by your component.
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

/**
 * Asynchronously retrieves posts by calling our own backend API route, which then calls Reddit.
 * This function now runs in the browser.
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
        throw new Error("TimeFrame ('day', 'week', 'month', 'year', 'all') is required when using sortType 'top'.");
    }

    // Construct a URL pointing to our OWN API route
    const params = new URLSearchParams({
        subreddit,
        sortType,
        limit: String(limit),
    });

    if (sortType === 'top' && timeFrame) {
        params.append('timeFrame', timeFrame);
    }
    if (after) {
        params.append('after', after);
    }

    const url = `/api/reddit?${params.toString()}`;

    try {
        // Fetch from our own backend. No User-Agent or CORS issues here!
        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        }

        const data: { posts: RedditPost[], after: string | null } = await response.json();
        return data;

    } catch (error: any) {
        console.error(`Error fetching from API route /api/reddit:`, error);
        // Re-throw the error so the component's error handling can catch it
        throw new Error(`Failed to fetch posts: ${error.message}`);
    }
}

// The complex media extraction logic is no longer needed in this client-side file.
// It now lives on the server in /api/reddit/route.ts.