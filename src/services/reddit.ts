/**
 * Reddit API service
 * Handles communication with the Reddit API through our backend
 */

import { clientLogger } from '@/lib/logger';
import { sanitizeString } from '@/lib/validation';

export interface RedditPost {
    title: string;
    mediaUrls: string[];
    subreddit: string;
    postId: string;
    isUnplayableVideoFormat?: boolean;
}

export type SortType = 'hot' | 'top';
export type TimeFrame = 'day' | 'week' | 'month' | 'year' | 'all';

interface ApiErrorResponse {
    error: string;
    details?: Array<{ field: string; message: string }>;
    resetTime?: number;
    remaining?: number;
}

export class RedditApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public resetTime?: number,
        public remaining?: number
    ) {
        super(message);
        this.name = 'RedditApiError';
    }
}

/**
 * Retrieves Reddit posts through our backend API
 * @param subreddit - The subreddit name to fetch from
 * @param sortType - How to sort the posts ('hot' or 'top')
 * @param options - Additional options for the request
 * @returns Promise resolving to posts and pagination info
 * @throws RedditApiError for API-specific errors
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
    const requestId = `${subreddit}-${sortType}-${Date.now()}`;

    clientLogger.debug('Starting Reddit API request', { 
        subreddit, 
        sortType, 
        timeFrame, 
        after, 
        limit,
        requestId 
    });

    // Validate inputs
    if (sortType === 'top' && !timeFrame) {
        const error = "TimeFrame is required when using sortType 'top'";
        clientLogger.warn('Invalid request parameters', { error, sortType, timeFrame });
        throw new RedditApiError(error, 400);
    }

    if (limit && (limit < 1 || limit > 100)) {
        const error = "Limit must be between 1 and 100";
        clientLogger.warn('Invalid limit parameter', { error, limit });
        throw new RedditApiError(error, 400);
    }

    // Sanitize inputs
    const sanitizedSubreddit = sanitizeString(subreddit.toLowerCase());
    
    // Construct API URL
    const params = new URLSearchParams({
        subreddit: sanitizedSubreddit,
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
    const startTime = Date.now();

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
            },
            // Add timeout using AbortController
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        const duration = Date.now() - startTime;
        
        if (!response.ok) {
            let errorData: ApiErrorResponse;
            try {
                errorData = await response.json();
            } catch {
                errorData = { error: `Server responded with status: ${response.status}` };
            }

            clientLogger.error('Reddit API request failed', {
                requestId,
                status: response.status,
                error: errorData.error,
                duration,
                url
            });

            throw new RedditApiError(
                errorData.error || `HTTP ${response.status}`,
                response.status,
                errorData.resetTime,
                errorData.remaining
            );
        }

        const data: { posts: RedditPost[], after: string | null } = await response.json();
        
        // Validate response data
        if (!Array.isArray(data.posts)) {
            clientLogger.error('Invalid response format', { requestId, data });
            throw new RedditApiError('Invalid response format from server', 502);
        }

        clientLogger.info('Reddit API request completed', {
            requestId,
            postsCount: data.posts.length,
            hasMore: !!data.after,
            duration
        });

        return data;

    } catch (error) {
        const duration = Date.now() - startTime;
        
        if (error instanceof RedditApiError) {
            throw error;
        }

        if (error instanceof Error) {
            if (error.name === 'TimeoutError') {
                clientLogger.error('Reddit API request timeout', { requestId, duration });
                throw new RedditApiError('Request timeout - please try again', 408);
            }
            
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                clientLogger.error('Network error during Reddit API request', { 
                    requestId, 
                    error: error.message, 
                    duration 
                });
                throw new RedditApiError('Network error - please check your connection', 0);
            }
        }

        clientLogger.error('Unexpected error during Reddit API request', {
            requestId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            duration
        });

        throw new RedditApiError(
            error instanceof Error ? error.message : 'An unexpected error occurred',
            500
        );
    }
}

/**
 * Parse comma-separated subreddits with validation
 * @param input - Comma-separated subreddit names
 * @returns Array of validated subreddit names
 */
export function parseSubreddits(input: string): string[] {
    const subreddits = input
        .split(',')
        .map(s => sanitizeString(s.trim()))
        .filter(s => s.length > 0)
        .filter(s => /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(s)) // Basic validation
        .slice(0, 10); // Limit to 10 subreddits

    return [...new Set(subreddits)]; // Remove duplicates
}

/**
 * Check if a subreddit name is valid
 * @param subreddit - Subreddit name to validate
 * @returns True if valid, false otherwise
 */
export function isValidSubreddit(subreddit: string): boolean {
    return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(subreddit) && 
           subreddit.length > 0 && 
           subreddit.length <= 21;
}

/**
 * Create a cache key for Reddit requests
 * @param subreddit - Subreddit name
 * @param sortType - Sort type
 * @param timeFrame - Time frame (for top sorting)
 * @param after - Pagination token
 * @returns Cache key string
 */
export function createCacheKey(
    subreddit: string,
    sortType: SortType,
    timeFrame?: TimeFrame,
    after?: string | null
): string {
    const timeKey = sortType === 'top' ? (timeFrame || 'all') : 'none';
    const afterKey = after || 'initial';
    return `reddit:${subreddit}:${sortType}:${timeKey}:${afterKey}`;
}