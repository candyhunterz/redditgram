/**
 * Represents a Reddit post containing media.
 */
export interface RedditPost {
  /**
   * The title of the post.
   */
  title: string;
  /**
   * The URL of the media (image or video).
   */
  mediaUrl: string;
  /**
   * The subreddit the post belongs to.
   */
  subreddit: string;
}

/**
 * Asynchronously retrieves hot posts containing media from a given subreddit.
 *
 * @param subreddit The name of the subreddit to fetch posts from.
 * @param after The 'after' parameter for pagination.
 * @param limit The number of posts to retrieve.
 * @returns A promise that resolves to an object containing an array of RedditPost objects and the next 'after' token.
 */
export async function getHotPosts(subreddit: string, after: string | undefined, limit: number = 20): Promise<{ posts: RedditPost[], after: string | null }> {
  try {
    let url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
    if (after) {
      url += `&after=${after}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const posts: RedditPost[] = data.data.children.map((child: any) => {
      const postData = child.data;
      let mediaUrl = '';

      if (postData.url && (postData.url.endsWith('.jpg') || postData.url.endsWith('.jpeg') || postData.url.endsWith('.png'))) {
        mediaUrl = postData.url;
      } else if (postData.media && postData.media.reddit_video && postData.media.reddit_video.fallback_url) {
        mediaUrl = postData.media.reddit_video.fallback_url;
      } else if (postData.preview?.reddit_video_preview?.fallback_url) {
        mediaUrl = postData.preview.reddit_video_preview.fallback_url;
      }

      return {
        title: postData.title,
        mediaUrl: mediaUrl,
        subreddit: subreddit,
      };
    }).filter((post: RedditPost) => post.mediaUrl !== ''); // Filter out posts without media

    return {
      posts: posts,
      after: data.data.after,
    };
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    throw new Error(`Failed to fetch posts from /r/${subreddit}: ${error.message}`);
  }
}
