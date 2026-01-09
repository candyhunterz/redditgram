/**
 * Generate a Reddit URL for a post
 */
export function getRedditUrl(subreddit: string, postId: string): string {
  return `https://www.reddit.com/r/${subreddit}/comments/${postId}`
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

interface SharePostParams {
  title: string
  subreddit: string
  postId: string
}

interface ShareResult {
  shared: boolean
  method: 'share' | 'clipboard' | null
}

/**
 * Share a post using Web Share API or fallback to clipboard
 */
export async function sharePost(params: SharePostParams): Promise<ShareResult> {
  const { title, subreddit, postId } = params
  const url = getRedditUrl(subreddit, postId)

  // Try Web Share API first
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title,
        text: `Check out this post from r/${subreddit}`,
        url,
      })
      return { shared: true, method: 'share' }
    } catch {
      // User cancelled or share failed, fallback to clipboard
    }
  }

  // Fallback to clipboard
  const copied = await copyToClipboard(url)
  if (copied) {
    return { shared: true, method: 'clipboard' }
  }

  return { shared: false, method: null }
}
