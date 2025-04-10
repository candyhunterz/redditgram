
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
 * @returns A promise that resolves to an array of RedditPost objects.
 */
export async function getHotPosts(subreddit: string): Promise<RedditPost[]> {
  try {
    const response = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=20`);
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

    return posts;
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    throw new Error(`Failed to fetch posts from /r/${subreddit}: ${error.message}`);
  }
}
