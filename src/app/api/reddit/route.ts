import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { getValidatedEnv } from '@/lib/env';
import { authLogger, apiLogger } from '@/lib/logger';
import { applyRateLimit, getClientIdentifier } from '@/lib/rate-limiter';
import { redditApiQuerySchema, createValidationErrorResponse, isAllowedImageDomain } from '@/lib/validation';

// ========================================================================
// 1. TYPE DEFINITIONS & INTERFACES
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

interface RedditApiData {
    data: {
        children: Array<{
            data: RedditPostData;
        }>;
        after: string | null;
    };
}

interface RedditPostData {
    id: string;
    title: string;
    subreddit: string;
    url: string;
    url_overridden_by_dest?: string;
    is_video?: boolean;
    is_gallery?: boolean;
    media?: {
        reddit_video?: {
            fallback_url?: string;
        };
        oembed?: {
            thumbnail_url?: string;
        };
    };
    secure_media?: {
        reddit_video?: {
            fallback_url?: string;
        };
        oembed?: {
            thumbnail_url?: string;
        };
    };
    preview?: {
        images?: Array<{
            source: {
                url: string;
            };
        }>;
        reddit_video_preview?: {
            fallback_url: string;
        };
    };
    gallery_data?: {
        items: Array<{
            media_id: string;
        }>;
    };
    media_metadata?: {
        [key: string]: {
            p?: Array<{ u: string }>;
            s?: { u: string };
        };
    };
    crosspost_parent_list?: RedditPostData[];
}
/**
 * Extracts media URLs from Reddit post data
 * Handles galleries, videos, images, and cross-posts
 * @param postDetail - Reddit post data object
 * @returns Array of media URLs
 */
const extractMediaUrls = (postDetail: RedditPostData): string[] => {
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
// 2. OAUTH TOKEN HANDLER
// ========================================================================
/**
 * Gets Reddit OAuth access token, using cache when available
 * @returns Promise resolving to access token
 * @throws Error if credentials are missing or request fails
 */
async function getAccessToken(): Promise<string> {
    const cachedToken = await kv.get<string>('reddit_access_token');
    if (cachedToken) {
        authLogger.debug('Using cached access token');
        return cachedToken;
    }

    authLogger.info('Fetching new access token from Reddit');
    const env = getValidatedEnv();
    const { REDDIT_CLIENT_ID: clientId, REDDIT_CLIENT_SECRET: clientSecret } = env;

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
        authLogger.error('Failed to get access token', { status: response.status, error: errorText });
        throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    const token = data.access_token;
    const expiresIn = data.expires_in;

    if (!token) {
        authLogger.error('No access token in response', data);
        throw new Error('No access token received from Reddit');
    }

    await kv.set('reddit_access_token', token, { ex: expiresIn - 60 });
    authLogger.info('Successfully fetched and cached new token');

    return token;
}

// ========================================================================
// 3. API ROUTE HANDLER
// ========================================================================
/**
 * GET /api/reddit
 * Fetches Reddit posts with rate limiting, validation, and proper error handling
 */
export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const clientId = getClientIdentifier(request);
    
    apiLogger.info('Reddit API request started', { clientId });

    try {
        // Apply rate limiting
        const rateLimitResult = await applyRateLimit(clientId, 'reddit');
        
        if (!rateLimitResult.success) {
            apiLogger.warn('Rate limit exceeded', { clientId, resetTime: rateLimitResult.resetTime });
            return NextResponse.json(
                { 
                    error: 'Rate limit exceeded',
                    resetTime: rateLimitResult.resetTime,
                    remaining: rateLimitResult.remaining
                },
                { 
                    status: 429,
                    headers: {
                        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
                        'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
                    }
                }
            );
        }

        // Validate query parameters
        const { searchParams } = new URL(request.url);
        const queryParams = {
            subreddit: searchParams.get('subreddit'),
            sortType: searchParams.get('sortType'),
            timeFrame: searchParams.get('timeFrame'),
            after: searchParams.get('after'),
            limit: searchParams.get('limit') || '20',
        };

        const validationResult = redditApiQuerySchema.safeParse(queryParams);
        
        if (!validationResult.success) {
            apiLogger.warn('Invalid request parameters', { clientId, errors: validationResult.error.errors });
            return NextResponse.json(
                createValidationErrorResponse(validationResult.error),
                { status: 400 }
            );
        }

        const { subreddit, sortType, timeFrame, after, limit } = validationResult.data;

        // Fetch data from Reddit
        const accessToken = await getAccessToken();
        let url = `https://oauth.reddit.com/r/${subreddit}/${sortType}.json?limit=${limit}&raw_json=1`;
        if (sortType === 'top' && timeFrame) { url += `&t=${timeFrame}`; }
        if (after) { url += `&after=${after}`; }

        const env = getValidatedEnv();
        const userAgent = `web:gramviewer:v2.0.0 (by /u/${env.REDDIT_USERNAME || 'candyhunterz'})`;

        apiLogger.debug('Fetching from Reddit', { url, subreddit, sortType });

        const redditResponse = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': userAgent,
            },
            // Add timeout
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!redditResponse.ok) {
            const errorDetails = await redditResponse.text();
            apiLogger.error('Reddit API error', { 
                status: redditResponse.status, 
                error: errorDetails, 
                subreddit 
            });
            return NextResponse.json(
                { error: `Reddit API Error: ${redditResponse.status}` },
                { status: redditResponse.status >= 500 ? 502 : redditResponse.status }
            );
        }

        const data: RedditApiData = await redditResponse.json();

        if (!data?.data?.children) {
            apiLogger.warn('No children in Reddit response', { subreddit, data });
            return NextResponse.json({ posts: [], after: null });
        }

        // Process posts with improved type safety and validation
        const posts: RedditPost[] = data.data.children
            .map((child): RedditPost | null => {
                const postData = child?.data;
                if (!postData) {
                    apiLogger.debug('No post data in child', { child });
                    return null;
                }

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

                // Handle crosspost fallback
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
                        if (mediaUrls.length > 0) {
                            isUnplayableVideo = true;
                        }
                    }
                }

                // Filter and validate media URLs for security
                const validMediaUrls = mediaUrls.filter(url => {
                    try {
                        // Basic URL validation
                        new URL(url);
                        // Check if domain is allowed
                        return isAllowedImageDomain(url);
                    } catch {
                        return false;
                    }
                });

                if (validMediaUrls.length > 0) {
                    return {
                        title: postData.title?.slice(0, 300) || '', // Limit title length
                        mediaUrls: validMediaUrls.slice(0, 20), // Limit media count
                        subreddit: postData.subreddit || subreddit,
                        postId: postData.id,
                        isUnplayableVideoFormat: isUnplayableVideo,
                    };
                }
                return null;
            })
            .filter((post): post is RedditPost => post !== null);

        const duration = Date.now() - startTime;
        apiLogger.info('Reddit API request completed', { 
            clientId, 
            subreddit, 
            postsCount: posts.length, 
            duration 
        });

        return NextResponse.json(
            { posts, after: data.data.after },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                    'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
                }
            }
        );

    } catch (error) {
        const duration = Date.now() - startTime;
        apiLogger.error('Reddit API request failed', { 
            clientId, 
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            duration 
        });

        // Handle specific error types
        if (error instanceof Error) {
            if (error.name === 'TimeoutError') {
                return NextResponse.json(
                    { error: 'Request timeout - Reddit API took too long to respond' },
                    { status: 504 }
                );
            }
            if (error.message.includes('Environment validation failed')) {
                return NextResponse.json(
                    { error: 'Server configuration error' },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json(
            { error: 'An internal server error occurred' },
            { status: 500 }
        );
    }
}